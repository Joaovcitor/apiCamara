import { Router } from 'express';
import { ScrapingController } from '../controllers/scrapingController';
import { UploadController } from '../controllers/uploadController';
import { LeiController } from '../controllers/leiController';
import { CategoryController } from '../controllers/categoryController';
import { AuthController } from '../controllers/authController';
import { UserController } from '../controllers/userController';
import { requireAuth, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { scrapingSchema, paginationSchema, leiIdSchema, leiCreateSchema, leiUpdateSchema } from '../utils/validation';
import { 
  uploadSingle, 
  uploadMultiple, 
  validateUpload, 
  handleMulterError 
} from '../middlewares/upload';

const router = Router();

// Instanciar controllers
const scrapingController = new ScrapingController();
const uploadController = new UploadController();
const leiController = new LeiController();
const categoryController = new CategoryController();
const authController = new AuthController();
const userController = new UserController();

// ===== ROTAS DE SCRAPING =====

/**
 * POST /scrap - Scraping de uma URL específica
 */
router.post(
  '/scrap',
  validate(scrapingSchema, 'body'),
  scrapingController.scrapLei
);

/**
 * POST /scrap/batch - Scraping de múltiplas URLs
 */
router.post(
  '/scrap/batch',
  scrapingController.scrapBatch
);

/**
 * POST /scrap/custom - Scraping com seletores customizados
 */
router.post(
  '/scrap/custom',
  scrapingController.scrapCustom
);

/**
 * POST /scrap/links - Listar links a partir de página índice
 */
router.post(
  '/scrap/links',
  scrapingController.listLinks
);

// ===== ROTAS DE UPLOAD =====

/**
 * POST /upload - Upload de um arquivo Word
 */
router.post(
  '/upload',
  uploadSingle,
  handleMulterError,
  validateUpload,
  uploadController.uploadSingle
);

/**
 * POST /upload/split - Upload de um arquivo Word com divisão por cabeçalho
 */
router.post(
  '/upload/split',
  uploadSingle,
  handleMulterError,
  validateUpload,
  uploadController.uploadSplit
);

/**
 * POST /upload/batch - Upload de múltiplos arquivos Word
 */
router.post(
  '/upload/batch',
  uploadMultiple,
  handleMulterError,
  validateUpload,
  uploadController.uploadBatch
);

/**
 * POST /upload/validate - Validação de arquivo sem processamento
 */
router.post(
  '/upload/validate',
  uploadSingle,
  handleMulterError,
  validateUpload,
  uploadController.validateFile
);

// ===== ROTAS DE LEIS =====

// ===== ROTAS DE AUTENTICAÇÃO =====
router.post('/auth/login', authController.login);
router.get('/auth/me', requireAuth, authController.me);

// ===== ROTAS DE USUÁRIOS (ADMIN) =====
router.get('/users', requireAuth, requireRole('admin'), userController.list);
router.get('/users/:id', requireAuth, requireRole('admin'), userController.getById);
router.post('/users', requireAuth, requireRole('admin'), userController.create);
router.patch('/users/:id', requireAuth, requireRole('admin'), userController.update);
router.delete('/users/:id', requireAuth, requireRole('admin'), userController.delete);

/**
 * GET /leis - Listar leis com paginação e filtros
 */
router.get(
  '/leis',
  validate(paginationSchema.partial(), 'query'),
  leiController.listLeis
);

/**
 * GET /leis/stats - Estatísticas das leis
 */
router.get(
  '/leis/stats',
  leiController.getStats
);

/**
 * GET /leis/:id - Obter lei por ID
 */
router.get(
  '/leis/:id',
  validate(leiIdSchema, 'params'),
  leiController.getLeiById
);

/**
 * GET /leis/:id/export - Exportar lei em formato específico
 */
router.get(
  '/leis/:id/export',
  validate(leiIdSchema, 'params'),
  leiController.exportLei
);
/**
 * POST /leis/:id/categorize - Categorizar lei com dicionário de categorias
 */
router.post(
  '/leis/:id/categorize',
  validate(leiIdSchema, 'params'),
  leiController.categorize
);
/**
 * DELETE /leis/:id - Remover lei
 */
router.delete(
  '/leis/:id',
  requireAuth,
  requireRole('funcionario'),
  validate(leiIdSchema, 'params'),
  leiController.deleteLei
);

// Criação de lei (com estrutura completa)
router.post(
  '/leis',
  requireAuth,
  requireRole('funcionario'),
  validate(leiCreateSchema, 'body'),
  leiController.createLei
);

// Substituição completa (PUT) de uma lei
router.put(
  '/leis/:id',
  requireAuth,
  requireRole('funcionario'),
  validate(leiIdSchema, 'params'),
  validate(leiCreateSchema, 'body'),
  leiController.replaceLei
);

// Atualização parcial (PATCH) de campos da lei
router.patch(
  '/leis/:id',
  requireAuth,
  requireRole('funcionario'),
  validate(leiIdSchema, 'params'),
  validate(leiUpdateSchema, 'body'),
  leiController.updateLei
);

// ===== ROTAS DE CATEGORIAS =====
router.get('/categorias', categoryController.list);
router.get('/categorias/dicionario', categoryController.dictionary);
router.post('/categorias', categoryController.create);
router.post('/categorias/:id/keywords', categoryController.addKeywords);

// ===== ROTA DE HEALTH CHECK =====

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verifica o status da API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API funcionando corretamente
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
 *                   example: "API funcionando corretamente"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] || '1.0.0',
  });
});

// ===== ROTA 404 =====
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
  });
});

export default router;