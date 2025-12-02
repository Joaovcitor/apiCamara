import { Request, Response } from 'express';
import { DocumentService } from '../services/documentService';
import { LeiService } from '../services/leiService';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler, AppError } from '../middlewares/errorHandler';
import { saveFile, getPublicUrl } from '../utils/fileStorage';
import { TextParser } from '../utils/textParser';

export class UploadController {
  private documentService: DocumentService;
  private leiService: LeiService;

  constructor() {
    this.documentService = new DocumentService();
    this.leiService = new LeiService();
  }

  /**
   * @swagger
   * /upload:
   *   post:
   *     summary: Faz upload e processa um arquivo Word (.doc ou .docx)
   *     tags: [Upload]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Arquivo Word (.doc ou .docx)
   *     responses:
   *       200:
   *         description: Arquivo processado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Lei'
   *                 message:
   *                   type: string
   *                   example: "Arquivo processado e lei salva com sucesso"
   *       400:
   *         description: Arquivo inválido ou formato não suportado
   *       413:
   *         description: Arquivo muito grande
   */
  uploadSingle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('Nenhum arquivo foi enviado', 400);
    }

    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para realizar upload', 400);
    }

    const file = req.file as Express.Multer.File;
    logger.info('File upload received', { 
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      municipioId
    });

    const { storedName, fullPath } = await saveFile(file.buffer, file.originalname);
    const fileUrl = getPublicUrl(storedName);
    logger.info('File saved to disk', { storedName, fullPath, fileUrl });

    const leis = await this.documentService.processWordDocumentMultiple(
      file.buffer,
      file.originalname,
      file.mimetype
    );
    if (leis.length > 1) {
      const successful: any[] = [];
      const failed: Array<{ message: string }> = [];
      for (const lei of leis) {
        try {
          lei.origem = fileUrl;
          const saved = await this.leiService.saveLei(lei, municipioId, usuarioId);
          successful.push(saved);
        } catch (e: any) {
          failed.push({ message: e?.message || 'Erro ao salvar lei' });
        }
      }
      const response: ApiResponse = {
        success: true,
        data: { successful, failed },
        message: 'Arquivo processado e leis salvas com sucesso',
      };
      logger.info('File processed with multiple leis', {
        filename: file.originalname,
        successful: successful.length,
        failed: failed.length,
        fileUrl,
      });
      res.status(200).json(response);
      return;
    }
    const single = leis[0] || null;
    if (!single) {
      const response: ApiResponse = {
        success: false,
        error: 'Falha no processamento do documento',
      };
      res.status(400).json(response);
      return;
    }
    single.origem = fileUrl;
    const savedLei = await this.leiService.saveLei(single, municipioId, usuarioId);
    const response: ApiResponse = {
      success: true,
      data: savedLei,
      message: 'Arquivo processado e lei salva com sucesso',
    };
    logger.info('File processing completed successfully', {
      filename: file.originalname,
      leiId: savedLei.id,
      titulo: savedLei.titulo,
      fileUrl,
    });
    res.status(200).json(response);
  });

  /**
   * @swagger
   * /upload/batch:
   *   post:
   *     summary: Faz upload e processa múltiplos arquivos Word
   *     tags: [Upload]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - files
   *             properties:
   *               files:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *                 maxItems: 10
   *                 description: Arquivos Word (máximo 10)
   *     responses:
   *       200:
   *         description: Arquivos processados
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     successful:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Lei'
   *                     failed:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           filename:
   *                             type: string
   *                           error:
   *                             type: string
   *                 message:
   *                   type: string
   */
  uploadBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];
    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para realizar upload', 400);
    }

    if (!files || files.length === 0) {
      throw new AppError('Nenhum arquivo foi enviado', 400);
    }

    if (files.length > 10) {
      throw new AppError('Máximo de 10 arquivos por requisição', 400);
    }

    logger.info('Batch file upload received', { count: files.length, municipioId });

    const successful: any[] = [];
    const failed: Array<{ filename: string; error: string }> = [];

    // Processar arquivos sequencialmente para evitar sobrecarga
    for (const file of files) {
      try {
        // Salvar arquivo no disco
        const { storedName } = await saveFile(file.buffer, file.originalname);
        const fileUrl = getPublicUrl(storedName);

        const processResult = await this.documentService.processWordDocument(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        
        if (processResult.success && processResult.data) {
          // Atualizar origem para URL pública do arquivo
          processResult.data.origem = fileUrl;

          const savedLei = await this.leiService.saveLei(processResult.data, municipioId, usuarioId);
          successful.push(savedLei);
        } else {
          failed.push({
            filename: file.originalname,
            error: processResult.error || 'Falha no processamento',
          });
        }
      } catch (error) {
        failed.push({
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        successful,
        failed,
      },
      message: 'Processamento concluído',
    };

    logger.info('Batch processing completed', { 
      processed: files.length, 
      successful: successful.length, 
      failed: failed.length 
    });

    res.status(200).json(response);
  });

  /**
   * @swagger
   * /upload/split:
   *   post:
   *     summary: Faz upload de um arquivo Word e divide em múltiplas leis por padrão de cabeçalho
   *     tags: [Upload]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Arquivo Word (.doc ou .docx)
   *               headerPattern:
   *                 type: string
   *                 description: Regex (string) para identificar início de cada lei; a 1ª captura deve conter o número
   *               headerSample:
   *                 type: string
   *                 description: Exemplo de linha de cabeçalho para gerar automaticamente um padrão
   *     responses:
   *       200:
   *         description: Leis extraídas do arquivo
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     successful:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Lei'
   *                     failed:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           message:
   *                             type: string
   *                 message:
   *                   type: string
   */
  uploadSplit = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('Nenhum arquivo foi enviado', 400);
    }

    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para realizar upload', 400);
    }

    const file = req.file as Express.Multer.File;
    const headerPatternRaw = (req.body?.headerPattern as string | undefined) || undefined;
    const headerSample = (req.body?.headerSample as string | undefined) || undefined;
    const headerPattern = headerPatternRaw || (headerSample ? TextParser.generateHeaderPattern(headerSample) : undefined);

    logger.info('Split upload received', {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      headerPatternProvided: Boolean(headerPatternRaw),
      headerSampleProvided: Boolean(headerSample),
      municipioId
    });

    // Salvar arquivo no disco (subpasta import/split)
    const { publicPath } = await saveFile(file.buffer, file.originalname, 'import/split');
    const fileUrl = getPublicUrl(publicPath);

    const successful: any[] = [];
    const failed: Array<{ message: string }> = [];

    try {
      const opts = headerPattern ? { headerPattern } : undefined;
      const leis = await this.documentService.processWordDocumentMultiple(
        file.buffer,
        file.originalname,
        file.mimetype,
        opts
      );

      if (!leis.length) {
        failed.push({ message: 'Nenhuma lei detectada no documento' });
      } else {
        for (const lei of leis) {
          lei.origem = fileUrl;
          const saved = await this.leiService.saveLei(lei, municipioId, usuarioId);
          successful.push(saved);
        }
      }
    } catch (err: any) {
      failed.push({ message: err?.message || 'Erro desconhecido' });
    }

    const response: ApiResponse = {
      success: true,
      data: { successful, failed },
      message: 'Processamento com divisão por cabeçalho concluído',
    };

    logger.info('Split processing completed', {
      filename: file.originalname,
      successful: successful.length,
      failed: failed.length,
    });

    res.status(200).json(response);
  });

  /**
   * @swagger
   * /upload/validate:
   *   post:
   *     summary: Valida um arquivo Word sem processá-lo
   *     tags: [Upload]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Arquivo Word para validação
   *     responses:
   *       200:
   *         description: Arquivo válido
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     filename:
   *                       type: string
   *                     size:
   *                       type: number
   *                     mimetype:
   *                       type: string
   *                     isValid:
   *                       type: boolean
   *                 message:
   *                   type: string
   */
  validateFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('Nenhum arquivo foi enviado', 400);
    }

    const file = req.file as Express.Multer.File;
    
    // Validar o arquivo sem processá-lo completamente
    const documentType = DocumentService.detectDocumentType(file.buffer);
    const isValid = documentType !== 'unknown';

    const response: ApiResponse = {
      success: true,
      data: {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        isValid,
      },
      message: isValid ? 'Arquivo válido' : 'Arquivo inválido ou não contém conteúdo jurídico',
    };

    logger.info('File validation completed', { 
      filename: file.originalname,
      isValid 
    });

    res.status(200).json(response);
  });
}
