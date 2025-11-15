import { Request, Response } from 'express';
import { CategoryService } from '../services/categoryService';
import { asyncHandler, AppError } from '../middlewares/errorHandler';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  list = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const categorias = await this.categoryService.listCategories();
    res.status(200).json({ success: true, data: categorias });
  });

  dictionary = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const dict = await this.categoryService.getDictionary();
    res.status(200).json({ success: true, data: dict });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { nome, slug, descricao, keywords } = req.body || {};
    if (!nome || typeof nome !== 'string') {
      throw new AppError('Campo nome é obrigatório', 400);
    }
    const cat = await this.categoryService.createCategory({ nome, slug, descricao, keywords });
    res.status(201).json({ success: true, data: cat });
  });

  addKeywords = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { keywords } = req.body || {};
    if (!id) throw new AppError('ID é obrigatório', 400);
    if (!Array.isArray(keywords) || keywords.length === 0) {
      throw new AppError('keywords deve ser uma lista não vazia', 400);
    }
    const count = await this.categoryService.addKeywords(id, keywords);
    res.status(200).json({ success: true, data: { added: count } });
  });
}