import { PrismaClient, Prisma } from '@prisma/client';
import {
  LeiStructure,
  LeiWithRelations,
  PaginationParams,
  PaginatedResponse,
  ArtigoWithRelations,
  ParagrafoWithRelations,
  IncisoWithRelations,
  AlineaWithRelations,
  ItemWithRelations,
} from '../types';
import { CategoryService } from './categoryService';
import { categorizeLei, defaultCategoryDictionary } from '../utils/categorizer';
import { logger } from '../utils/logger';
import { AppError } from '../middlewares/errorHandler';

export class LeiService {
  private prisma: PrismaClient;
  private static readonly FULL_INCLUDE = {
    artigos: {
      include: {
        paragrafos: {
          include: {
            incisos: {
              include: {
                alineas: {
                  include: {
                    itens: true,
                  },
                },
              },
            },
          },
        },
        Inciso: {
          include: {
            alineas: {
              include: {
                itens: true,
              },
            },
          },
        },
        capitulo: true,
      },
    },
    categorias: true,
  } as const;

  constructor() {
    this.prisma = new PrismaClient({
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async saveLei(leiData: LeiStructure, municipioId: string, usuarioId: string): Promise<LeiWithRelations> {
    try {
      logger.info('Saving lei to database', { titulo: leiData.titulo, municipioId });

      const saved = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Criar lei sem artigos
          const savedLei = await tx.lei.create({
            data: {
              titulo: leiData.titulo,
              ementa: leiData.ementa ?? null,
              numero: leiData.numero,
              data: leiData.data ?? null,
              origem: leiData.origem,
              textoCompleto: leiData.textoCompleto ?? null,
              tipo: (leiData.tipo === 'COMPLEMENTAR'
                ? 'COMPLEMENTAR'
                : 'LEI') as any,
              municipioId,
              usuarioId,
            },
          });

          // Criar capítulos únicos
          const capMap = new Map<string, string>();
          for (const art of leiData.artigos) {
            const cap = art.capitulo;
            if (!cap) continue;
            const key = `${cap.ordem}|${cap.numero ?? ''}|${(cap.nome ?? '').toUpperCase()}`;
            if (capMap.has(key)) continue;
            const createdCap = await tx.capitulo.create({
              data: {
                leiId: savedLei.id,
                ordem: cap.ordem,
                numero: cap.numero ?? null,
                nome: cap.nome ?? null,
              },
            });
            capMap.set(key, createdCap.id);
          }

          // Criar artigos vinculando capituloId
          for (const artigo of leiData.artigos) {
            const cap = artigo.capitulo;
            const capKey = cap
              ? `${cap.ordem}|${cap.numero ?? ''}|${(cap.nome ?? '').toUpperCase()}`
              : undefined;
            const capituloId = capKey ? capMap.get(capKey) : undefined;

            await tx.artigo.create({
              data: {
                leiId: savedLei.id,
                numero: artigo.numero,
                texto: artigo.texto,
                ordem: artigo.ordem,
                capituloId: capituloId ?? null,
                paragrafos: {
                  create: (artigo.paragrafos || []).map(paragrafo => ({
                    numero: paragrafo.numero,
                    texto: paragrafo.texto,
                    ordem: paragrafo.ordem,
                    incisos: {
                      create: (paragrafo.incisos || []).map(inciso => ({
                        numero: inciso.numero,
                        texto: inciso.texto,
                        ordem: inciso.ordem,
                        alineas: {
                          create: (inciso.alineas || []).map(alinea => ({
                            numero: alinea.numero,
                            texto: alinea.texto,
                            ordem: alinea.ordem,
                            itens: {
                              create: (alinea.itens || []).map(item => ({
                                numero: item.numero,
                                texto: item.texto,
                                ordem: item.ordem,
                              })),
                            },
                          })),
                        },
                      })),
                    },
                  })),
                },
                Inciso: {
                  create: (artigo.incisos || []).map(inciso => ({
                    numero: inciso.numero,
                    texto: inciso.texto,
                    ordem: inciso.ordem,
                    alineas: {
                      create: (inciso.alineas || []).map(alinea => ({
                        numero: alinea.numero,
                        texto: alinea.texto,
                        ordem: alinea.ordem,
                        itens: {
                          create: (alinea.itens || []).map(item => ({
                            numero: item.numero,
                            texto: item.texto,
                            ordem: item.ordem,
                          })),
                        },
                      })),
                    },
                  })),
                },
              },
            });
          }

          // Categorizar automaticamente
          const dict = await new CategoryService().getDictionary().catch(() => defaultCategoryDictionary);
          const categories = categorizeLei(savedLei as unknown as LeiStructure, dict);
          
          if (categories.length > 0) {
            // Buscar IDs das categorias
            const cats = await tx.categoria.findMany({
              where: { slug: { in: categories } },
              select: { id: true }
            });

            if (cats.length > 0) {
              await tx.lei.update({
                where: { id: savedLei.id },
                data: {
                  categorias: {
                    connect: cats.map(c => ({ id: c.id }))
                  }
                }
              });
            }
          }

          return await tx.lei.findUnique({
            where: { id: savedLei.id },
            include: LeiService.FULL_INCLUDE,
          }) as unknown as LeiWithRelations;
        }
      );

      return saved as unknown as LeiWithRelations;
    } catch (error) {
      logger.error('Error saving lei', error);
      throw new AppError('Erro ao salvar lei', 500);
    }
  }

  async getLeiById(id: string): Promise<LeiWithRelations | null> {
    try {
      const lei = await this.prisma.lei.findUnique({
        where: { id },
        include: LeiService.FULL_INCLUDE,
      });

      if (!lei) {
        return null;
      }

      // Ordenar elementos hierárquicos
      this.sortHierarchicalElements(lei as unknown as LeiWithRelations);

      return lei as unknown as LeiWithRelations;
    } catch (error) {
      logger.error('Error fetching lei by id', error);
      throw new AppError('Erro ao buscar lei', 500);
    }
  }

  async getLeis(
    params: PaginationParams,
    municipioId?: string
  ): Promise<PaginatedResponse<LeiWithRelations>> {
    try {
      const { page, limit } = params;
      const skip = (page - 1) * limit;
      const where = municipioId ? { municipioId } : {};

      const [leis, total] = await Promise.all([
        this.prisma.lei.findMany({
          where,
          skip,
          take: limit,
          include: LeiService.FULL_INCLUDE,
          orderBy: { criadoEm: 'desc' },
        }),
        this.prisma.lei.count({ where }),
      ]);

      // Ordenar elementos hierárquicos para cada lei
      (leis as unknown as LeiWithRelations[]).forEach((lei: LeiWithRelations) =>
        this.sortHierarchicalElements(lei)
      );

      const totalPages = Math.ceil(total / limit);

      return {
        data: leis as unknown as LeiWithRelations[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error fetching leis', error);
      throw new AppError('Erro ao buscar leis', 500);
    }
  }

  async searchLeis(
    query: string,
    params: PaginationParams,
    municipioId?: string
  ): Promise<PaginatedResponse<LeiWithRelations>> {
    try {
      const { page, limit } = params;
      const skip = (page - 1) * limit;

      const searchCondition = {
        OR: [
          { titulo: { contains: query, mode: 'insensitive' as const } },
          { ementa: { contains: query, mode: 'insensitive' as const } },
          { numero: { contains: query, mode: 'insensitive' as const } },
          { textoCompleto: { contains: query, mode: 'insensitive' as const } },
        ],
        ...(municipioId ? { municipioId } : {}),
      };

      const [leis, total] = await Promise.all([
        this.prisma.lei.findMany({
          where: searchCondition,
          skip,
          take: limit,
          include: LeiService.FULL_INCLUDE,
          orderBy: { criadoEm: 'desc' },
        }),
        this.prisma.lei.count({ where: searchCondition }),
      ]);

      // Ordenar elementos hierárquicos para cada lei
      (leis as unknown as LeiWithRelations[]).forEach((lei: LeiWithRelations) =>
        this.sortHierarchicalElements(lei)
      );

      const totalPages = Math.ceil(total / limit);

      return {
        data: leis as unknown as LeiWithRelations[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error searching leis', error);
      throw new AppError('Erro ao buscar leis', 500);
    }
  }

  async getLeisByMunicipio(
    slug: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<LeiWithRelations>> {
    try {
      const { page, limit } = params;
      const skip = (page - 1) * limit;

      const where = { municipio: { slug } };

      const [leis, total] = await Promise.all([
        this.prisma.lei.findMany({
          where,
          skip,
          take: limit,
          include: LeiService.FULL_INCLUDE,
          orderBy: { criadoEm: 'desc' },
        }),
        this.prisma.lei.count({ where }),
      ]);

      (leis as unknown as LeiWithRelations[]).forEach((lei: LeiWithRelations) =>
        this.sortHierarchicalElements(lei)
      );

      const totalPages = Math.ceil(total / limit);

      return {
        data: leis as unknown as LeiWithRelations[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error fetching leis by municipio', error);
      throw new AppError('Erro ao buscar leis do município', 500);
    }
  }

  async deleteLei(id: string): Promise<boolean> {
    try {
      await this.prisma.lei.delete({
        where: { id },
      });

      logger.info('Lei deleted successfully', { id });
      return true;
    } catch (error) {
      logger.error('Error deleting lei', error);
      throw new AppError('Erro ao deletar lei', 500);
    }
  }

  async updateLei(
    id: string,
    updateData: Partial<LeiStructure>
  ): Promise<LeiWithRelations> {
    try {
      const dataUpdate: Prisma.LeiUpdateInput = {};

      if (updateData.titulo !== undefined) {
        dataUpdate.titulo = updateData.titulo;
      }
      if (updateData.numero !== undefined) {
        dataUpdate.numero = updateData.numero;
      }
      if (updateData.ementa !== undefined) {
        dataUpdate.ementa = updateData.ementa ?? null;
      }
      if (updateData.data !== undefined) {
        dataUpdate.data = updateData.data ?? null;
      }
      if (updateData.textoCompleto !== undefined) {
        dataUpdate.textoCompleto = updateData.textoCompleto ?? null;
      }
      if (updateData.tipo !== undefined) {
        (dataUpdate as any).tipo =
          updateData.tipo === 'COMPLEMENTAR' ? 'COMPLEMENTAR' : 'LEI';
      }

      const updatedLei = await this.prisma.lei.update({
        where: { id },
        data: dataUpdate,
        include: LeiService.FULL_INCLUDE,
      });

      this.sortHierarchicalElements(updatedLei as unknown as LeiWithRelations);

      logger.info('Lei updated successfully', {
        id,
        titulo: (updatedLei as any).titulo,
      });
      return updatedLei as unknown as LeiWithRelations;
    } catch (error) {
      logger.error('Error updating lei', error);
      throw new AppError('Erro ao atualizar lei', 500);
    }
  }

  // Substitui completamente a estrutura da lei (campos raiz e hierarquia)
  async replaceLei(
    id: string,
    leiData: LeiStructure
  ): Promise<LeiWithRelations> {
    try {
      const updated = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Atualizar campos raiz
          await tx.lei.update({
            where: { id },
            data: {
              titulo: leiData.titulo,
              ementa: leiData.ementa ?? null,
              numero: leiData.numero,
              data: leiData.data ?? null,
              origem: leiData.origem,
              textoCompleto: leiData.textoCompleto ?? null,
              tipo: (leiData.tipo === 'COMPLEMENTAR'
                ? 'COMPLEMENTAR'
                : 'LEI') as any,
            },
          });

          // Remover hierarquia existente
          await tx.artigo.deleteMany({ where: { leiId: id } });
          await tx.capitulo.deleteMany({ where: { leiId: id } });

          // Recriar capítulos únicos
          const capMap = new Map<string, string>();
          for (const art of leiData.artigos) {
            const cap = art.capitulo;
            if (!cap) continue;
            const key = `${cap.ordem}|${cap.numero ?? ''}|${(cap.nome ?? '').toUpperCase()}`;
            if (capMap.has(key)) continue;
            const createdCap = await tx.capitulo.create({
              data: {
                leiId: id,
                ordem: cap.ordem,
                numero: cap.numero ?? null,
                nome: cap.nome ?? null,
              },
            });
            capMap.set(key, createdCap.id);
          }

          // Recriar artigos e relacionamentos
          for (const artigo of leiData.artigos) {
            const cap = artigo.capitulo;
            const capKey = cap
              ? `${cap.ordem}|${cap.numero ?? ''}|${(cap.nome ?? '').toUpperCase()}`
              : undefined;
            const capituloId = capKey ? capMap.get(capKey) : undefined;

            await tx.artigo.create({
              data: {
                leiId: id,
                numero: artigo.numero,
                texto: artigo.texto,
                ordem: artigo.ordem,
                capituloId: capituloId ?? null,
                paragrafos: {
                  create: (artigo.paragrafos || []).map(paragrafo => ({
                    numero: paragrafo.numero,
                    texto: paragrafo.texto,
                    ordem: paragrafo.ordem,
                    incisos: {
                      create: (paragrafo.incisos || []).map(inciso => ({
                        numero: inciso.numero,
                        texto: inciso.texto,
                        ordem: inciso.ordem,
                        alineas: {
                          create: (inciso.alineas || []).map(alinea => ({
                            numero: alinea.numero,
                            texto: alinea.texto,
                            ordem: alinea.ordem,
                            itens: {
                              create: (alinea.itens || []).map(item => ({
                                numero: item.numero,
                                texto: item.texto,
                                ordem: item.ordem,
                              })),
                            },
                          })),
                        },
                      })),
                    },
                  })),
                },
                Inciso: {
                  create: (artigo.incisos || []).map(inciso => ({
                    numero: inciso.numero,
                    texto: inciso.texto,
                    ordem: inciso.ordem,
                    alineas: {
                      create: (inciso.alineas || []).map(alinea => ({
                        numero: alinea.numero,
                        texto: alinea.texto,
                        ordem: alinea.ordem,
                        itens: {
                          create: (alinea.itens || []).map(item => ({
                            numero: item.numero,
                            texto: item.texto,
                            ordem: item.ordem,
                          })),
                        },
                      })),
                    },
                  })),
                },
              },
            });
          }

          return await tx.lei.findUnique({
            where: { id },
            include: LeiService.FULL_INCLUDE,
          });
        }
      );

      this.sortHierarchicalElements(updated as unknown as LeiWithRelations);
      return updated as unknown as LeiWithRelations;
    } catch (error) {
      logger.error('Error replacing lei', error);
      throw new AppError('Erro ao substituir lei', 500);
    }
  }

  async getLeisStats(): Promise<{
    total: number;
    byOrigin: Record<string, number>;
    recentCount: number;
  }> {
    try {
      const [total, leis, recentCount] = await Promise.all([
        this.prisma.lei.count(),
        this.prisma.lei.findMany({
          select: { origem: true },
        }),
        this.prisma.lei.count({
          where: {
            criadoEm: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
            },
          },
        }),
      ]);

      // Agrupar por origem
      const byOrigin: Record<string, number> = {};
      leis.forEach((lei: any) => {
        const origem = lei.origem.includes('http') ? 'scraping' : 'upload';
        byOrigin[origem] = (byOrigin[origem] || 0) + 1;
      });

      return {
        total,
        byOrigin,
        recentCount,
      };
    } catch (error) {
      logger.error('Error getting leis stats', error);
      throw new AppError('Erro ao obter estatísticas', 500);
    }
  }

  private sortHierarchicalElements(lei: LeiWithRelations): void {
    // Ordenar artigos
    lei.artigos.sort(
      (a: ArtigoWithRelations, b: ArtigoWithRelations) => a.ordem - b.ordem
    );

    lei.artigos.forEach((artigo: ArtigoWithRelations) => {
      // Ordenar parágrafos
      if (artigo.paragrafos) {
        artigo.paragrafos.sort(
          (a: ParagrafoWithRelations, b: ParagrafoWithRelations) =>
            a.ordem - b.ordem
        );

        artigo.paragrafos.forEach((paragrafo: ParagrafoWithRelations) => {
          // Ordenar incisos do parágrafo
          if (paragrafo.incisos) {
            paragrafo.incisos.sort(
              (a: IncisoWithRelations, b: IncisoWithRelations) =>
                a.ordem - b.ordem
            );

            paragrafo.incisos.forEach((inciso: IncisoWithRelations) => {
              // Ordenar alíneas
              if (inciso.alineas) {
                inciso.alineas.sort(
                  (a: AlineaWithRelations, b: AlineaWithRelations) =>
                    a.ordem - b.ordem
                );

                inciso.alineas.forEach((alinea: AlineaWithRelations) => {
                  // Ordenar itens
                  if (alinea.itens) {
                    alinea.itens.sort(
                      (a: ItemWithRelations, b: ItemWithRelations) =>
                        a.ordem - b.ordem
                    );
                  }
                });
              }
            });
          }
        });
      }

      // Ordenar incisos diretos do artigo (aceita tanto artigo.incisos quanto artigo.Inciso)
      const incisosDiretos: IncisoWithRelations[] =
        (artigo as any).incisos ?? (artigo as any).Inciso ?? [];
      if (incisosDiretos.length) {
        incisosDiretos.sort(
          (a: IncisoWithRelations, b: IncisoWithRelations) => a.ordem - b.ordem
        );
        incisosDiretos.forEach((inciso: IncisoWithRelations) => {
          if (inciso.alineas) {
            inciso.alineas.sort(
              (a: AlineaWithRelations, b: AlineaWithRelations) =>
                a.ordem - b.ordem
            );
            inciso.alineas.forEach((alinea: AlineaWithRelations) => {
              if (alinea.itens) {
                alinea.itens.sort(
                  (a: ItemWithRelations, b: ItemWithRelations) =>
                    a.ordem - b.ordem
                );
              }
            });
          }
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
