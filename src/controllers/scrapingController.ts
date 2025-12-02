import { Request, Response } from 'express';
import { ScrapingService } from '../services/scrapingService';
import { LeiService } from '../services/leiService';
import { ScrapingInput } from '../utils/validation';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { asyncHandler, AppError } from '../middlewares/errorHandler';

export class ScrapingController {
  private scrapingService: ScrapingService;
  private leiService: LeiService;

  constructor() {
    this.scrapingService = new ScrapingService();
    this.leiService = new LeiService();
  }

  /**
   * @swagger
   * /scrap:
   *   post:
   *     summary: Realiza scraping de leis a partir de uma URL
   *     tags: [Scraping]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - url
   *             properties:
   *               url:
   *                 type: string
   *                 format: uri
   *                 description: URL de um site oficial brasileiro
   *                 example: "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
   *     responses:
   *       200:
   *         description: Scraping realizado com sucesso
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
   *                   example: "Lei extraída e salva com sucesso"
   *       400:
   *         description: URL inválida ou site não suportado
   *       408:
   *         description: Timeout na requisição
   *       502:
   *         description: Erro de conexão com o servidor externo
   */
  scrapLei = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url }: ScrapingInput = req.body;
    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para realizar scraping', 400);
    }

    logger.info('Scraping request received', { url, municipioId });

    const scrapingResult = await this.scrapingService.scrapeLei(url);

    if (!scrapingResult.success || !scrapingResult.data) {
      const response: ApiResponse = {
        success: false,
        error: scrapingResult.error || 'Falha no scraping',
      };
      const errMsg = (scrapingResult.error || '').toLowerCase();
      if (errMsg.includes('timeout')) {
        res.status(408).json(response);
        return;
      }
      if (errMsg.includes('enotfound') || errMsg.includes('econnrefused') || errMsg.includes('erro de conexão')) {
        res.status(502).json(response);
        return;
      }
      if (errMsg.includes('site não suportado')) {
        res.status(400).json(response);
        return;
      }
      res.status(500).json(response);
      return;
    }

    // Salvar no banco de dados
    const savedLei = await this.leiService.saveLei(scrapingResult.data, municipioId, usuarioId);

    const response: ApiResponse = {
      success: true,
      data: savedLei,
      message: 'Lei extraída e salva com sucesso',
    };

    logger.info('Scraping completed successfully', { 
      url, 
      leiId: savedLei.id,
      titulo: savedLei.titulo 
    });

    res.status(200).json(response);
  });

  /**
   * @swagger
   * /scrap/batch:
   *   post:
   *     summary: Realiza scraping de múltiplas URLs
   *     tags: [Scraping]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - urls
   *             properties:
   *               urls:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: uri
   *                 maxItems: 10
   *                 description: Lista de URLs (máximo 10)
   *                 example: 
   *                   - "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
   *                   - "https://www.planalto.gov.br/ccivil_03/leis/l9394.htm"
   *     responses:
   *       200:
   *         description: Scraping em lote realizado
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
   *                           url:
   *                             type: string
   *                           error:
   *                             type: string
   *                 message:
   *                   type: string
   */
  scrapBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { urls }: { urls: string[] } = req.body;
    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para realizar scraping', 400);
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Lista de URLs é obrigatória',
      };
      res.status(400).json(response);
      return;
    }

    if (urls.length > 10) {
      const response: ApiResponse = {
        success: false,
        error: 'Máximo de 10 URLs por requisição',
      };
      res.status(400).json(response);
      return;
    }

    logger.info('Batch scraping request received', { count: urls.length, municipioId });

    const successful: any[] = [];
    const failed: Array<{ url: string; error: string }> = [];

    // Processar URLs em paralelo com limite de concorrência
    const maxConcurrent = 3;
    const chunks = this.chunkArray(urls, maxConcurrent);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (url: string) => {
        try {
          const scrapingResult = await this.scrapingService.scrapeLei(url);
          if (scrapingResult.success && scrapingResult.data) {
            const savedLei = await this.leiService.saveLei(scrapingResult.data, municipioId, usuarioId);
            successful.push(savedLei);
          } else {
            failed.push({ url, error: scrapingResult.error || 'Falha no scraping' });
          }
        } catch (error) {
          failed.push({ url, error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }
      });

      await Promise.all(chunkPromises);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        successful,
        failed,
      },
      message: `Processadas ${urls.length} URLs. ${successful.length} sucessos, ${failed.length} falhas.`,
    };

    logger.info('Batch scraping completed', { 
      total: urls.length,
      successful: successful.length, 
      failed: failed.length 
    });

    res.status(200).json(response);
  });

  /**
   * @swagger
   * /scrap/custom:
   *   post:
   *     summary: Scraping configurável usando seletores fornecidos pelo cliente
   *     tags: [Scraping]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url, selectors]
   *             properties:
   *               url:
   *                 type: string
   *                 format: uri
   *                 example: "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
   *               selectors:
   *                 type: object
   *                 properties:
   *                   title:
   *                     type: array
   *                     items: { type: string }
   *                   ementa:
   *                     type: array
   *                     items: { type: string }
   *                   content:
   *                     type: array
   *                     items: { type: string }
   *     responses:
   *       200:
   *         description: Lei extraída com sucesso usando seletores customizados
   */
  scrapCustom = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url, selectors } = req.body || {};
    const municipioId = req.user?.municipioId;
    const usuarioId = req.user?.id;

    if (!municipioId || !usuarioId) {
      throw new AppError('Usuário deve estar vinculado a um município para realizar scraping', 400);
    }

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'Campo url é obrigatório' });
      return;
    }
    if (!selectors || !Array.isArray(selectors.content) || selectors.content.length === 0) {
      res.status(400).json({ success: false, error: 'Seletores de conteúdo são obrigatórios' });
      return;
    }

    logger.info('Custom scraping request', { url, municipioId });
    const result = await this.scrapingService.scrapeWithSelectors(url, selectors);
    if (result.success && result.data) {
      const saved = await this.leiService.saveLei(result.data, municipioId, usuarioId);
      res.status(200).json({ success: true, data: saved, message: 'Lei extraída e salva com seletores customizados' });
    } else {
      res.status(502).json({ success: false, error: result.error || 'Falha no scraping custom' });
    }
  });

  /**
   * @swagger
   * /scrap/links:
   *   post:
   *     summary: Lista links de leis a partir de uma página índice
   *     tags: [Scraping]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url, selectors]
   *             properties:
   *               url:
   *                 type: string
   *                 format: uri
   *               selectors:
   *                 type: array
   *                 items: { type: string }
   *               hrefInclude:
   *                 type: string
   *                 description: Filtro de substring em href dos links
   *     responses:
   *       200:
   *         description: Lista de links encontrada
   */
  listLinks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url, selectors, hrefInclude } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'Campo url é obrigatório' });
      return;
    }
    if (!Array.isArray(selectors) || selectors.length === 0) {
      res.status(400).json({ success: false, error: 'selectors deve ser uma lista de seletores CSS' });
      return;
    }

    logger.info('List links request', { url, selectorsCount: selectors.length });
    const links = await this.scrapingService.listLinksFromPage(url, selectors, hrefInclude);
    res.status(200).json({ success: true, data: links, message: `${links.length} links encontrados` });
  });

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Cleanup method para fechar o browser quando necessário
  async cleanup(): Promise<void> {
    await this.scrapingService.closeBrowser();
    await this.leiService.disconnect();
  }
}
