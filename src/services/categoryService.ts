import { PrismaClient } from '@prisma/client';
import { CategoryDictionary } from '../types';

export class CategoryService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async listCategories() {
    return this.prisma.categoria.findMany({
      include: { palavras: true },
      orderBy: { nome: 'asc' },
    });
  }

  async getDictionary(): Promise<CategoryDictionary> {
    const categorias = await this.prisma.categoria.findMany({
      include: { palavras: true },
    });
    const dict: CategoryDictionary = {};
    for (const c of categorias) {
      dict[c.slug] = c.palavras.map(p => p.termo).filter(Boolean);
    }
    return dict;
  }

  async createCategory(params: { nome: string; slug?: string; descricao?: string; keywords?: string[] }) {
    const slug = (params.slug || params.nome)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const categoria = await this.prisma.categoria.create({
      data: {
        nome: params.nome,
        slug,
        descricao: params.descricao || null,
      },
    });

    if (params.keywords && params.keywords.length) {
      const data = params.keywords.map(k => ({ termo: k, categoriaId: categoria.id }));
      await this.prisma.categoriaKeyword.createMany({ data, skipDuplicates: true });
    }

    return this.prisma.categoria.findUnique({ where: { id: categoria.id }, include: { palavras: true } });
  }

  async addKeywords(categoriaId: string, keywords: string[]): Promise<number> {
    if (!keywords?.length) return 0;
    const data = keywords.map(k => ({ termo: k, categoriaId }));
    const res = await this.prisma.categoriaKeyword.createMany({ data, skipDuplicates: true });
    return res.count;
  }
}