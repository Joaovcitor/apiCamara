import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/errorHandler';
import { signToken, validateCredentials } from '../middlewares/auth';

export class AuthController {
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new AppError('Email e senha são obrigatórios', 400);
    }
    const user = await validateCredentials(email, password);
    if (!user) {
      throw new AppError('Credenciais inválidas', 401);
    }
    const token = signToken(user);
    const isProd = process.env['NODE_ENV'] === 'production';
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12h
      path: '/',
    });
    res.status(200).json({ success: true, data: { token, user }, message: 'Login realizado com sucesso' });
  });

  me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }
    res.status(200).json({ success: true, data: req.user });
  });
}