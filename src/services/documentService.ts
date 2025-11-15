import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import os from 'os';
import path from 'path';
import { promises as fsp } from 'fs';
import { UploadResult, LeiStructure } from '../types';
import { TextParser } from '../utils/textParser';
import { logger } from '../utils/logger';
import { cacheManager } from '../utils/cache';
import { AppError } from '../middlewares/errorHandler';

export class DocumentService {
  // Detecta tipo de documento pelo cabeçalho do buffer
  static detectDocumentType(buffer: Buffer): 'docx' | 'doc' | 'unknown' {
    if (buffer.length < 4) return 'unknown';
    // DOCX (ZIP): magic bytes "PK\x03\x04"
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return 'docx';
    }
    // DOC (OLE Compound File): D0 CF 11 E0 A1 B1 1A E1
    const oleMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const matchesOle = buffer.length >= 8 && oleMagic.every((b, i) => buffer[i] === b);
    if (matchesOle) return 'doc';
    return 'unknown';
  }

  async processWordDocument(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<UploadResult> {
    // Bloquear arquivos temporários do Office/LibreOffice pelo nome
    const base = filename.toLowerCase();
    if (
      base.startsWith('~$') ||
      base.startsWith('.~lock') ||
      base.endsWith('.docx#') ||
      base.endsWith('.doc#')
    ) {
      logger.warn('Temporary Office/LibreOffice file rejected', { filename });
      return {
        success: false,
        error: 'Arquivo temporário do Office/LibreOffice não é processável',
        filename,
      };
    }

    const cacheKey = cacheManager.generateFileKey(filename, buffer.length);
    
    // Verificar cache primeiro
    const cachedResult = cacheManager.get<UploadResult>(cacheKey);
    if (cachedResult) {
      logger.info('Returning cached document processing result', { filename });
      return cachedResult;
    }

    try {
      logger.info('Starting document processing', { filename, mimetype, size: buffer.length });

      let extractedText: string;

      // Preferir detecção pelo cabeçalho do arquivo e só então cair no mimetype
      const detected = DocumentService.detectDocumentType(buffer);
      if (detected === 'docx') {
        extractedText = await this.processDocx(buffer);
      } else if (detected === 'doc') {
        extractedText = await this.processDoc(buffer, filename);
      } else {
        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          extractedText = await this.processDocx(buffer);
        } else if (mimetype === 'application/msword') {
          extractedText = await this.processDoc(buffer, filename);
        } else {
          throw new AppError('Tipo de arquivo não suportado', 400);
        }
      }

      if (!extractedText.trim()) {
        throw new AppError('Não foi possível extrair texto do documento', 400);
      }

      // Processar o texto extraído
      const leiStructure = this.processExtractedText(extractedText, filename);

      const result: UploadResult = {
        success: true,
        data: leiStructure,
        filename,
      };

      // Cache do resultado se bem-sucedido
      cacheManager.set(cacheKey, result);

      logger.info('Document processing completed successfully', { 
        filename, 
        artigos: leiStructure.artigos.length 
      });

      return result;
    } catch (error) {
      logger.error('Document processing failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido no processamento do documento',
        filename,
      };
    }
  }

  // Novo: processa documentos que podem conter múltiplos autógrafos/leis
  async processWordDocumentMultiple(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    opts?: { headerPattern?: string }
  ): Promise<LeiStructure[]> {
    // Bloquear arquivos temporários do Office/LibreOffice pelo nome (segurança extra)
    const base = filename.toLowerCase();
    if (
      base.startsWith('~$') ||
      base.startsWith('.~lock') ||
      base.endsWith('.docx#') ||
      base.endsWith('.doc#')
    ) {
      logger.warn('Temporary Office/LibreOffice file rejected (multiple)', { filename });
      return [];
    }
    let extractedText: string;

    // Preferir detecção pelo cabeçalho do arquivo e só então cair no mimetype
    const detected = DocumentService.detectDocumentType(buffer);
    if (detected === 'docx') {
      extractedText = await this.processDocx(buffer);
    } else if (detected === 'doc') {
      extractedText = await this.processDoc(buffer, filename);
    } else {
      if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        extractedText = await this.processDocx(buffer);
      } else if (mimetype === 'application/msword') {
        extractedText = await this.processDoc(buffer, filename);
      } else {
        throw new AppError('Tipo de arquivo não suportado', 400);
      }
    }
  
    if (!extractedText.trim()) {
      throw new AppError('Não foi possível extrair texto do documento', 400);
    }
  
    const cleanedText = TextParser.cleanText(extractedText);
    const sections = TextParser.splitByHeaderPattern(cleanedText, opts?.headerPattern);
    const results: LeiStructure[] = [];

    if (sections.length === 0) {
      const single = this.processExtractedText(cleanedText, filename);
      if (single) results.push(single);
    } else {
      for (const section of sections) {
        const lei = this.processExtractedText(section, filename);
        results.push(lei);
      }
    }

    // Deduplicação por número/data para evitar salvar leis repetidas
    const normalizeNumero = (n: string) => (n || '').replace(/[^\d]/g, '');
    const seen = new Set<string>();
    const deduped: LeiStructure[] = [];

    for (const lei of results) {
      const numNorm = normalizeNumero(lei.numero);
      const dateKey = lei.data ? new Date(lei.data).toISOString().slice(0, 10) : '';
      const titleKey = (lei.titulo || '').trim().toUpperCase();
      const key = numNorm ? `${numNorm}|${dateKey}` : `no-number|${titleKey}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(lei);
      }
    }

    return deduped;
  }

  private async processDocx(buffer: Buffer): Promise<string> {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || '';
  }

  private async processDoc(buffer: Buffer, filename: string): Promise<string> {
    // Usa word-extractor para obter texto de arquivos .doc
    // Como a lib trabalha com caminho de arquivo, gravamos em um temp e removemos depois
    const tmpDir = path.join(os.tmpdir(), 'apicamara-doc-import');
    try {
      await fsp.mkdir(tmpDir, { recursive: true });
    } catch {}
    const safeName = (filename || 'document').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const tmpPath = path.join(tmpDir, `${Date.now()}-${safeName.replace(/\.docx?$/i, '')}.doc`);
    await fsp.writeFile(tmpPath, buffer);

    try {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(tmpPath);
      const body = (doc.getBody() || '').toString();
      return body.replace(/[\r\t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
    } finally {
      // limpeza best-effort
      fsp.unlink(tmpPath).catch(() => {});
    }
  }

  private processExtractedText(extractedText: string, filename: string): LeiStructure {
    // limpar e extrair estrutura hierárquica
    const cleaned = TextParser.cleanText(extractedText);
    const parsed = TextParser.parseHierarchicalText(cleaned);
  
    // tentar extrair ementa se não veio do parser hierárquico
    if (!parsed.ementa) {
      const ementa = TextParser.extractEmenta(cleaned);
      if (ementa) {
        parsed.ementa = ementa;
      }
    }
  
    // Se não houve artigos identificados, manter estrutura mínima
    const artigos = parsed.artigos || [];
  
    const result: LeiStructure = {
      titulo: parsed.titulo || filename,
      numero: parsed.numero || 'Número não identificado',
      origem: 'upload',
      textoCompleto: cleaned,
      artigos,
    };

    if (parsed.tipo) {
      (result as any).tipo = parsed.tipo;
    }
  
    if (parsed.ementa) {
      result.ementa = parsed.ementa;
    }
    if (parsed.data) {
      result.data = parsed.data;
    }
  
    return result;
  }
}