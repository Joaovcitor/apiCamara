import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';
import { ensureUploadDir, getUploadDir } from './utils/fileStorage';

const app = express();

// ===== MIDDLEWARES DE SEGURANÇA =====

// Helmet para headers de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS
// Configuração de CORS: permite localhost:8080 por padrão
const rawOrigins = process.env['CORS_ORIGIN'];
const allowedOrigins = (rawOrigins ? rawOrigins.split(',') : ['http://localhost:8080'])
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origem (ex.: ferramentas, curl, testes)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Bloqueia outras origens
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
}));

// Rate limiting geral
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env['NODE_ENV'] === 'production' ? 100 : 1000, // Limite por IP
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Rate limiting para operações pesadas (scraping e upload)
const heavyOperationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env['NODE_ENV'] === 'production' ? 20 : 100,
  message: {
    success: false,
    error: 'Limite de operações pesadas atingido. Tente novamente em 1 hora.',
  },
});

app.use(['/scrap', '/upload'], heavyOperationsLimiter);

// ===== MIDDLEWARES GERAIS =====

// Compressão de resposta
app.use(compression());

// Cookies
app.use(cookieParser());

// Parsing de JSON e URL encoded
app.use(express.json({ 
  limit: '10mb',
  verify: (_req: express.Request, res: express.Response, buf: Buffer) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      const response = {
        success: false,
        error: 'JSON inválido',
      };
      res.status(400).json(response);
      throw new Error('JSON inválido');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Logging de requisições
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
});

// ===== SERVIR ARQUIVOS DE UPLOAD =====
// Preparar pasta de uploads e servir estático em /files
ensureUploadDir()
  .then((dir) => logger.info('Upload directory ready', { dir }))
  .catch((err) => logger.error('Failed to prepare upload directory', { error: err.message }));

app.use('/files', express.static(getUploadDir()));

// ===== DOCUMENTAÇÃO SWAGGER =====

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Lei Scraper API - Documentação',
}));

// Redirect para documentação
app.get('/', (_req, res) => {
  res.redirect('/docs');
});

// ===== ROTAS PRINCIPAIS =====

app.use('/api', routes);

// ===== MIDDLEWARE DE ERRO GLOBAL =====

app.use(errorHandler);

// ===== TRATAMENTO DE SINAIS =====

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Tratamento de exceções não capturadas
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

export default app;