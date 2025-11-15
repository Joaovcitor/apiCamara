# API de Importação de Leis

API para importar e processar leis de fontes oficiais, com suporte a upload de documentos Word e scraping por URL sob demanda, estruturando automaticamente o conteúdo legal.

## 🚀 Funcionalidades

- **Scraping por URL (on-demand)**: Extração de leis via endpoint informando a URL
- **Upload de Documentos**: Processamento de arquivos Word (.doc/.docx)
- **Estruturação Hierárquica**: Organização automática em artigos, parágrafos, incisos, alíneas e itens
- **Cache Inteligente**: Sistema de cache para otimizar performance
- **API RESTful**: Endpoints bem documentados com Swagger
- **Validação Robusta**: Validação de dados com Zod
- **Tratamento de Erros**: Sistema completo de tratamento de erros
- **Testes Automatizados**: Cobertura de testes com Jest

## 🏗️ Tecnologias

- **Node.js** + **TypeScript**
- **Express.js** - Framework web
- **Prisma** - ORM e gerenciamento de banco de dados
- **Playwright** - Automação de browser para scraping
- **Cheerio** - Parser HTML/XML
- **Mammoth** - Processamento de documentos Word
- **Zod** - Validação de schemas
- **Jest** - Framework de testes
- **Swagger** - Documentação da API

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- PostgreSQL (ou SQLite para desenvolvimento)

## 🛠️ Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd lei-scraper-api
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
# Banco de dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/leis_db"

# Servidor
PORT=3000
NODE_ENV=development

# JWT (se necessário para autenticação futura)
JWT_SECRET=seu_jwt_secret_aqui

# Cache (opcional)
REDIS_URL=redis://localhost:6379
```

4. **Configure o banco de dados**
```bash
# Gerar o cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate dev

# (Opcional) Visualizar o banco
npx prisma studio
```

## 🚀 Execução

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

### Testes
```bash
npm test
```

## 📚 Documentação da API

Após iniciar o servidor, acesse:
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/api/health`

## 🔗 Endpoints Principais

### Scraping
- `POST /api/scrap` - Fazer scraping de uma URL

### Upload
- `POST /api/upload` - Upload de um arquivo Word
- `POST /api/upload/batch` - Upload de múltiplos arquivos
- `POST /api/upload/validate` - Validar arquivo sem processar

### Leis
- `GET /api/leis` - Listar leis (com paginação e busca)
- `GET /api/leis/:id` - Obter lei específica
- `GET /api/leis/stats` - Estatísticas das leis
- `GET /api/leis/:id/export` - Exportar lei (JSON/texto)
- `DELETE /api/leis/:id` - Deletar lei

## 📝 Exemplos de Uso

### Scraping de Lei
```bash
curl -X POST http://localhost:3000/api/scrap \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm"
  }'
```

### Upload de Documento
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@documento.docx"
```

### Listar Leis com Filtros
```bash
curl "http://localhost:3000/api/leis?page=1&limit=10&search=saude&origem=planalto"
```

## 🏛️ Sites Suportados

A API suporta scraping dos seguintes sites oficiais:

- **Planalto**: `planalto.gov.br`
- **Câmara dos Deputados**: `camara.leg.br`
- **Senado Federal**: `senado.leg.br`
- **Diário Municipal**: `diariomunicipal.org`

## 📊 Estrutura de Dados

As leis são estruturadas hierarquicamente:

```typescript
Lei {
  id: string
  titulo: string
  numero: string
  ementa: string
  dataPublicacao: Date
  origem: string
  url?: string
  artigos: Artigo[]
}

Artigo {
  numero: string
  conteudo: string
  paragrafos: Paragrafo[]
}

Paragrafo {
  numero: string
  conteudo: string
  incisos: Inciso[]
}

Inciso {
  numero: string
  conteudo: string
  alineas: Alinea[]
}

Alinea {
  letra: string
  conteudo: string
  itens: Item[]
}

Item {
  numero: string
  conteudo: string
}
```

## 🔧 Configuração

### Cache
O sistema usa cache em memória por padrão. Para usar Redis:

```env
REDIS_URL=redis://localhost:6379
```

### Modo Manual-Only
O sistema opera exclusivamente por importação manual:

- Upload de arquivos via `POST /api/upload` e variações
- Scraping sob demanda via `POST /api/scrap`
- Sem varredura automática de diretórios locais e sem scripts de importação automática

### Logging
Configure o nível de log em `src/utils/logger.ts`:

```typescript
const logLevel = process.env.LOG_LEVEL || 'info';
```

## 🧪 Testes

A aplicação possui testes abrangentes:

- **Unitários**: Testam funções individuais
- **Integração**: Testam fluxos completos
- **Middlewares**: Testam validação e tratamento de erros

```bash
# Executar testes específicos
npm test -- --testPathPattern=textParser

# Executar com verbose
npm test -- --verbose

# Gerar relatório de coverage
npm run test:coverage
```

## 🚀 Deploy

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Variáveis de Ambiente para Produção
```env
NODE_ENV=production
DATABASE_URL=postgresql://...
PORT=3000
JWT_SECRET=strong_secret_here
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para suporte e dúvidas:

1. Verifique a documentação da API em `/api-docs`
2. Consulte os logs da aplicação
3. Abra uma issue no repositório

## 📈 Roadmap

- [ ] Melhorias no scraping por URL (robustez, normalização, tolerância a layout)
