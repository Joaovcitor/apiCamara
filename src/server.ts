import dotenv from 'dotenv';
import app from './app';
import { logger } from './utils/logger';
import { PrismaClient } from '@prisma/client';

// Carregar variáveis de ambiente
dotenv.config();

const PORT = process.env['PORT'] || 3000;
const NODE_ENV = process.env['NODE_ENV'] || 'development';

// Instância do Prisma para verificação de conexão
const prisma = new PrismaClient();

async function startServer() {
  try {
    // Verificar conexão com o banco de dados
    await prisma.$connect();
    logger.info('Database connection established successfully');

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
      });

      // Log das rotas disponíveis em desenvolvimento
      if (NODE_ENV === 'development') {
        logger.info('Available endpoints:', {
          docs: `http://localhost:${PORT}/docs`,
          health: `http://localhost:${PORT}/api/health`,
          scrap: `http://localhost:${PORT}/api/scrap`,
          upload: `http://localhost:${PORT}/api/upload`,
          leis: `http://localhost:${PORT}/api/leis`,
        });
      }
    });

    // Configurar timeout do servidor
    server.timeout = 300000; // 5 minutos para operações pesadas

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during database disconnection', { error });
          process.exit(1);
        }
      });

      // Forçar saída após 30 segundos
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Iniciar servidor
startServer();