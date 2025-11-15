import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lei Scraper API',
      version: '1.0.0',
      description: `
        API para scraping e processamento de leis brasileiras.
        
        ## Funcionalidades Principais
        
        ### 🔍 Scraping de Leis
        - Extração de leis de sites oficiais brasileiros
        - Suporte para planalto.gov.br, camara.leg.br, senado.leg.br
        - Processamento automático da estrutura hierárquica
        
        ### 📄 Upload de Documentos
        - Processamento de arquivos Word (.doc/.docx)
        - Extração automática de estrutura jurídica
        - Suporte para upload múltiplo
        
        ### 📚 Gerenciamento de Leis
        - Listagem com paginação e busca
        - Exportação em múltiplos formatos
        - Estatísticas e relatórios
        
        ## Estrutura Hierárquica
        
        As leis são estruturadas seguindo a hierarquia jurídica brasileira:
        - **Lei** → **Artigos** → **Parágrafos** → **Incisos** → **Alíneas** → **Itens**
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env['API_BASE_URL'] || 'http://localhost:3000/api',
        description: 'Servidor de desenvolvimento',
      },
      {
        url: 'https://api.example.com/api',
        description: 'Servidor de produção',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Endpoints de verificação de saúde da API',
      },
      {
        name: 'Scraping',
        description: 'Endpoints para scraping de leis de sites oficiais',
      },
      {
        name: 'Upload',
        description: 'Endpoints para upload e processamento de arquivos Word',
      },
      {
        name: 'Leis',
        description: 'Endpoints para gerenciamento e consulta de leis',
      },
    ],
    components: {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indica se a operação foi bem-sucedida',
            },
            data: {
              type: 'object',
              description: 'Dados da resposta (quando success=true)',
            },
            error: {
              type: 'string',
              description: 'Mensagem de erro (quando success=false)',
            },
            message: {
              type: 'string',
              description: 'Mensagem adicional',
            },
          },
          required: ['success'],
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description: 'Página atual',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Itens por página',
            },
            total: {
              type: 'integer',
              minimum: 0,
              description: 'Total de itens',
            },
            totalPages: {
              type: 'integer',
              minimum: 0,
              description: 'Total de páginas',
            },
            hasNext: {
              type: 'boolean',
              description: 'Indica se há próxima página',
            },
            hasPrev: {
              type: 'boolean',
              description: 'Indica se há página anterior',
            },
          },
        },
        Lei: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único da lei (CUID)',
            },
            titulo: {
              type: 'string',
              description: 'Título completo da lei',
              example: 'Lei nº 8.080, de 19 de setembro de 1990',
            },
            numero: {
              type: 'string',
              nullable: true,
              description: 'Número da lei',
              example: '8.080',
            },
            data: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'Data de publicação da lei',
            },
            ementa: {
              type: 'string',
              nullable: true,
              description: 'Ementa da lei',
            },
            origem: {
              type: 'string',
              enum: ['scraping', 'upload'],
              description: 'Origem da lei (scraping ou upload)',
            },
            textoCompleto: {
              type: 'string',
              description: 'Texto completo da lei',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação no sistema',
            },
            atualizadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização',
            },
            artigos: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Artigo',
              },
            },
          },
        },
        LeiSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único da lei',
            },
            titulo: {
              type: 'string',
              description: 'Título da lei',
            },
            numero: {
              type: 'string',
              nullable: true,
              description: 'Número da lei',
            },
            data: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'Data da lei',
            },
            ementa: {
              type: 'string',
              nullable: true,
              description: 'Ementa da lei',
            },
            origem: {
              type: 'string',
              enum: ['scraping', 'upload'],
              description: 'Origem da lei',
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação',
            },
          },
        },
        Artigo: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único do artigo',
            },
            numero: {
              type: 'string',
              description: 'Número do artigo',
              example: 'Art. 1º',
            },
            texto: {
              type: 'string',
              description: 'Texto do artigo',
            },
            ordem: {
              type: 'integer',
              description: 'Ordem do artigo na lei',
            },
            paragrafos: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Paragrafo',
              },
            },
          },
        },
        Paragrafo: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único do parágrafo',
            },
            numero: {
              type: 'string',
              description: 'Número do parágrafo',
              example: '§ 1º',
            },
            texto: {
              type: 'string',
              description: 'Texto do parágrafo',
            },
            ordem: {
              type: 'integer',
              description: 'Ordem do parágrafo no artigo',
            },
            incisos: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Inciso',
              },
            },
          },
        },
        Inciso: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único do inciso',
            },
            numero: {
              type: 'string',
              description: 'Número do inciso',
              example: 'I',
            },
            texto: {
              type: 'string',
              description: 'Texto do inciso',
            },
            ordem: {
              type: 'integer',
              description: 'Ordem do inciso no parágrafo',
            },
            alineas: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Alinea',
              },
            },
          },
        },
        Alinea: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único da alínea',
            },
            numero: {
              type: 'string',
              description: 'Letra da alínea',
              example: 'a)',
            },
            texto: {
              type: 'string',
              description: 'Texto da alínea',
            },
            ordem: {
              type: 'integer',
              description: 'Ordem da alínea no inciso',
            },
            itens: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Item',
              },
            },
          },
        },
        Item: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID único do item',
            },
            numero: {
              type: 'string',
              description: 'Número do item',
              example: '1.',
            },
            texto: {
              type: 'string',
              description: 'Texto do item',
            },
            ordem: {
              type: 'integer',
              description: 'Ordem do item na alínea',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              description: 'Mensagem de erro',
            },
            details: {
              type: 'object',
              description: 'Detalhes adicionais do erro',
            },
          },
          required: ['success', 'error'],
        },
      },
      responses: {
        BadRequest: {
          description: 'Requisição inválida',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Erro interno do servidor',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Muitas requisições',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);