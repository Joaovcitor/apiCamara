import { 
  scrapingSchema, 
  paginationSchema, 
  leiIdSchema, 
  uploadFileSchema 
} from '../../utils/validation';

describe('Validation Schemas', () => {
  describe('scrapingSchema', () => {
    it('deve validar URLs de sites suportados', () => {
      const validUrls = [
        'https://www.planalto.gov.br/ccivil_03/leis/l8080.htm',
        'https://www2.camara.leg.br/legin/fed/lei/1990/lei-8080-19-setembro-1990-365093-publicacaooriginal-1-pl.html',
        'https://www25.senado.leg.br/web/atividade/legislacao/-/legislacao/123456',
        'http://diariomunicipal.org/lei/123',
      ];

      validUrls.forEach(url => {
        const result = scrapingSchema.safeParse({ url });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.url).toBe(url);
        }
      });
    });

    it('deve rejeitar URLs de sites não suportados', () => {
      const invalidUrls = [
        'https://www.google.com',
        'https://www.facebook.com/page',
        'https://example.com/lei',
        'ftp://planalto.gov.br/lei',
        'not-a-url',
        '',
      ];

      invalidUrls.forEach(url => {
        const result = scrapingSchema.safeParse({ url });
        expect(result.success).toBe(false);
      });
    });

    it('deve rejeitar URLs malformadas', () => {
      const malformedUrls = [
        'http://',
        'https://',
        'planalto.gov.br',
        'www.planalto.gov.br',
      ];

      malformedUrls.forEach(url => {
        const result = scrapingSchema.safeParse({ url });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('paginationSchema', () => {
    it('deve validar parâmetros de paginação válidos', () => {
      const validParams = [
        { page: 1, limit: 10 },
        { page: 5, limit: 50 },
        { page: 100, limit: 100 },
        { page: '1', limit: '10' }, // Strings que podem ser convertidas
      ];

      validParams.forEach(params => {
        const result = paginationSchema.safeParse(params);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(typeof result.data.page).toBe('number');
          expect(typeof result.data.limit).toBe('number');
          expect(result.data.page).toBeGreaterThan(0);
          expect(result.data.limit).toBeGreaterThan(0);
          expect(result.data.limit).toBeLessThanOrEqual(100);
        }
      });
    });

    it('deve aplicar valores padrão quando não fornecidos', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('deve rejeitar valores inválidos', () => {
      const invalidParams = [
        { page: 0, limit: 10 },
        { page: -1, limit: 10 },
        { page: 1, limit: 0 },
        { page: 1, limit: -5 },
        { page: 1, limit: 101 }, // Acima do máximo
        { page: 'abc', limit: 10 },
        { page: 1, limit: 'xyz' },
      ];

      invalidParams.forEach(params => {
        const result = paginationSchema.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('leiIdSchema', () => {
    it('deve validar IDs CUID válidos', () => {
      const validIds = [
        'cl9ebqhxk00008eqt33r9yubh',
        'ckx1234567890abcdefghijkl',
        'cm0123456789abcdefghijklm',
      ];

      validIds.forEach(id => {
        const result = leiIdSchema.safeParse({ id });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(id);
        }
      });
    });

    it('deve rejeitar IDs inválidos', () => {
      const invalidIds = [
        '',
        '123',
        'short-id',
        'this-is-way-too-long-to-be-a-valid-cuid-identifier',
        'invalid@characters!',
        'UPPERCASE-NOT-ALLOWED',
      ];

      invalidIds.forEach(id => {
        const result = leiIdSchema.safeParse({ id });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('uploadFileSchema', () => {
    const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'document.docx',
      encoding: '7bit',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('mock file content'),
      destination: '',
      filename: '',
      path: '',
      stream: {} as any,
      ...overrides,
    });

    it('deve validar arquivos Word válidos', () => {
      const validFiles = [
        createMockFile({
          originalname: 'document.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
        createMockFile({
          originalname: 'old-document.doc',
          mimetype: 'application/msword',
        }),
        createMockFile({
          originalname: 'file.DOCX', // Extensão em maiúscula
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ];

      validFiles.forEach(file => {
        const result = uploadFileSchema.safeParse(file);
        expect(result.success).toBe(true);
      });
    });

    it('deve rejeitar arquivos com extensões inválidas', () => {
      const invalidFiles = [
        createMockFile({
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
        }),
        createMockFile({
          originalname: 'document.txt',
          mimetype: 'text/plain',
        }),
        createMockFile({
          originalname: 'document.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        createMockFile({
          originalname: 'no-extension',
          mimetype: 'application/octet-stream',
        }),
      ];

      invalidFiles.forEach(file => {
        const result = uploadFileSchema.safeParse(file);
        expect(result.success).toBe(false);
      });
    });

    it('deve rejeitar arquivos muito grandes', () => {
      const largeFile = createMockFile({
        size: 11 * 1024 * 1024, // 11MB (acima do limite de 10MB)
      });

      const result = uploadFileSchema.safeParse(largeFile);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar arquivos sem buffer', () => {
      const fileWithoutBuffer = createMockFile({
        buffer: undefined as any,
      });

      const result = uploadFileSchema.safeParse(fileWithoutBuffer);
      expect(result.success).toBe(false);
    });

    it('deve rejeitar MIME types inválidos', () => {
      const invalidMimeTypes = [
        'application/pdf',
        'text/plain',
        'image/jpeg',
        'application/json',
        'video/mp4',
      ];

      invalidMimeTypes.forEach(mimetype => {
        const file = createMockFile({
          originalname: 'document.docx',
          mimetype,
        });

        const result = uploadFileSchema.safeParse(file);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Schema integration', () => {
    it('deve funcionar com dados parciais usando .partial()', () => {
      const partialPagination = paginationSchema.partial();
      
      const validPartials = [
        {},
        { page: 2 },
        { limit: 20 },
        { page: 3, limit: 15 },
      ];

      validPartials.forEach(partial => {
        const result = partialPagination.safeParse(partial);
        expect(result.success).toBe(true);
      });
    });

    it('deve manter validações mesmo com .partial()', () => {
      const partialPagination = paginationSchema.partial();
      
      const invalidPartials = [
        { page: 0 },
        { limit: -1 },
        { page: 'invalid' },
        { limit: 101 },
      ];

      invalidPartials.forEach(partial => {
        const result = partialPagination.safeParse(partial);
        expect(result.success).toBe(false);
      });
    });
  });
});