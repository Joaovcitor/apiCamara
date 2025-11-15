import { jest } from '@jest/globals';
import '../types/jest';

// Configuração do ambiente de teste
beforeAll(() => {
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = 'file:./test.db';
  process.env['JWT_SECRET'] = 'test-secret';
  process.env['PORT'] = '3001';
});

// Mock do PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    lei: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    artigo: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    paragrafo: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    inciso: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    alinea: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    item: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  })),
}));

// Mock do logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock do cache manager
jest.mock('../utils/cache', () => ({
  cacheManager: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
    generateKey: jest.fn(),
  },
}));

// Mock do Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(() => Promise.resolve({
      newPage: jest.fn(() => Promise.resolve({
        goto: jest.fn(),
        content: jest.fn(),
        close: jest.fn(),
        setExtraHTTPHeaders: jest.fn(),
      })),
      close: jest.fn(),
    })),
  },
}));

// Mock do Mammoth
jest.mock('mammoth', () => ({
  extractRawText: jest.fn(() => Promise.resolve({
    value: 'Texto extraído do documento',
    messages: [],
  })),
}));

// Mock do Cheerio
jest.mock('cheerio', () => ({
  load: jest.fn().mockReturnValue({
    text: jest.fn().mockReturnValue('Texto mockado'),
    find: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  }),
}));

// Configuração global do Jest
jest.setTimeout(10000);

// Limpeza após cada teste
afterEach(() => {
  jest.clearAllMocks();
});

// Limpeza após todos os testes
afterAll(() => {
  jest.restoreAllMocks();
});

export {}; // Adiciona export para tornar o arquivo um módulo