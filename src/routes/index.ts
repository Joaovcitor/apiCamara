import { Router } from 'express';
import { ScrapingController } from '../controllers/scrapingController';
import { UploadController } from '../controllers/uploadController';
import { LeiController } from '../controllers/leiController';
import { CategoryController } from '../controllers/categoryController';
import { AuthController } from '../controllers/authController';
import { UserController } from '../controllers/userController';
import { MunicipioController } from '../controllers/municipioController';
import { requireAuth, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { scrapingSchema, paginationSchema, leiIdSchema, leiCreateSchema, leiUpdateSchema } from '../utils/validation';
import { 
  uploadSingle, 
  uploadMultiple, 
  uploadImages,
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
const municipioController = new MunicipioController();

// ===== ROTAS DE MUNICIPIOS (PUBLICAS/ADMIN) =====
router.get('/municipios', municipioController.list);
router.get('/municipios/:slug', municipioController.getBySlug);
router.get('/municipios/:slug/assets', municipioController.getAssetsBySlug); // Public access
router.get('/municipios/me/assets', requireAuth, municipioController.getMyAssets); // Authenticated user access
router.post('/municipios', requireAuth, requireRole('admin'), municipioController.create);
router.post('/municipios/assets', requireAuth, requireRole('admin'), uploadImages, handleMulterError, validateUpload, municipioController.uploadAssets);

// ===== ROTAS DE SCRAPING =====
router.post('/scrap', requireAuth, requireRole('funcionario'), validate(scrapingSchema, 'body'), scrapingController.scrapLei);
router.post('/scrap/batch', requireAuth, requireRole('funcionario'), scrapingController.scrapBatch);
router.post('/scrap/custom', requireAuth, requireRole('funcionario'), scrapingController.scrapCustom);
router.post('/scrap/links', requireAuth, requireRole('funcionario'), scrapingController.listLinks);

// ===== ROTAS DE UPLOAD =====
router.post('/upload', requireAuth, requireRole('funcionario'), uploadSingle, handleMulterError, validateUpload, uploadController.uploadSingle);
router.post('/upload/split', requireAuth, requireRole('funcionario'), uploadSingle, handleMulterError, validateUpload, uploadController.uploadSplit);
router.post('/upload/batch', requireAuth, requireRole('funcionario'), uploadMultiple, handleMulterError, validateUpload, uploadController.uploadBatch);
router.post('/upload/validate', requireAuth, requireRole('funcionario'), uploadSingle, handleMulterError, validateUpload, uploadController.validateFile);

// ===== ROTAS DE AUTENTICAÇÃO =====
router.post('/auth/login', authController.login);
router.get('/auth/me', requireAuth, authController.me);

// ===== ROTAS DE USUÁRIOS (ADMIN) =====
router.get('/users', requireAuth, requireRole('admin'), userController.list);
router.get('/users/:id', requireAuth, requireRole('admin'), userController.getById);
router.post('/users', requireAuth, requireRole('admin'), userController.create);
router.patch('/users/:id', requireAuth, requireRole('admin'), userController.update);
router.delete('/users/:id', requireAuth, requireRole('admin'), userController.delete);

// ===== ROTAS DE LEIS (PUBLICAS POR MUNICIPIO) =====
router.get('/leis/:slug', validate(paginationSchema.partial(), 'query'), leiController.listLeisByMunicipio);
router.get('/leis/:slug/:id', validate(leiIdSchema, 'params'), leiController.getLeiById);

// ===== ROTAS DE LEIS (GERENCIAMENTO) =====
router.get('/leis', requireAuth, validate(paginationSchema.partial(), 'query'), leiController.listLeis);
router.get('/leis/stats', leiController.getStats);
router.get('/leis/:id', validate(leiIdSchema, 'params'), leiController.getLeiById);
router.get('/leis/:id/export', validate(leiIdSchema, 'params'), leiController.exportLei);
router.post('/leis/:id/categorize', validate(leiIdSchema, 'params'), leiController.categorize);

router.post('/leis', requireAuth, requireRole('funcionario'), validate(leiCreateSchema, 'body'), leiController.createLei);
router.put('/leis/:id', requireAuth, requireRole('funcionario'), validate(leiIdSchema, 'params'), validate(leiCreateSchema, 'body'), leiController.replaceLei);
router.patch('/leis/:id', requireAuth, requireRole('funcionario'), validate(leiIdSchema, 'params'), validate(leiUpdateSchema, 'body'), leiController.updateLei);
router.delete('/leis/:id', requireAuth, requireRole('funcionario'), validate(leiIdSchema, 'params'), leiController.deleteLei);

// ===== ROTAS DE CATEGORIAS =====
router.get('/categorias', categoryController.list);
router.get('/categorias/dicionario', categoryController.dictionary);
router.post('/categorias', categoryController.create);
router.post('/categorias/:id/keywords', categoryController.addKeywords);

// ===== ROTA DE HEALTH CHECK =====
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