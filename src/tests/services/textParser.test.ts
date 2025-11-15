import { TextParser } from '../../utils/textParser';

describe('TextParser', () => {
  let textParser: TextParser;

  beforeEach(() => {
    textParser = new TextParser();
  });

  describe('parseDate', () => {
    it('deve extrair data no formato brasileiro', () => {
      const text = 'Lei nº 8.080, de 19 de setembro de 1990';
      const date = textParser.parseDate(text);
      expect(date).toEqual(new Date('1990-09-19'));
    });

    it('deve extrair data no formato numérico', () => {
      const text = 'Publicada em 19/09/1990';
      const date = textParser.parseDate(text);
      expect(date).toEqual(new Date('1990-09-19'));
    });

    it('deve retornar null para texto sem data', () => {
      const text = 'Texto sem data válida';
      const date = textParser.parseDate(text);
      expect(date).toBeNull();
    });
  });

  describe('extractTitle', () => {
    it('deve extrair título de lei', () => {
      const text = 'LEI Nº 8.080, DE 19 DE SETEMBRO DE 1990\n\nDispõe sobre...';
      const title = textParser.extractTitle(text);
      expect(title).toBe('Lei nº 8.080, de 19 de setembro de 1990');
    });

    it('deve extrair título de decreto', () => {
      const text = 'DECRETO Nº 1.234, DE 15 DE JANEIRO DE 2020\n\nRegula...';
      const title = textParser.extractTitle(text);
      expect(title).toBe('Decreto nº 1.234, de 15 de janeiro de 2020');
    });

    it('deve retornar primeira linha se não encontrar padrão', () => {
      const text = 'Título Genérico\n\nConteúdo do documento...';
      const title = textParser.extractTitle(text);
      expect(title).toBe('Título Genérico');
    });
  });

  describe('extractNumber', () => {
    it('deve extrair número de lei', () => {
      const text = 'Lei nº 8.080, de 19 de setembro de 1990';
      const number = textParser.extractNumber(text);
      expect(number).toBe('8.080');
    });

    it('deve extrair número de decreto', () => {
      const text = 'Decreto nº 1.234/2020';
      const number = textParser.extractNumber(text);
      expect(number).toBe('1.234');
    });

    it('deve retornar null se não encontrar número', () => {
      const text = 'Documento sem número';
      const number = textParser.extractNumber(text);
      expect(number).toBeNull();
    });
  });

  describe('parseHierarchicalText', () => {
    it('deve parsear texto com estrutura hierárquica completa', () => {
      const text = `
        LEI Nº 8.080, DE 19 DE SETEMBRO DE 1990
        
        Dispõe sobre as condições para a promoção, proteção e recuperação da saúde.
        
        Art. 1º Esta lei regula, em todo o território nacional, as ações e serviços de saúde.
        
        § 1º Entende-se por saúde um estado de completo bem-estar físico, mental e social.
        
        I - a promoção da saúde;
        II - a prevenção de doenças;
        
        a) ações de vigilância sanitária;
        b) ações de vigilância epidemiológica;
        
        1. controle de vetores;
        2. controle de reservatórios;
        
        Art. 2º A saúde é um direito fundamental do ser humano.
      `;

      const result = textParser.parseHierarchicalText(text);

      expect(result.titulo).toBe('Lei nº 8.080, de 19 de setembro de 1990');
      expect(result.numero).toBe('8.080');
      expect(result.data).toEqual(new Date('1990-09-19'));
      expect(result.ementa).toContain('Dispõe sobre as condições');
      expect(result.artigos).toHaveLength(2);

      // Verificar primeiro artigo
      const artigo1 = result.artigos[0];
      expect(artigo1.numero).toBe('Art. 1º');
      expect(artigo1.texto).toContain('Esta lei regula');
      expect(artigo1.paragrafos).toHaveLength(1);

      // Verificar parágrafo
      const paragrafo1 = artigo1.paragrafos[0];
      expect(paragrafo1.numero).toBe('§ 1º');
      expect(paragrafo1.incisos).toHaveLength(2);

      // Verificar inciso
      const inciso1 = paragrafo1.incisos[0];
      expect(inciso1.numero).toBe('I');
      expect(inciso1.alineas).toHaveLength(2);

      // Verificar alínea
      const alinea1 = inciso1.alineas[0];
      expect(alinea1.numero).toBe('a)');
      expect(alinea1.itens).toHaveLength(2);

      // Verificar item
      const item1 = alinea1.itens[0];
      expect(item1.numero).toBe('1.');
      expect(item1.texto).toContain('controle de vetores');
    });

    it('deve parsear texto simples sem hierarquia', () => {
      const text = `
        LEI Nº 1.000, DE 1º DE JANEIRO DE 2000
        
        Institui o Dia Nacional da Paz.
        
        Art. 1º Fica instituído o Dia Nacional da Paz.
        
        Art. 2º Esta lei entra em vigor na data de sua publicação.
      `;

      const result = textParser.parseHierarchicalText(text);

      expect(result.titulo).toBe('Lei nº 1.000, de 1º de janeiro de 2000');
      expect(result.artigos).toHaveLength(2);
      expect(result.artigos[0].paragrafos).toHaveLength(0);
      expect(result.artigos[1].paragrafos).toHaveLength(0);
    });

    it('deve lidar com texto malformado graciosamente', () => {
      const text = 'Texto sem estrutura jurídica válida';

      const result = textParser.parseHierarchicalText(text);

      expect(result.titulo).toBe('Texto sem estrutura jurídica válida');
      expect(result.numero).toBeNull();
      expect(result.data).toBeNull();
      expect(result.ementa).toBeNull();
      expect(result.artigos).toHaveLength(0);
    });
  });

  describe('Regex patterns', () => {
    it('deve identificar artigos corretamente', () => {
      const patterns = [
        'Art. 1º',
        'Art. 2°',
        'Art. 10',
        'Artigo 1º',
        'ARTIGO 1º',
      ];

      patterns.forEach(pattern => {
        expect(pattern).toMatch(/^(Art\.|Artigo)\s*\d+[º°]?/i);
      });
    });

    it('deve identificar parágrafos corretamente', () => {
      const patterns = [
        '§ 1º',
        '§ 2°',
        '§ 10',
        'Parágrafo único',
        'PARÁGRAFO ÚNICO',
      ];

      patterns.forEach(pattern => {
        expect(pattern).toMatch(/^(§\s*\d+[º°]?|Parágrafo\s+único)/i);
      });
    });

    it('deve identificar incisos corretamente', () => {
      const patterns = [
        'I -',
        'II -',
        'III -',
        'IV -',
        'V -',
        'X -',
        'XX -',
      ];

      patterns.forEach(pattern => {
        expect(pattern).toMatch(/^[IVX]+\s*-/);
      });
    });

    it('deve identificar alíneas corretamente', () => {
      const patterns = [
        'a)',
        'b)',
        'z)',
        'a) ',
        'b) ',
      ];

      patterns.forEach(pattern => {
        expect(pattern).toMatch(/^[a-z]\)\s*/);
      });
    });

    it('deve identificar itens corretamente', () => {
      const patterns = [
        '1.',
        '2.',
        '10.',
        '1. ',
        '2. ',
      ];

      patterns.forEach(pattern => {
        expect(pattern).toMatch(/^\d+\.\s*/);
      });
    });
  });
});