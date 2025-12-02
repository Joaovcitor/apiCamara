export type LeiTipo = 'LEI' | 'COMPLEMENTAR' | 'RESOLUCAO';

export interface LeiStructure {
  titulo: string;
  ementa?: string;
  numero: string;
  data?: Date;
  origem: string;
  textoCompleto?: string;
  tipo?: LeiTipo;
  artigos: ArtigoStructure[];
}

export interface ArtigoStructure {
  numero: string;
  texto: string;
  ordem: number;
  paragrafos?: ParagrafoStructure[];
  incisos?: IncisoStructure[];
  capitulo?: CapituloStructure;
}

export interface CapituloStructure {
  numero?: string;
  nome?: string;
  ordem: number;
}

export interface ParagrafoStructure {
  numero: string;
  texto: string;
  ordem: number;
  incisos?: IncisoStructure[];
}

export interface IncisoStructure {
  numero: string;
  texto: string;
  ordem: number;
  alineas?: AlineaStructure[];
}

export interface AlineaStructure {
  numero: string;
  texto: string;
  ordem: number;
  itens?: ItemStructure[];
}

export interface ItemStructure {
  numero: string;
  texto: string;
  ordem: number;
}

export interface ScrapingResult {
  success: boolean;
  data?: LeiStructure;
  error?: string;
  url: string;
}

export interface UploadResult {
  success: boolean;
  data?: LeiStructure;
  error?: string;
  filename: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeiWithRelations {
  id: string;
  titulo: string;
  ementa?: string;
  numero: string;
  data?: Date;
  origem: string;
  textoCompleto?: string;
  criadoEm: Date;
  atualizadoEm: Date;
  tipo?: LeiTipo;
  artigos: ArtigoWithRelations[];
  categorias: { id: string; nome: string; slug: string }[];
}

export interface ArtigoWithRelations {
  id: string;
  numero: string;
  texto: string;
  ordem: number;
  paragrafos: ParagrafoWithRelations[];
  incisos: IncisoWithRelations[];
  capituloId?: string;
  capitulo?: CapituloWithRelations | null;
}

export interface CapituloWithRelations {
  id: string;
  numero?: string;
  nome?: string;
  ordem: number;
}

export interface ParagrafoWithRelations {
  id: string;
  numero: string;
  texto: string;
  ordem: number;
  incisos: IncisoWithRelations[];
}

export interface IncisoWithRelations {
  id: string;
  numero: string;
  texto: string;
  ordem: number;
  alineas: AlineaWithRelations[];
}

export interface AlineaWithRelations {
  id: string;
  numero: string;
  texto: string;
  ordem: number;
  itens: ItemWithRelations[];
}

export interface ItemWithRelations {
  id: string;
  numero: string;
  texto: string;
  ordem: number;
}

export type SupportedSites = 
  | 'planalto.gov.br'
  | 'camara.leg.br'
  | 'senado.leg.br'
  | 'diariomunicipal.org.br';

export interface ScrapingConfig {
  timeout: number;
  maxRetries: number;
  userAgent: string;
}

// Seletores customizados para scraping configurável
export interface CustomScrapeSelectors {
  title: string[]; // seletores para título, ordem de preferência
  ementa?: string[]; // seletores para ementa
  content: string[]; // seletores para blocos de texto principal
  linkSelectors?: string[]; // seletores para coletar links
  hrefInclude?: string; // filtro de substring em href (ex.: "ccivil_03/leis")
}

// Link listado a partir de páginas de índice
export interface ListedLink {
  url: string;
  text?: string;
}

// Dicionário de categorias: chave é a categoria, valor é lista de palavras-chave
export type CategoryDictionary = Record<string, string[]>;