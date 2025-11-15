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

  /**
   * @swagger
   * /leis:
   *   get:
   *     summary: Lista todas as leis com paginação
   *     tags: [Leis]
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Número de itens por página
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Termo de busca (título, ementa ou número)
   *       - in: query
   *         name: origem
   *         schema:
   *           type: string
   *           enum: [scraping, upload]
   *         description: Filtrar por origem
   *     responses:
   *       200:
   *         description: Lista de leis
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
   *                     items:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/LeiSummary'
   *                     pagination:
   *                       $ref: '#/components/schemas/Pagination'
   *                 message:
   *                   type: string
   */
  listLeis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, search, origem } = req.query as any;
    
    const paginationParams: PaginationParams = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100), // Máximo 100 itens por página
    };

    logger.info('List leis request', { 
      page: paginationParams.page, 
      limit: paginationParams.limit,
      search,
      origem 
    });

    let result;

    if (search) {
      // Busca com termo
      result = await this.leiService.searchLeis(search as string, paginationParams);
    } else {
      // Listagem normal com filtros opcionais
      const filters: any = {};
      if (origem) {
        filters.origem = origem;
      }
      result = await this.leiService.getLeis(paginationParams);
    }

    const response: ApiResponse<PaginatedResponse<LeiWithRelations>> = {
      success: true,
      data: result,
      message: `${result.data.length} leis encontradas`,
    };

    res.status(200).json(response);
  });

  /**
   * @swagger
   * /leis/{id}:
   *   get:
   *     summary: Recupera uma lei específica com toda sua estrutura
   *     tags: [Leis]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da lei (CUID)
   *     responses:
   *       200:
   *         description: Lei encontrada
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
   *       404:
   *         description: Lei não encontrada
   */
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

    const response: ApiResponse = {
      success: true,
      data: lei,
      message: 'Lei recuperada com sucesso',
    };

    res.status(200).json(response);
  });

  /**
   * Cria uma nova lei com estrutura completa
   */
  createLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leiData = req.body;
    logger.info('Create lei request', { titulo: leiData?.titulo, numero: leiData?.numero });

    const saved = await this.leiService.saveLei(leiData);
    const response: ApiResponse = {
      success: true,
      data: saved,
      message: 'Lei criada com sucesso',
    };
    res.status(201).json(response);
  });

  /**
   * Atualiza parcialmente campos da lei (PATCH)
   */
  updateLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) throw new AppError('ID da lei é obrigatório', 400);

    const updated = await this.leiService.updateLei(id, req.body ?? {});
    const response: ApiResponse = {
      success: true,
      data: updated,
      message: 'Lei atualizada com sucesso',
    };
    res.status(200).json(response);
  });

  /**
   * Substitui completamente a lei (PUT) incluindo hierarquia
   */
  replaceLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) throw new AppError('ID da lei é obrigatório', 400);

    const replaced = await this.leiService.replaceLei(id, req.body);
    const response: ApiResponse = {
      success: true,
      data: replaced,
      message: 'Lei substituída com sucesso',
    };
    res.status(200).json(response);
  });

  /**
   * @swagger
   * /leis/{id}:
   *   delete:
   *     summary: Remove uma lei do banco de dados
   *     tags: [Leis]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da lei (CUID)
   *     responses:
   *       200:
   *         description: Lei removida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Lei removida com sucesso"
   *       404:
   *         description: Lei não encontrada
   */
  deleteLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new AppError('ID da lei é obrigatório', 400);
    }

    logger.info('Delete lei request', { id });

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

  /**
   * @swagger
   * /leis/stats:
   *   get:
   *     summary: Recupera estatísticas das leis no banco de dados
   *     tags: [Leis]
   *     responses:
   *       200:
   *         description: Estatísticas das leis
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
   *                     total:
   *                       type: number
   *                       description: Total de leis
   *                     porOrigem:
   *                       type: object
   *                       properties:
   *                         scraping:
   *                           type: number
   *                         upload:
   *                           type: number
   *                     ultimasAdicionadas:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/LeiSummary'
   *                 message:
   *                   type: string
   */
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

  /**
   * @swagger
   * /leis/{id}/categorize:
   *   post:
   *     summary: Categoriza uma lei com base em um dicionário de palavras-chave
   *     tags: [Leis]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               dictionary:
   *                 type: object
   *                 additionalProperties:
   *                   type: array
   *                   items: { type: string }
   *                 description: Dicionário de categorias → palavras-chave
   *               minScore:
   *                 type: number
   *                 default: 2
   *     responses:
   *       200:
   *         description: Categorias calculadas com sucesso
   */
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

  /**
   * @swagger
   * /leis/{id}/export:
   *   get:
   *     summary: Exporta uma lei em formato JSON estruturado
   *     tags: [Leis]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da lei (CUID)
   *       - in: query
   *         name: format
   *         schema:
   *           type: string
   *           enum: [json, text]
   *           default: json
   *         description: Formato de exportação
   *     responses:
   *       200:
   *         description: Lei exportada
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lei'
   *           text/plain:
   *             schema:
   *               type: string
   *       404:
   *         description: Lei não encontrada
   */
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
      // Exportar como texto simples
      let textContent = `${lei.titulo}\n\n`;
      if (lei.ementa) {
        textContent += `Ementa: ${lei.ementa}\n\n`;
      }
      textContent += lei.textoCompleto;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${lei.numero || 'lei'}.txt"`);
      res.send(textContent);
    } else {
      // Exportar como JSON (padrão)
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${lei.numero || 'lei'}.json"`);
      res.json(lei);
    }

    logger.info('Lei exported successfully', { id, format });
  });
}