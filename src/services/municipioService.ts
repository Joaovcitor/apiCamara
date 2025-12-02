import { PrismaClient, Municipio } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

export class MunicipioService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createMunicipio(data: { nome: string; slug: string }): Promise<Municipio> {
    try {
      const existing = await this.prisma.municipio.findUnique({
        where: { slug: data.slug },
      });

      if (existing) {
        throw new AppError('Município com este slug já existe', 400);
      }

      const municipio = await this.prisma.municipio.create({
        data,
      });

      logger.info('Município created', { id: municipio.id, slug: municipio.slug });
      return municipio;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating municipio', error);
      throw new AppError('Erro ao criar município', 500);
    }
  }

  async getMunicipioBySlug(slug: string): Promise<Municipio | null> {
    try {
      return await this.prisma.municipio.findUnique({
        where: { slug },
      });
    } catch (error) {
      logger.error('Error fetching municipio by slug', error);
      throw new AppError('Erro ao buscar município', 500);
    }
  }

  async getMunicipioById(id: string): Promise<Municipio | null> {
    try {
      return await this.prisma.municipio.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Error fetching municipio by id', error);
      throw new AppError('Erro ao buscar município', 500);
    }
  }

  async listMunicipios(): Promise<Municipio[]> {
    try {
      return await this.prisma.municipio.findMany({
        orderBy: { nome: 'asc' },
      });
    } catch (error) {
      logger.error('Error listing municipios', error);
      throw new AppError('Erro ao listar municípios', 500);
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async updateImages(id: string, headerImage?: string, footerImage?: string): Promise<Municipio> {
    try {
      const data: any = {};
      if (headerImage) data.headerImage = headerImage;
      if (footerImage) data.footerImage = footerImage;

      return await this.prisma.municipio.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error('Error updating municipio images', error);
      throw new AppError('Erro ao atualizar imagens do município', 500);
    }
  }
}
