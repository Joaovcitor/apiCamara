import { Request, Response } from 'express';
import { LeiService } from '../services/leiService';
import { PaginationParams, ApiResponse, PaginatedResponse, LeiWithRelations, CategoryDictionary } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middlewares/errorHandler';
import { AppError } from '../middlewares/errorHandler';
import { categorizeLei, defaultCategoryDictionary } from '../utils/categorizer';
import { CategoryService } from '../services/categoryService';

export class LeiController {
  private leiService: LeiService;
  private categoryService: CategoryService;

  constructor() {
    this.leiService = new LeiService();
    this.categoryService = new CategoryService();
  }

  listLeis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, search, origem } = req.query as any;
    const municipioId = req.user?.municipioId;
    
    const paginationParams: PaginationParams = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100),
    };

    logger.info('List leis request', { 
      page: paginationParams.page, 
      limit: paginationParams.limit,
      search,
      origem,
      municipioId
    });

    let result;

    if (search) {
      result = await this.leiService.searchLeis(search as string, paginationParams, municipioId);
    } else {
      const filters: any = {};
      if (origem) {
        filters.origem = origem;
      }
      result = await this.leiService.getLeis(paginationParams, municipioId);
    }

    const response: ApiResponse<PaginatedResponse<LeiWithRelations>> = {
      success: true,
      data: result,
      message: `${result.data.length} leis encontradas`,
    };

    res.status(200).json(response);
  });

  listLeisByMunicipio = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;
    const { page = 1, limit = 10 } = req.query as any;
    
    const paginationParams: PaginationParams = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100),
    };

    logger.info('List leis by municipio request', { slug, page: paginationParams.page });

    const result = await this.leiService.getLeisByMunicipio(slug, paginationParams);

    const response: ApiResponse<PaginatedResponse<LeiWithRelations>> = {
      success: true,
      data: result,
      message: `${result.data.length} leis encontradas`,
    };

    res.status(200).json(response);
  });

  getLeiById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new AppError('ID da lei é obrigatório', 400);
    }

    logger.info('Get lei by ID request', { id });

    const lei = await this.leiService.getLeiById(id);

    if (!lei) {
      throw new AppError('Lei não encontrada', 404);
    }

    // Se usuário logado, verificar permissão de município
    if (req.user && req.user.municipioId && lei.municipioId && req.user.municipioId !== lei.municipioId) {
       // Se for admin global (sem municipioId), pode ver tudo? 
       // Assumindo que admin global não tem municipioId ou tem role especial.
       // Mas aqui estamos verificando se user TEM municipioId e é diferente.
       throw new AppError('Acesso negado a esta lei', 403);
    }

    const response: ApiResponse = {
      success: true,
      data: lei,
      message: 'Lei recuperada com sucesso',
    };

    res.status(200).json(response);
  });

  createLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leiData = req.body;
    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para criar leis', 400);
    }

    
    const saved = await this.leiService.saveLei(leiData, municipioId, usuarioId);
    logger.info('Create lei request', { titulo: leiData?.titulo, numero: leiData?.numero, municipioId });
    const response: ApiResponse = {
      success: true,
      data: saved,
      message: 'Lei criada com sucesso',
    };
    res.status(201).json(response);
  });

  updateLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) throw new AppError('ID da lei é obrigatório', 400);

    // TODO: Verificar permissão de município antes de atualizar

    const updated = await this.leiService.updateLei(id, req.body ?? {});
    const response: ApiResponse = {
      success: true,
      data: updated,
      message: 'Lei atualizada com sucesso',
    };
    res.status(200).json(response);
  });

  replaceLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) throw new AppError('ID da lei é obrigatório', 400);

    // TODO: Verificar permissão de município antes de substituir

    const replaced = await this.leiService.replaceLei(id, req.body);
    const response: ApiResponse = {
      success: true,
      data: replaced,
      message: 'Lei substituída com sucesso',
    };
    res.status(200).json(response);
  });

  deleteLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new AppError('ID da lei é obrigatório', 400);
    }

    logger.info('Delete lei request', { id });

    // TODO: Verificar permissão de município antes de deletar

    const deleted = await this.leiService.deleteLei(id);

    if (!deleted) {
      throw new AppError('Lei não encontrada', 404);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Lei removida com sucesso',
    };

    res.status(200).json(response);
  });

  getStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    logger.info('Get stats request');

    const stats = await this.leiService.getLeisStats();

    const response: ApiResponse = {
      success: true,
      data: stats,
      message: 'Estatísticas recuperadas com sucesso',
    };

    res.status(200).json(response);
  });

  categorize = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { dictionary, minScore }: { dictionary?: CategoryDictionary; minScore?: number } = req.body || {};

    if (!id) {
      throw new AppError('ID da lei é obrigatório', 400);
    }

    const lei = await this.leiService.getLeiById(id);
    if (!lei) {
      throw new AppError('Lei não encontrada', 404);
    }

    const dict = dictionary && typeof dictionary === 'object' ? dictionary : await this.categoryService.getDictionary().catch(() => defaultCategoryDictionary);
    const score = typeof minScore === 'number' ? minScore : 2;
    const categories = categorizeLei(lei as any, dict, score);

    const response: ApiResponse = {
      success: true,
      data: { id, categories, dictionary: dict },
      message: `${categories.length} categorias atribuídas`,
    };

    res.status(200).json(response);
  });

  exportLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { format = 'json' } = req.query as any;

    if (!id) {
      throw new AppError('ID da lei é obrigatório', 400);
    }

    logger.info('Export lei request', { id, format });

    const lei = await this.leiService.getLeiById(id);

    if (!lei) {
      throw new AppError('Lei não encontrada', 404);
    }

    if (format === 'text') {
      let textContent = `${lei.titulo}\n\n`;
      if (lei.ementa) {
        textContent += `Ementa: ${lei.ementa}\n\n`;
      }
      textContent += lei.textoCompleto;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${lei.numero || 'lei'}.txt"`);
      res.send(textContent);
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${lei.numero || 'lei'}.json"`);
      res.json(lei);
    }

    logger.info('Lei exported successfully', { id, format });
  });
}