import { Request, Response } from 'express';
import { MunicipioService } from '../services/municipioService';
import { ApiResponse } from '../types';
import { AppError } from '../middlewares/errorHandler';
import { saveFile, getPublicUrl } from '../utils/fileStorage';

export class MunicipioController {
  private municipioService: MunicipioService;

  constructor() {
    this.municipioService = new MunicipioService();
  }

  create = async (req: Request, res: Response) => {
    try {
      const { nome, slug } = req.body;
      const municipio = await this.municipioService.createMunicipio({ nome, slug });
      const response: ApiResponse = { success: true, data: municipio };
      res.status(201).json(response);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  };

  list = async (_req: Request, res: Response) => {
    try {
      const municipios = await this.municipioService.listMunicipios();
      const response: ApiResponse = { success: true, data: municipios };
      res.json(response);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  };

  getBySlug = async (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!slug) {
      throw new AppError('Slug é obrigatório', 400);
    }
    try {
      const municipio = await this.municipioService.getMunicipioBySlug(slug);
      if (!municipio) {
        throw new AppError('Município não encontrado', 404);
      }
      const response: ApiResponse = { success: true, data: municipio };
      res.json(response);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Erro ao buscar município', 500);
    }
  };

  uploadAssets = async (req: Request, res: Response) => {
    const municipioId = req.user?.municipioId;
    if (!municipioId) {
      throw new AppError('Usuário não vinculado a um município', 400);
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (!files || Object.keys(files).length === 0) {
      throw new AppError('Nenhuma imagem enviada', 400);
    }

    let headerUrl: string | undefined;
    let footerUrl: string | undefined;

    if (files['header']?.[0]) {
      const { storedName } = await saveFile(files['header'][0].buffer, files['header'][0].originalname, 'assets');
      headerUrl = getPublicUrl(storedName);
    }

    if (files['footer']?.[0]) {
      const { storedName } = await saveFile(files['footer'][0].buffer, files['footer'][0].originalname, 'assets');
      footerUrl = getPublicUrl(storedName);
    }

    const updated = await this.municipioService.updateImages(municipioId, headerUrl, footerUrl);

    const response: ApiResponse = {
      success: true,
      data: updated,
      message: 'Imagens atualizadas com sucesso',
    };
    res.json(response);
  };
}
