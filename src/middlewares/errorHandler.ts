import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Erro interno do servidor';
  let details: unknown;

  // Log do erro
  logger.error('Error caught by error handler', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Tratamento específico para diferentes tipos de erro
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Dados de entrada inválidos';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
  } else if (error.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Erro de banco de dados';
    // Não expor detalhes do Prisma em produção
    if (process.env['NODE_ENV'] === 'development') {
      details = error.message;
    }
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'Erro no upload do arquivo';
    details = error.message;
  } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
    statusCode = 502;
    message = 'Erro de conexão com o servidor externo';
  } else if (error.message.includes('timeout')) {
    statusCode = 408;
    message = 'Timeout na requisição';
  }

  const response: ApiResponse = {
    success: false,
    error: message,
    ...(details ? { details } : {}),
  };

  // Em desenvolvimento, incluir stack trace
  if (process.env['NODE_ENV'] === 'development') {
    (response as any).stack = error.stack;
  }

  res.status(statusCode).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    error: `Rota ${req.method} ${req.path} não encontrada`,
  };

  res.status(404).json(response);
};