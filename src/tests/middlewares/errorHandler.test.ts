import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MulterError } from 'multer';
import { AppError, errorHandler, asyncHandler } from '../../middlewares/errorHandler';

// Mock do logger
jest.mock('../../utils/logger');

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('AppError', () => {
    it('deve criar um erro personalizado com status e mensagem', () => {
      const error = new AppError('Erro customizado', 400);
      
      expect(error.message).toBe('Erro customizado');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('deve usar status 500 como padrão', () => {
      const error = new AppError('Erro sem status');
      
      expect(error.statusCode).toBe(500);
    });
  });

  describe('errorHandler', () => {
    it('deve tratar AppError corretamente', () => {
      const error = new AppError('Erro de validação', 400);
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Erro de validação',
          statusCode: 400,
        },
      });
    });

    it('deve tratar ZodError corretamente', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['url'],
          message: 'Expected string, received number',
        },
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          path: ['name'],
          message: 'String must contain at least 1 character(s)',
        },
      ]);
      
      errorHandler(zodError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Dados de entrada inválidos',
          statusCode: 400,
          details: [
            {
              field: 'url',
              message: 'Expected string, received number',
            },
            {
              field: 'name',
              message: 'String must contain at least 1 character(s)',
            },
          ],
        },
      });
    });

    it('deve tratar PrismaClientKnownRequestError para registro não encontrado', () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        }
      );
      
      errorHandler(prismaError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Registro não encontrado',
          statusCode: 404,
        },
      });
    });

    it('deve tratar PrismaClientKnownRequestError para violação de constraint única', () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: {
            target: ['url'],
          },
        }
      );
      
      errorHandler(prismaError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Já existe um registro com estes dados: url',
          statusCode: 409,
        },
      });
    });

    it('deve tratar MulterError para arquivo muito grande', () => {
      const multerError = new MulterError('LIMIT_FILE_SIZE', 'file');
      
      errorHandler(multerError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Arquivo muito grande. Tamanho máximo permitido: 10MB',
          statusCode: 400,
        },
      });
    });

    it('deve tratar MulterError para muitos arquivos', () => {
      const multerError = new MulterError('LIMIT_FILE_COUNT', 'files');
      
      errorHandler(multerError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Muitos arquivos. Máximo permitido: 10 arquivos',
          statusCode: 400,
        },
      });
    });

    it('deve tratar MulterError para tipo de arquivo inválido', () => {
      const multerError = new MulterError('LIMIT_UNEXPECTED_FILE', 'file');
      
      errorHandler(multerError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Tipo de arquivo não permitido. Apenas arquivos .doc e .docx são aceitos',
          statusCode: 400,
        },
      });
    });

    it('deve tratar erros genéricos', () => {
      const genericError = new Error('Erro inesperado');
      
      errorHandler(genericError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Erro interno do servidor',
          statusCode: 500,
        },
      });
    });

    it('deve incluir stack trace em desenvolvimento', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Erro de teste');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Erro interno do servidor',
          statusCode: 500,
          stack: error.stack,
        },
      });
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('asyncHandler', () => {
    it('deve executar função assíncrona com sucesso', async () => {
      const mockHandler = jest.fn().mockResolvedValue('success');
      const wrappedHandler = asyncHandler(mockHandler);
      
      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('deve capturar erros assíncronos e chamar next', async () => {
      const error = new Error('Erro assíncrono');
      const mockHandler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = asyncHandler(mockHandler);
      
      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('deve capturar erros síncronos e chamar next', async () => {
      const error = new Error('Erro síncrono');
      const mockHandler = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedHandler = asyncHandler(mockHandler);
      
      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockHandler).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('deve preservar o contexto this', async () => {
      class TestController {
        value = 'test';
        
        async handler(req: Request, res: Response, next: NextFunction) {
          return this.value;
        }
      }
      
      const controller = new TestController();
      const wrappedHandler = asyncHandler(controller.handler.bind(controller));
      
      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error handling integration', () => {
    it('deve funcionar com asyncHandler + errorHandler', async () => {
      const appError = new AppError('Erro de teste', 400);
      const mockHandler = jest.fn().mockRejectedValue(appError);
      const wrappedHandler = asyncHandler(mockHandler);
      
      // Simula o fluxo completo
      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(appError);
      
      // Agora testa o errorHandler
      errorHandler(appError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Erro de teste',
          statusCode: 400,
        },
      });
    });
  });
});