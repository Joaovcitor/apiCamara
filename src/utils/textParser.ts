import { 
  LeiStructure, 
  ArtigoStructure, 
  ParagrafoStructure, 
  IncisoStructure, 
  AlineaStructure, 
  ItemStructure,
  CapituloStructure 
} from '../types';

export class TextParser {
  // Regex patterns para identificar elementos jurídicos
  private static readonly PATTERNS = {
    // Artigos: "Art. 1º", "Artigo 1º", "Art. 1°"
    artigo: /^(?:Art\.?\s*|Artigo\s+)(\d+[ºº°]?)\s*[-–—]?\s*(.*)/i,
    
    // Parágrafos: "§ 1º", "§1º", "Parágrafo único"
    paragrafo: /^(?:§\s*(\d+[ºº°]?)|Parágrafo\s+único)\s*[-–—]?\s*(.*)/i,
    
    // Incisos: "I -", "II.", "III)"
    inciso: /^([IVXLCDM]+)\s*[-–—.)]\s*(.*)/i,
    
    // Alíneas: "a)", "b.", "c -"
    alinea: /^([a-z])\s*[).-]\s*(.*)/i,
    
    // Itens: "1)", "2.", "3 -"
    item: /^(\d+)\s*[).-]\s*(.*)/i,
    
    // Título da lei complementar
    tituloLeiComplementar: /^(?:Lei\s+Complementar)\s+n[ºº°]?\s*[\d.,\/\-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    // Título da resolução
    tituloResolucao: /^(?:Resolu[cç][aã]o)\s+n[ºº°]?\s*[\d.,\/\-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    // Títulos principais
    // Lei: "Lei nº 12.345, de 6 de julho de 2010"
    tituloLei: /^(?:Lei|Decreto|Medida Provisória|Emenda Constitucional)\s+(?:Legislativo\s+)?n[ºº°]?\s*[\d.,\/-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    // Decreto Legislativo: "Decreto Legislativo nº 370, de ..."
    tituloDecretoLegislativo: /^(?:Decreto\s+Legislativo)\s+n[ºº°]?\s*[\d.,\/-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    // Projeto de Lei Complementar: "Projeto de Lei Complementar Nº 001/2015"
    tituloProjetoLeiComplementar: /^(?:Projeto\s+de\s+Lei\s+Complementar)\s+n[ºº°]?\s*[\d.,\/-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    tituloProjetoEmendaLeiComplementar: /^(?:Projeto\s+de\s+Emenda\s+(?:à|a)\s+Lei\s+Complementar)\s+n[ºº°]?\s*[\d.,\/-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    tituloEmendaLeiComplementar: /^(?:Emenda\s+(?:à|a)\s+Lei\s+Complementar)\s+n[ºº°]?\s*[\d.,\/-]+(?:,\s*de\s+[\d\s\w,]+)?/i,
    
    // Data: "de 6 de julho de 2010"
    data: /de\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    
    // Capítulos: "Capítulo I - DISPOSIÇÕES GERAIS"
    capitulo: /^(?:cap[íi]tulo)\s+([IVXLCDM]+|\d+)\b\.?\s*(?:[-–—:]?\s*(.*))?$/i,
  };

  // Cabeçalho de autógrafo: "Autógrafo de Lei n 2992", "Autógrafos de Lei Complementar nº 123"
  private static readonly AUTOGRAFO_HEADER = /^(?:\s*)aut[óo]grafo(?:s)?\s+de\s+lei(?:\s+complementar)?\s*(?:n\s*[^\d]{0,6}\s*)?([\d.,\/\-]+)/i;

  private static readonly MESES = {
    janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  };

  static cleanText(text: string): string {
    return text
      .replace(/[\r\t]+/g, ' ')
      // Normalizar variações de "n."/"n°" para "nº" em títulos
      .replace(/\bn\.?\s*/gi, 'nº ')
      .replace(/\bn°\s*/gi, 'nº ')
      .replace(/\bn\s*º\s*/gi, 'nº ')
      // Compactar repetições de símbolos após nº (ex.: "nº º º")
      .replace(/\bnº[º°\s]+/gi, 'nº ')
      // Normalizar ordinais com dígitos (1° -> 1º, removendo espaços)
      .replace(/(\d+)\s*[º°]/g, '$1º')
      // Remover º/° quando inserido no meio de palavras
      .replace(/([A-Za-zÀ-ÿ])\s*[º°]\s*([A-Za-zÀ-ÿ])/g, '$1$2')
      // Corrigir casos de "nº" antes de palavras (ex.: "nº ordeste" -> "nordeste")
      .replace(/\b([nN])\s*[º°]\s+([A-Za-zÀ-ÿ])/g, '$1$2')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  static extractTitleAndNumber(line: string): { titulo: string; numero: string; tipo: 'LEI' | 'COMPLEMENTAR' | 'RESOLUCAO' } | null {
    // 0) Padrão Lei Complementar
    const matchComplementar = line.match(this.PATTERNS.tituloLeiComplementar);
    if (matchComplementar) {
      const titulo = matchComplementar[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/\-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero: `LC ${numero}`, tipo: 'COMPLEMENTAR' };
    }
    // 0.1) Padrão Resolução
    const matchResolucao = line.match(this.PATTERNS.tituloResolucao);
    if (matchResolucao) {
      const titulo = matchResolucao[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/\-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero: `RES ${numero}`, tipo: 'RESOLUCAO' };
    }
    // 0.2) Padrão Decreto Legislativo
    const matchDL = line.match(this.PATTERNS.tituloDecretoLegislativo);
    if (matchDL) {
      const titulo = matchDL[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/\-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero, tipo: 'LEI' };
    }
    // 0.3) Padrão Projeto de Lei Complementar
    const matchPLC = line.match(this.PATTERNS.tituloProjetoLeiComplementar);
    if (matchPLC) {
      const titulo = matchPLC[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/\-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero: `LC ${numero}`, tipo: 'COMPLEMENTAR' };
    }
    const matchPELC = line.match(this.PATTERNS.tituloProjetoEmendaLeiComplementar);
    if (matchPELC) {
      const titulo = matchPELC[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/\-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero: `LC ${numero}`, tipo: 'COMPLEMENTAR' };
    }
    const matchELC = line.match(this.PATTERNS.tituloEmendaLeiComplementar);
    if (matchELC) {
      const titulo = matchELC[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/\-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero: `LC ${numero}`, tipo: 'COMPLEMENTAR' };
    }
    // 1) Padrão clássico (Lei/Decreto/MP/Emenda)
    const match = line.match(this.PATTERNS.tituloLei);
    if (match) {
      const titulo = match[0].trim();
      const numeroMatch = titulo.match(/n[ºº°]?\s*([\d.,\/-]+)/i);
      const numero = numeroMatch?.[1] ?? 'Número não identificado';
      return { titulo, numero, tipo: 'LEI' };
    }

    // 2) Cabeçalho de autógrafo (Autógrafo(s) de Lei (Complementar) nº XXXX ...)
    const auto = line.match(this.AUTOGRAFO_HEADER);
    if (auto) {
      const isComplementar = /aut[óo]grafo(?:s)?\s+de\s+lei\s+complementar/i.test(auto[0]);
      const numero = (auto[1] || '').trim() || 'Número não identificado';
      const tituloLabel = `Autógrafo de Lei${isComplementar ? ' Complementar' : ''} nº ${numero}`;
      return { titulo: tituloLabel, numero: isComplementar ? `LC ${numero}` : numero, tipo: isComplementar ? 'COMPLEMENTAR' : 'LEI' };
  }

    return null;
  }

  static parseDate(line: string): Date | undefined {
    const match = line.match(this.PATTERNS.data);
    if (!match) return undefined;
    const dayStr = match?.[1];
    const monthNameRaw = match?.[2];
    const yearStr = match?.[3];
    if (!dayStr || !monthNameRaw || !yearStr) return undefined;
    const day = parseInt(dayStr, 10);
    const monthName = monthNameRaw.toLowerCase();
    const year = parseInt(yearStr, 10);
    const monthIndex = this.MESES[monthName as keyof typeof this.MESES];
    if (typeof monthIndex !== 'number') return undefined;
    return new Date(year, monthIndex, day);
  }

  static extractEmenta(line: string): string | null {
    // Ementa costuma ser uma frase geral após o título
    if (!line) return null;
    const isTooShort = line.length < 10;
    const isTooLong = line.length > 500; // evite blocos muito longos como ementa
    const hasStructuralWords = /(Art\.|Artigo|Cap[íi]tulo|Seção|§|I\s*-|II\s*-)/i.test(line);
    if (isTooShort || isTooLong || hasStructuralWords) return null;
    return line;
  }

  static parseHierarchicalText(text: string): LeiStructure {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let titulo = '';
    let numero = '';
    let ementa = '';
    let tipo: 'LEI' | 'COMPLEMENTAR' | 'RESOLUCAO' | undefined;
    let data: Date | undefined;
    
    const artigos: ArtigoStructure[] = [];
    let currentArtigo: ArtigoStructure | null = null;
    let currentParagrafo: ParagrafoStructure | null = null;
    let currentInciso: IncisoStructure | null = null;
    let currentAlinea: AlineaStructure | null = null;
    let currentCapitulo: CapituloStructure | null = null;
    let capituloCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue; // Verificação adicional de segurança
      
      // Tentar identificar título da lei
      if (!titulo) {
        const titleInfo = this.extractTitleAndNumber(line);
        if (titleInfo) {
          titulo = titleInfo.titulo;
          numero = titleInfo.numero;
          tipo = titleInfo.tipo;
          data = this.parseDate(line);
          continue;
        }
      }

      // Tentar identificar ementa (geralmente após o título)
      if (titulo && !ementa && !this.isStructuralElement(line)) {
        ementa = line;
        continue;
      }

      // Capítulo
      const capMatch = line.match(this.PATTERNS.capitulo);
      if (capMatch) {
        capituloCount += 1;
        const cap: CapituloStructure = {
          ordem: capituloCount,
        };
        if (capMatch[1]) {
          cap.numero = capMatch[1];
        }
        const nomeRaw = (capMatch[2] || '').trim();
        if (nomeRaw) {
          cap.nome = nomeRaw;
        }
        currentCapitulo = cap;
        // Reset dos contextos abaixo de capítulo
        currentArtigo = null;
        currentParagrafo = null;
        currentInciso = null;
        currentAlinea = null;
        continue;
      }

      // Artigo
      const artigoMatch = line.match(this.PATTERNS.artigo);
      if (artigoMatch && artigoMatch[1]) {
        const textoArtigo = (artigoMatch[2] ?? '').trim();
        const newArtigoBase = {
          numero: artigoMatch[1],
          texto: textoArtigo,
          ordem: artigos.length + 1,
          paragrafos: [],
          incisos: [],
        } as ArtigoStructure;
        const newArtigo: ArtigoStructure = currentCapitulo
          ? { ...newArtigoBase, capitulo: currentCapitulo }
          : newArtigoBase;
        artigos.push(newArtigo);
        currentArtigo = newArtigo;
        // Reset das estruturas abaixo
        currentParagrafo = null;
        currentInciso = null;
        currentAlinea = null;
        continue;
      }

      // Parágrafo
      const paragrafoMatch = line.match(this.PATTERNS.paragrafo);
      if (paragrafoMatch && currentArtigo) {
        const numeroParagrafo = paragrafoMatch[1] ? `§${paragrafoMatch[1]}` : 'Parágrafo único';
        currentParagrafo = {
          numero: numeroParagrafo,
          texto: (paragrafoMatch[2] ?? '').trim(),
          ordem: (currentArtigo.paragrafos?.length || 0) + 1,
          incisos: [],
        };
        currentArtigo.paragrafos = currentArtigo.paragrafos || [];
        currentArtigo.paragrafos.push(currentParagrafo);
        currentInciso = null;
        currentAlinea = null;
        continue;
      }

      // Inciso
      const incisoMatch = line.match(this.PATTERNS.inciso);
      if (incisoMatch && incisoMatch[1]) {
        const inciso: IncisoStructure = {
          numero: incisoMatch[1],
          texto: (incisoMatch[2] ?? '').trim(),
          ordem: (currentParagrafo?.incisos?.length || currentArtigo?.incisos?.length || 0) + 1,
          alineas: [],
        };
        if (currentParagrafo) {
          currentParagrafo.incisos = currentParagrafo.incisos || [];
          currentParagrafo.incisos.push(inciso);
        } else if (currentArtigo) {
          currentArtigo.incisos = currentArtigo.incisos || [];
          currentArtigo.incisos.push(inciso);
        }
        currentInciso = inciso;
        currentAlinea = null;
        continue;
      }

      // Alínea
      const alineaMatch = line.match(this.PATTERNS.alinea);
      if (alineaMatch && alineaMatch[1] && alineaMatch[2] && currentInciso) {
        const alineaObj: AlineaStructure = {
          numero: alineaMatch[1],
          texto: alineaMatch[2].trim(),
          ordem: (currentInciso.alineas?.length || 0) + 1,
          itens: [],
        };
        currentInciso.alineas = currentInciso.alineas || [];
        currentInciso.alineas.push(alineaObj);
        currentAlinea = alineaObj;
        continue;
      }

      // Itens
      const itemMatch = line.match(this.PATTERNS.item);
      if (itemMatch && itemMatch[1] && itemMatch[2] && currentAlinea) {
        const item: ItemStructure = {
          numero: itemMatch[1],
          texto: itemMatch[2].trim(),
          ordem: (currentAlinea.itens?.length || 0) + 1,
        };
        currentAlinea.itens = currentAlinea.itens || [];
        currentAlinea.itens.push(item);
        continue;
      }

      // Conteúdo textual que não inicia uma nova estrutura
      if (currentAlinea) {
        currentAlinea.texto += ' ' + line;
      } else if (currentInciso) {
        currentInciso.texto += ' ' + line;
      } else if (currentParagrafo) {
        currentParagrafo.texto += ' ' + line;
      } else if (currentArtigo) {
        currentArtigo.texto += ' ' + line;
      } else {
        ementa += (ementa ? ' ' : '') + line;
      }
    }

    const leiStructure: LeiStructure = {
      titulo: titulo || 'Título não identificado',
      numero: numero || 'Número não identificado',
      origem: '',
      artigos,
    };

    if (tipo) {
      // Atribuir somente quando detectado para respeitar exactOptionalPropertyTypes
      (leiStructure as any).tipo = tipo;
    }

    if (ementa) {
      leiStructure.ementa = ementa;
    }
    if (data) {
      leiStructure.data = data;
    }

    return leiStructure;
  }

  static isStructuralElement(line: string): boolean {
    return (
      this.PATTERNS.artigo.test(line) ||
      this.PATTERNS.paragrafo.test(line) ||
      this.PATTERNS.inciso.test(line) ||
      this.PATTERNS.alinea.test(line) ||
      this.PATTERNS.item.test(line) ||
      this.PATTERNS.capitulo.test(line)
    );
  }

  // Divide texto limpo em seções por autógrafo, iniciando nova seção apenas quando o número mudar
  static splitByAutografoSections(text: string): string[] {
    const lines = text.split('\n');
    const sections: string[] = [];
    let current: string[] = [];
    let currentNumber: string | null = null;

    for (const line of lines) {
      const match = this.AUTOGRAFO_HEADER.exec(line);
      if (match) {
        const headerNumber = (match[1] || '').replace(/[^\d]/g, '');

        if (current.length === 0) {
          // primeira seção
          currentNumber = headerNumber || null;
          current.push(line);
          continue;
        }

        if (headerNumber && currentNumber && headerNumber === currentNumber) {
          // cabeçalho repetido da mesma lei (por página)
          current.push(line);
          continue;
        }

        // novo autógrafo com número diferente: fecha seção anterior e inicia nova
        sections.push(current.join('\n').trim());
        current = [];
        currentNumber = headerNumber || null;
      }
      current.push(line);
    }

    if (current.length) {
      sections.push(current.join('\n').trim());
    }

    // Remove vazios
    const byHeader = sections.filter(s => s.length > 0);

    // Fallback: se só houver 0 ou 1 seção, tentar dividir por títulos de lei
    if (byHeader.length <= 1) {
      const titleCount = lines.reduce((acc, l) => {
        return acc + (
          this.PATTERNS.tituloLei.test(l) ||
          this.PATTERNS.tituloLeiComplementar.test(l) ||
          this.PATTERNS.tituloResolucao.test(l)
        ? 1 : 0);
      }, 0);
      if (titleCount > 1) {
        return this.splitByTitleSections(text);
      }
    }

    return byHeader;
  }

  // Novo: Divide texto em seções por cabeçalho customizável (fallback para AUTOGRAFO_HEADER)
  static splitByHeaderPattern(text: string, headerPattern?: string): string[] {
    const lines = text.split('\n');
    const sections: string[] = [];
    let current: string[] = [];
    let currentNumber: string | null = null;
    let regex: RegExp = this.AUTOGRAFO_HEADER;

    if (headerPattern) {
      try {
        regex = new RegExp(headerPattern, 'i');
      } catch {
        regex = this.AUTOGRAFO_HEADER;
      }
    }

    for (const line of lines) {
      const match = regex.exec(line);
      if (match) {
        const headerNumber = (match[1] || '').replace(/[^\d]/g, '');

        if (current.length === 0) {
          currentNumber = headerNumber || null;
          current.push(line);
          continue;
        }

        if (headerNumber && currentNumber && headerNumber === currentNumber) {
          current.push(line);
          continue;
        }

        sections.push(current.join('\n').trim());
        current = [];
        currentNumber = headerNumber || null;
      }
      current.push(line);
    }

    if (current.length) {
      sections.push(current.join('\n').trim());
    }
    // Fallback por títulos (Lei, Complementar, Resolução) quando não dividir bem por cabeçalho
    const byHeader = sections.filter(s => s.length > 0);
    if (byHeader.length <= 1) {
      const titleCount = lines.reduce((acc, l) => {
        return acc + (
          this.PATTERNS.tituloLei.test(l) ||
          this.PATTERNS.tituloLeiComplementar.test(l) ||
          this.PATTERNS.tituloResolucao.test(l)
        ? 1 : 0);
      }, 0);
      if (titleCount > 1) {
        return this.splitByTitleSections(text);
      }
    }
    return byHeader;
  }

  // Gera um padrão de cabeçalho simples a partir de um exemplo
  static generateHeaderPattern(sample: string): string {
    const s = (sample || '').toLowerCase();
    const hasComplementar = s.includes('complementar');
    const base = '^\\s*aut[óo]grafo(?:s)?\\s+de\\s+lei' + (hasComplementar ? '\\s+complementar' : '') + '.*';
    const hasN = /n[º°]?\s*\d/.test(s);
    const numCap = hasN ? 'n\\s*[^\\d]{0,6}\\s*([\\d.,\\/\\-]+)' : '([\\d.,\\/\\-]+)';
    return base + numCap;
  }

  // Divide o texto em seções iniciadas por títulos "LEI" ou "Lei Complementar"
  static splitByTitleSections(text: string): string[] {
    const lines = text.split('\n');
    const sections: string[] = [];
    let current: string[] = [];
    let started = false;

    for (const line of lines) {
      const isTitle = 
        this.PATTERNS.tituloLei.test(line) ||
        this.PATTERNS.tituloLeiComplementar.test(line) ||
        this.PATTERNS.tituloResolucao.test(line) ||
        this.PATTERNS.tituloDecretoLegislativo.test(line) ||
        this.PATTERNS.tituloProjetoLeiComplementar.test(line) ||
        this.PATTERNS.tituloProjetoEmendaLeiComplementar.test(line) ||
        this.PATTERNS.tituloEmendaLeiComplementar.test(line);
      if (isTitle) {
        if (started) {
          sections.push(current.join('\n').trim());
          current = [];
        }
        started = true;
      }
      current.push(line);
    }

    if (current.length) {
      sections.push(current.join('\n').trim());
    }

    return sections.filter(s => s.length > 0);
  }
}
