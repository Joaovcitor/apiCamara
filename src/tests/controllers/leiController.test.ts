import request from 'supertest';
import express from 'express';
import { LeiController } from '../../controllers/leiController';
import { LeiService } from '../../services/leiService';

// Mock do LeiService
jest.mock('../../services/leiService');

const app = express();
app.use(express.json());

// Setup das rotas para teste
const leiController = new LeiController();
app.get('/leis', leiController.listLeis);
app.get('/leis/stats', leiController.getStats);
app.get('/leis/:id', leiController.getLeiById);
app.delete('/leis/:id', leiController.deleteLei);
app.get('/leis/:id/export', leiController.exportLei);

describe('LeiController', () => {
  let mockLeiService: jest.Mocked<LeiService>;

  beforeEach(() => {
    mockLeiService = new LeiService() as jest.Mocked<LeiService>;
    (leiController as any).leiService = mockLeiService;
    jest.clearAllMocks();
  });

  describe('GET /leis', () => {
    it('deve listar leis com paginação padrão', async () => {
      const mockResponse = {
        items: [
          {
            id: 'lei-1',
            titulo: 'Lei de Teste',
            numero: '1',
            data: new Date('2023-01-01'),
            ementa: 'Ementa de teste',
            origem: 'scraping',
            criadoEm: new Date(),
            atualizadoEm: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockLeiService.listLeis.mockResolvedValue(mockResponse);

      const response = await request(app).get('/leis').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockLeiService.listLeis).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        {}
      );
    });

    it('deve listar leis com parâmetros de paginação customizados', async () => {
      const mockResponse = {
        items: [],
        pagination: {
          page: 2,
          limit: 5,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: true,
        },
      };

      mockLeiService.listLeis.mockResolvedValue(mockResponse);

      await request(app).get('/leis?page=2&limit=5').expect(200);

      expect(mockLeiService.listLeis).toHaveBeenCalledWith(
        { page: 2, limit: 5 },
        {}
      );
    });

    it('deve buscar leis com termo de pesquisa', async () => {
      const mockResponse = {
        items: [
          {
            id: 'lei-1',
            titulo: 'Lei da Saúde',
            numero: '8080',
            data: new Date(),
            ementa: 'Lei sobre saúde pública',
            origem: 'scraping',
            criadoEm: new Date(),
            atualizadoEm: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockLeiService.searchLeis.mockResolvedValue(mockResponse);

      await request(app).get('/leis?search=saúde').expect(200);

      expect(mockLeiService.searchLeis).toHaveBeenCalledWith('saúde', {
        page: 1,
        limit: 10,
      });
    });

    it('deve aplicar filtro por origem', async () => {
      const mockResponse = {
        items: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockLeiService.listLeis.mockResolvedValue(mockResponse);

      await request(app).get('/leis?origem=scraping').expect(200);

      expect(mockLeiService.listLeis).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        { origem: 'scraping' }
      );
    });
  });

  describe('GET /leis/:id', () => {
    it('deve retornar uma lei específica', async () => {
      const mockLei = {
        id: 'lei-123',
        titulo: 'Lei nº 8.080',
        numero: '8.080',
        data: new Date('1990-09-19'),
        ementa: 'Dispõe sobre a saúde',
        origem: 'scraping',
        textoCompleto: 'Texto completo da lei...',
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        artigos: [],
      };

      mockLeiService.getLeiById.mockResolvedValue(mockLei);

      const response = await request(app).get('/leis/lei-123').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLei);
      expect(mockLeiService.getLeiById).toHaveBeenCalledWith('lei-123');
    });

    it('deve retornar 404 para lei não encontrada', async () => {
      mockLeiService.getLeiById.mockResolvedValue(null);

      const response = await request(app)
        .get('/leis/lei-inexistente')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Lei não encontrada');
    });
  });

  describe('DELETE /leis/:id', () => {
    it('deve deletar uma lei existente', async () => {
      mockLeiService.deleteLei.mockResolvedValue(true);

      const response = await request(app).delete('/leis/lei-123').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Lei removida com sucesso');
      expect(mockLeiService.deleteLei).toHaveBeenCalledWith('lei-123');
    });

    it('deve retornar 404 para lei não encontrada', async () => {
      mockLeiService.deleteLei.mockResolvedValue(false);

      const response = await request(app)
        .delete('/leis/lei-inexistente')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Lei não encontrada');
    });
  });

  describe('GET /leis/stats', () => {
    it('deve retornar estatísticas das leis', async () => {
      const mockStats = {
        total: 10,
        porOrigem: {
          scraping: 7,
          upload: 3,
        },
        ultimasAdicionadas: [
          {
            id: 'lei-1',
            titulo: 'Lei Recente',
            numero: '1',
            data: new Date(),
            ementa: 'Ementa',
            origem: 'scraping',
            criadoEm: new Date(),
            atualizadoEm: new Date(),
          },
        ],
      };

      mockLeiService.getStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/leis/stats').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockLeiService.getStats).toHaveBeenCalled();
    });
  });

  describe('GET /leis/:id/export', () => {
    const mockLei = {
      id: 'lei-123',
      titulo: 'Lei nº 8.080',
      numero: '8.080',
      data: new Date('1990-09-19'),
      ementa: 'Dispõe sobre a saúde',
      origem: 'scraping',
      textoCompleto: 'Texto completo da lei...',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      artigos: [],
    };

    it('deve exportar lei em formato JSON (padrão)', async () => {
      mockLeiService.getLeiById.mockResolvedValue(mockLei);

      const response = await request(app)
        .get('/leis/lei-123/export')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toEqual(mockLei);
    });

    it('deve exportar lei em formato texto', async () => {
      mockLeiService.getLeiById.mockResolvedValue(mockLei);

      const response = await request(app)
        .get('/leis/lei-123/export?format=text')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain(mockLei.titulo);
      expect(response.text).toContain(mockLei.textoCompleto);
    });

    it('deve retornar 404 para lei não encontrada na exportação', async () => {
      mockLeiService.getLeiById.mockResolvedValue(null);

      const response = await request(app)
        .get('/leis/lei-inexistente/export')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Lei não encontrada');
    });
  });
});
