import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Armazenamento em memória
const storage = multer.memoryStorage();

// Filtro para documentos (Word)
const docFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const lower = path.basename(file.originalname).toLowerCase();

  if (
    lower.startsWith('~$') ||
    lower.startsWith('.~lock') ||
    lower.endsWith('.docx#') ||
    lower.endsWith('.doc#')
  ) {
    cb(new AppError('Arquivo temporário do Office/LibreOffice não é permitido', 400));
    return;
  }

  const allowedExtensions = ['.doc', '.docx'];
  const ext = path.extname(lower);
  if (!allowedExtensions.includes(ext)) {
    cb(new AppError('Apenas arquivos .doc e .docx são permitidos', 400));
    return;
  }

  const allowedMimeTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new AppError('Tipo de arquivo não suportado', 400));
    return;
  }

  cb(null, true);
};

// Filtro para imagens
const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new AppError('Apenas imagens (JPEG, PNG, WEBP) são permitidas', 400));
    return;
  }
  cb(null, true);
};

// Configuração para documentos
const uploadDocConfig = multer({
  storage,
  fileFilter: docFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
});

// Configuração para imagens
const uploadImageConfig = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 2, // Header e Footer
  },
});

// Exportar middlewares
export const uploadSingle = uploadDocConfig.single('file');
export const uploadMultiple = uploadDocConfig.array('files', 10);

export const uploadImages = uploadImageConfig.fields([
  { name: 'header', maxCount: 1 },
  { name: 'footer', maxCount: 1 },
]);

export const validateUpload = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Verifica se é upload de imagens (fields)
  if (req.files && !Array.isArray(req.files)) {
    // É um objeto do tipo { [fieldname: string]: Multer.File[] }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const hasHeader = files['header']?.length > 0;
    const hasFooter = files['footer']?.length > 0;
    
    if (!hasHeader && !hasFooter) {
       // Se não for upload de imagens, pode ser o de documentos, deixa passar para as verificações abaixo
       // Mas se a rota for de imagens, o controller vai reclamar.
    } else {
      // Validação de tamanho já feita pelo multer limits, mas podemos adicionar extra aqui se precisar
      return next();
    }
  }

  const files = req.files as Express.Multer.File[] | undefined;
  const file = req.file as Express.Multer.File | undefined;

  // Se chegou aqui e não tem file nem files, e não foi capturado pelo bloco de imagens acima
  if (!file && (!files || files.length === 0)) {
     // Verifica novamente se não é o caso de imagens onde req.files é objeto vazio
     if (req.files && !Array.isArray(req.files) && Object.keys(req.files).length === 0) {
        throw new AppError('Nenhuma imagem enviada', 400);
     }
     if (!req.files && !req.file) {
        throw new AppError('Nenhum arquivo foi enviado', 400);
     }
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
        message = 'Arquivo muito grande';
        statusCode = 413;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Muitos arquivos enviados';
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