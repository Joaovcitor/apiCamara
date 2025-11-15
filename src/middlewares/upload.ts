import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Armazenamento em memória
const storage = multer.memoryStorage();

// Filtro de arquivos: bloqueia temporários e valida extensão/MIME
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const lower = path.basename(file.originalname).toLowerCase();

  // Bloquear arquivos temporários/lock do Office/LibreOffice
  if (
    lower.startsWith('~$') ||
    lower.startsWith('.~lock') ||
    lower.endsWith('.docx#') ||
    lower.endsWith('.doc#')
  ) {
    cb(new AppError('Arquivo temporário do Office/LibreOffice não é permitido', 400));
    return;
  }

  // Validar extensão
  const allowedExtensions = ['.doc', '.docx'];
  const ext = path.extname(lower);
  if (!allowedExtensions.includes(ext)) {
    cb(new AppError('Apenas arquivos .doc e .docx são permitidos', 400));
    return;
  }

  // Validar MIME type
  const allowedMimeTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // fallback comum em alguns clientes
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new AppError('Tipo de arquivo não suportado', 400));
    return;
  }

  cb(null, true);
};

// Configuração do multer
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
});

// Exportar middlewares esperados pelas rotas
export const uploadSingle = uploadConfig.single('file');
export const uploadMultiple = uploadConfig.array('files', 10);

export const validateUpload = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const files = req.files as Express.Multer.File[] | undefined;
  const file = req.file as Express.Multer.File | undefined;

  if (!file && (!files || files.length === 0)) {
    throw new AppError('Nenhum arquivo foi enviado', 400);
  }

  if (files && files.length > 10) {
    throw new AppError('Máximo de 10 arquivos por requisição', 400);
  }

  if (files) {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const maxTotal = 50 * 1024 * 1024; // 50MB total
    if (totalSize > maxTotal) {
      throw new AppError('Tamanho total dos arquivos excede 50MB', 413);
    }
  }

  next();
};

export const handleMulterError = (
  error: any,
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    let message = 'Erro no upload do arquivo';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Arquivo muito grande. Máximo permitido: 10MB';
        statusCode = 413;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Muitos arquivos. Máximo permitido: 10 arquivos';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de arquivo inesperado';
        break;
      default:
        break;
    }

    next(new AppError(message, statusCode));
    return;
  }

  next(error);
};