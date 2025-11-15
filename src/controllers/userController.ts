import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/errorHandler';
import { UserService } from '../services/userService';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(String((req.query as any)['page'] ?? '1'), 10) || 1;
    const limit = Math.min(100, parseInt(String((req.query as any)['limit'] ?? '20'), 10) || 20);
    const data = await this.userService.listUsers(page, limit);
    res.status(200).json({ success: true, data });
  });

  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = (req.params as any)['id'];
    if (!id || typeof id !== 'string') throw new AppError('ID é obrigatório', 400);
    const user = await this.userService.getUserById(id);
    if (!user) throw new AppError('Usuário não encontrado', 404);
    res.status(200).json({ success: true, data: user });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, name, role, password } = req.body || {};
    if (!email || typeof email !== 'string') throw new AppError('Email é obrigatório', 400);
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError('Senha é obrigatória e deve ter ao menos 6 caracteres', 400);
    }
    const user = await this.userService.createUser({ email, name, role, password });
    res.status(201).json({ success: true, data: user, message: 'Usuário criado com sucesso' });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = (req.params as any)['id'];
    if (!id || typeof id !== 'string') throw new AppError('ID é obrigatório', 400);
    const { email, name, role, password } = req.body || {};
    const user = await this.userService.updateUser(id, { email, name, role, password });
    res.status(200).json({ success: true, data: user, message: 'Usuário atualizado com sucesso' });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = (req.params as any)['id'];
    if (!id || typeof id !== 'string') throw new AppError('ID é obrigatório', 400);
    await this.userService.deleteUser(id);
    res.status(200).json({ success: true, message: 'Usuário removido com sucesso' });
  });
}