import { z } from 'zod';

export const scrapingSchema = z.object({
  url: z
    .string()
    .url('URL inválida')
    .refine(
      url => {
        const supportedDomains = [
          'planalto.gov.br',
          'camara.leg.br',
          'senado.leg.br',
          'diariomunicipal.org.br',
        ];
        return supportedDomains.some(domain => url.includes(domain));
      },
      {
        message: 'URL deve ser de um site oficial suportado',
      }
    ),
});

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'Página deve ser maior que 0'),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limite deve estar entre 1 e 100'),
});

export const leiIdSchema = z.object({
  id: z.string().cuid('ID inválido'),
});

// Estrutura de Lei para criação/atualização completa
const capituloSchema = z.object({
  numero: z.string().optional(),
  nome: z.string().optional(),
  ordem: z.number(),
});

const itemSchema = z.object({ numero: z.string(), texto: z.string(), ordem: z.number() });
const alineaSchema = z.object({ numero: z.string(), texto: z.string(), ordem: z.number(), itens: z.array(itemSchema).optional().default([]) });
const incisoSchema = z.object({ numero: z.string(), texto: z.string(), ordem: z.number(), alineas: z.array(alineaSchema).optional().default([]) });
const paragrafoSchema = z.object({ numero: z.string(), texto: z.string(), ordem: z.number(), incisos: z.array(incisoSchema).optional().default([]) });
const artigoSchema = z.object({
  numero: z.string(),
  texto: z.string(),
  ordem: z.number(),
  paragrafos: z.array(paragrafoSchema).optional().default([]),
  incisos: z.array(incisoSchema).optional().default([]),
  capitulo: capituloSchema.optional(),
});

export const leiCreateSchema = z.object({
  titulo: z.string(),
  ementa: z.string().optional(),
  numero: z.string(),
  data: z.preprocess((v) => (typeof v === 'string' ? new Date(v) : v), z.date().optional()),
  origem: z.string(),
  textoCompleto: z.string().optional(),
  artigos: z.array(artigoSchema).min(0).optional().default([]),
});

export const leiUpdateSchema = leiCreateSchema.partial();

export const uploadFileSchema = z.object({
  fieldname: z.string(),
  originalname: z.string().refine(
    name => {
      const validExtensions = ['.doc', '.docx'];
      return validExtensions.some(ext => name.toLowerCase().endsWith(ext));
    },
    {
      message: 'Arquivo deve ser .doc ou .docx',
    }
  ),
  encoding: z.string(),
  mimetype: z.string().refine(
    type => {
      const validTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      return validTypes.includes(type);
    },
    {
      message: 'Tipo de arquivo inválido',
    }
  ),
  size: z.number().max(10 * 1024 * 1024, 'Arquivo muito grande (máximo 10MB)'),
  buffer: z.instanceof(Buffer),
});

export type ScrapingInput = z.infer<typeof scrapingSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type LeiIdInput = z.infer<typeof leiIdSchema>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type LeiCreateInput = z.infer<typeof leiCreateSchema>;
export type LeiUpdateInput = z.infer<typeof leiUpdateSchema>;