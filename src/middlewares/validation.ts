import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler';

type ValidationTarget = 'body' | 'query' | 'params' | 'file';

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      let dataToValidate: unknown;

      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'file':
          dataToValidate = req.file;
          break;
        default:
          throw new AppError('Target de validação inválido', 500);
      }

      const validatedData = schema.parse(dataToValidate);

      // Substituir os dados originais pelos validados
      switch (target) {
        case 'body':
          req.body = validatedData;
          break;
        case 'query':
          req.query = validatedData as Record<string, string>;
          break;
        case 'params':
          req.params = validatedData as Record<string, string>;
          break;
        case 'file':
          // Para arquivos, apenas validamos, não substituímos
          break;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(new AppError('Erro na validação', 400));
      }
    }
  };
};

export const validateFile = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.file) {
    throw new AppError('Nenhum arquivo foi enviado', 400);
  }

  const allowedMimeTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    throw new AppError('Tipo de arquivo não suportado. Use .doc ou .docx', 400);
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    throw new AppError('Arquivo muito grande. Máximo permitido: 10MB', 400);
  }

  next();
};