# API para o Front-end — Rotas e Dados Esperados

Este documento reúne todas as rotas disponíveis da API (com base `/api`) e descreve, do ponto de vista do front-end, como fazer as requisições e quais dados esperar em cada resposta.

## Convenções

- Base URL: `/api` (todas as rotas abaixo presumem esse prefixo)
- Formato padrão: `application/json` para requisições e respostas, exceto uploads (`multipart/form-data`)
- Envelope de resposta: `ApiResponse` com chaves: `success: boolean`, `data?: T`, `error?: string`, `message?: string`
- Códigos de status comuns: `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `413 Payload Too Large`, `429 Too Many Requests`, `502 Bad Gateway`
- Rate limit: rotas pesadas (`/scrap`, `/upload`) têm limitação adicional; o back pode retornar `429` com `{ success: false, error: '...' }`
- Arquivos estáticos: uploads feitos são servidos em `/files/<nome_armazenado>` (útil para exibir/prever arquivos enviados)
- **Autenticação**: JWT via cookie `authToken` (`httpOnly`). Envie requisições com `credentials: 'include'`.
- **Autorização**: Algumas operações (criar, editar, deletar leis) são restritas a funcionários autenticados com role `funcionario`
 - **Admin**: Gestão de usuários (`/users`) é restrita a contas com role `admin`

---

## Health

- GET `/api/health`
  - Uso: checagem rápida de disponibilidade
  - Resposta: `200` `{ success: true, message: string, timestamp: string, version: string }`
  - Exemplo:
    ```json
    {
      "success": true,
      "message": "API funcionando corretamente",
      "timestamp": "2025-01-01T12:00:00.000Z",
      "version": "1.0.0"
    }
    ```

---

## Autenticação

- POST `/api/auth/login`
  - Body (JSON): `{ email: string, password: string }`
  - Resposta `200`: `{ success: true, data: { token: string, user: { id: string, email: string, name: string, role: string } }, message: string }`
  - Erros: `400` (credenciais inválidas), `401` (email/senha incorretos)
  - Exemplo request:
    ```json
    { "email": "funcionario@camara.gov.br", "password": "senha123" }
    ```
  - Exemplo response:
    ```json
    {
      "success": true,
      "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
          "id": "func_001",
          "email": "funcionario@camara.gov.br",
          "name": "João Silva",
          "role": "funcionario"
        }
      },
      "message": "Login realizado com sucesso"
    }
    ```

- GET `/api/auth/me`
  - Cookies: `authToken` (httpOnly) enviado automaticamente; use `credentials: 'include'`
  - Resposta `200`: `{ success: true, data: { id: string, email: string, name: string, role: string }, message: string }`
  - Erros: `401` (token inválido/expirado), `403` (token malformado)
  - Uso: verificar se o token ainda é válido e obter dados do usuário logado

Exemplo (fetch) — login e uso com cookies:

```ts
// Login (cookie httpOnly será definido pelo servidor)
const loginRes = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'funcionario@camara.gov.br',
    password: 'senha123',
  }),
});

// Requisição protegida usando cookies
const protectedRes = await fetch('/api/leis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ titulo: 'Nova Lei', numero: '123/2024' }),
});
```

Notas:

- Autenticação por cookies: ao logar, o backend define o cookie httpOnly `authToken` com o JWT; o front deve enviar `credentials: 'include'` (ou `axios.withCredentials = true`).

- O login prioriza usuários cadastrados no banco (validação com `bcrypt` sobre `passwordHash`).
- Se o e-mail não existir no banco, há fallback para credenciais de admin definidas em variáveis de ambiente (`ADMIN_EMAIL`/`ADMIN_PASSWORD`).

---

## Usuários (Admin)

- Todas as rotas abaixo são protegidas por cookie `authToken` e requerem role `admin`. Envie as requisições com `credentials: 'include'`.
- As respostas retornam objetos de usuário seguros (sem `passwordHash`).

- GET `/api/users` 🔒
  - Query: `page?: number=1`, `limit?: number<=100=20`
  - Resposta `200`: `{ success: true, data: { items: UserAdminView[], pagination: { page, limit, total, totalPages } } }`
  - `UserAdminView`: `{ id: string, email: string, name?: string, role: 'admin'|'funcionario', createdAt: string, updatedAt: string }`

- GET `/api/users/:id` 🔒
  - Path: `id` (CUID)
  - Resposta `200`: `{ success: true, data: UserAdminView }`
  - Erros: `404` (não encontrado)

- POST `/api/users` 🔒
  - Body (JSON): `{ email: string, name?: string, role: 'admin'|'funcionario', password: string }`
  - Resposta `201`: `{ success: true, data: UserAdminView, message: 'Usuário criado com sucesso' }`
  - Regras:
    - `password` é armazenada como hash (`bcrypt`).
    - `email` deve ser único.
  - Erros: `400` (campos obrigatórios), `409` (e-mail já existe, se aplicável)
  - Exemplo request:
    ```json
    {
      "email": "novo.funcionario@camara.gov.br",
      "name": "Maria Souza",
      "role": "funcionario",
      "password": "senhaSegura123"
    }
    ```

- PUT `/api/users/:id` 🔒
  - Path: `id` (CUID)
  - Body (JSON): Campos parciais ou totais `{ email?, name?, role?, password? }`
  - Resposta `200`: `{ success: true, data: UserAdminView, message: 'Usuário atualizado com sucesso' }`
  - Observação: se `password` for enviada, será re-hasheada com `bcrypt` antes de salvar
  - Erros: `400` (dados inválidos), `404` (não encontrado)

- DELETE `/api/users/:id` 🔒
  - Path: `id`
  - Resposta `200`: `{ success: true, message: 'Usuário removido com sucesso' }`
  - Erros: `404` (não encontrado)

Exemplos (fetch) — criar e listar usuários:

```ts
// Criar usuário
await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'novo.funcionario@camara.gov.br',
    name: 'Maria Souza',
    role: 'funcionario',
    password: 'senhaSegura123',
  }),
});

// Listar usuários (paginado)
const res = await fetch('/api/users?page=1&limit=20', { credentials: 'include' });
const json = await res.json();
```

---

## Scraping

- POST `/api/scrap`
  - Body (JSON): `{ url: string }`
  - Resposta `200`: `{ success: true, data: Lei, message: string }`
  - Erros: `400` (URL inválida), `408` (timeout), `502` (problema externo)
  - Exemplo request:
    ```json
    { "url": "https://www.planalto.gov.br/ccivil_03/leis/l8080.htm" }
    ```

- POST `/api/scrap/batch`
  - Body (JSON): `{ urls: string[] }` (máx. 10)
  - Resposta `200`: `{ success: true, data: { successful: Lei[], failed: { url: string, error: string }[] }, message: string }`
  - Erros: `400` (lista ausente ou > 10)

- POST `/api/scrap/custom`
  - Body (JSON): `{ url: string, selectors: { title: string[], ementa?: string[], content: string[] } }`
  - Resposta `200`: `{ success: true, data: Lei, message: string }`
  - Erros: `400` (campos obrigatórios), `502` (falha no scraping custom)

- POST `/api/scrap/links`
  - Body (JSON): `{ url: string, selectors: string[], hrefInclude?: string }`
  - Resposta `200`: `{ success: true, data: ListedLink[], message: string }`
  - Onde `ListedLink` = `{ url: string, text?: string }`

---

## Upload

- POST `/api/upload`
  - Formato: `multipart/form-data`
  - Campo: `file` (binário `.doc` ou `.docx`)
  - Resposta `200`: `{ success: true, data: Lei, message: 'Arquivo processado e lei salva com sucesso' }`
  - Regras de validação:
    - Bloqueia arquivos temporários do Office/LibreOffice (`~$`, `.~lock`, etc.)
    - Extensões permitidas: `.doc`, `.docx`
    - MIME permitido: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/octet-stream`
    - Tamanho máx.: `10MB` por arquivo
  - Erros: `400` (nenhum arquivo / formato inválido), `413` (muito grande), `429` (rate limit)
  - Dica front: use `FormData` com `file` e não defina manualmente o `Content-Type` (o navegador define boundary)

- POST `/api/upload/batch`
  - Formato: `multipart/form-data`
  - Campo: `files` (até 10 arquivos `.doc`/`.docx`)
  - Resposta `200`: `{ success: true, data: { successful: Lei[], failed: { filename: string, error: string }[] }, message: 'Processamento concluído' }`
  - Erros: `400` (nenhum arquivo / > 10), `413` (soma > 50MB), `429`

- POST `/api/upload/validate`
  - Formato: `multipart/form-data`
  - Campo: `file`
  - Resposta `200`: `{ success: true, data: { filename, size, mimetype, isValid }, message }`
  - Uso: validar antes de enviar via `/upload` (preview rápido)

Exemplo (fetch) — upload simples:

```ts
const form = new FormData();
form.append('file', selectedFile);
const res = await fetch('/api/upload', { method: 'POST', body: form });
const json = await res.json();
```

---

## Leis

### Rotas Públicas (sem autenticação)

- GET `/api/leis`
  - Query: `page?: number=1`, `limit?: number<=100=10`, `search?: string`, `origem?: 'scraping'|'upload'`
  - Resposta `200`: `{ success: true, data: { items: LeiWithRelations[], pagination: { page, limit, total, totalPages } }, message }`
  - Observação: quando `search` é enviado, a busca considera título, ementa e número

- GET `/api/leis/stats`
  - Resposta `200`: `{ success: true, data: { total: number, porOrigem: { scraping: number, upload: number }, ultimasAdicionadas: LeiSummary[] }, message }`

- GET `/api/leis/:id`
  - Path: `id` (CUID)
  - Resposta `200`: `{ success: true, data: LeiWithRelations, message }`
  - Erros: `404` (não encontrada)

### Rotas Protegidas (requer autenticação de funcionário)

- POST `/api/leis` 🔒
  - Cookies: `authToken` (httpOnly) — envie com `credentials: 'include'`
  - Body (JSON): Estrutura completa da lei (ver schema `LeiCreateInput`)
  - Resposta `201`: `{ success: true, data: LeiWithRelations, message: 'Lei criada com sucesso' }`
  - Erros: `400` (dados inválidos), `401` (não autenticado), `403` (sem permissão)
  - Exemplo request:
    ```json
    {
      "titulo": "Lei Municipal de Trânsito",
      "numero": "123/2024",
      "ementa": "Dispõe sobre normas de trânsito no município",
      "data": "2024-01-15",
      "textoCompleto": "Art. 1º Esta lei estabelece...",
      "capitulos": [
        {
          "numero": "I",
          "titulo": "Das Disposições Gerais",
          "artigos": [
            {
              "numero": "1º",
              "texto": "Esta lei estabelece normas de trânsito.",
              "paragrafos": [
                {
                  "numero": "1º",
                  "texto": "As normas aplicam-se a todos os veículos."
                }
              ]
            }
          ]
        }
      ]
    }
    ```

- PUT `/api/leis/:id` 🔒
  - Cookies: `authToken` (httpOnly) — envie com `credentials: 'include'`
  - Path: `id` (CUID)
  - Body (JSON): Estrutura completa da lei para substituição total
  - Resposta `200`: `{ success: true, data: LeiWithRelations, message: 'Lei substituída com sucesso' }`
  - Erros: `400` (dados inválidos), `401` (não autenticado), `403` (sem permissão), `404` (lei não encontrada)
  - Observação: substitui completamente a lei existente, incluindo toda a estrutura hierárquica

- PATCH `/api/leis/:id` 🔒
  - Cookies: `authToken` (httpOnly) — envie com `credentials: 'include'`
  - Path: `id` (CUID)
  - Body (JSON): Campos parciais para atualização (ver schema `LeiUpdateInput`)
  - Resposta `200`: `{ success: true, data: LeiWithRelations, message: 'Lei atualizada com sucesso' }`
  - Erros: `400` (dados inválidos), `401` (não autenticado), `403` (sem permissão), `404` (lei não encontrada)
  - Exemplo request (atualização parcial):
    ```json
    {
      "titulo": "Novo Título da Lei",
      "ementa": "Nova ementa atualizada"
    }
    ```

- DELETE `/api/leis/:id` 🔒
  - Cookies: `authToken` (httpOnly) — envie com `credentials: 'include'`
  - Path: `id`
  - Resposta `200`: `{ success: true, message: 'Lei removida com sucesso' }`
  - Erros: `401` (não autenticado), `403` (sem permissão), `404` (lei não encontrada)

- GET `/api/leis/:id/export?format=json|text`
  - Path: `id`, Query: `format` (`json` padrão; `text` para `.txt`)
  - Resposta `200`:
    - `json`: corpo é o objeto `Lei` (sem envelope), com headers `Content-Type: application/json` e `Content-Disposition: attachment; filename="<numero>.json"`
    - `text`: corpo é `text/plain` com o conteúdo linear da lei, com `Content-Disposition: attachment; filename="<numero>.txt"`

- POST `/api/leis/:id/categorize`
  - Body (opcional): `{ dictionary?: Record<string, string[]>, minScore?: number }`
  - Resposta `200`: `{ success: true, data: { id: string, categories: string[], dictionary: Record<string, string[]> }, message }`
  - Observação: se `dictionary` não for enviado, usa o dicionário do banco; se falhar, usa o default embutido

Exemplo (fetch) — categorizar lei:

```ts
const res = await fetch(`/api/leis/${leiId}/categorize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ minScore: 2 }),
});
const json = await res.json();
// json.data.categories → slugs de categorias
```

---

## Categorias

- GET `/api/categorias`
  - Resposta `200`: `{ success: true, data: Categoria[] }`
  - `Categoria`: `{ id: string, nome: string, slug: string, descricao?: string, criadoEm: string, atualizadoEm: string, palavras: { id: string, termo: string, categoriaId: string }[] }`

- GET `/api/categorias/dicionario`
  - Resposta `200`: `{ success: true, data: Record<slug, string[]> }`

- POST `/api/categorias`
  - Body (JSON): `{ nome: string, slug?: string, descricao?: string, keywords?: string[] }`
  - Resposta `201`: `{ success: true, data: Categoria }` (inclui `palavras` já associadas)
  - Erros: `400` (nome obrigatório)

- POST `/api/categorias/:id/keywords`
  - Body (JSON): `{ keywords: string[] }`
  - Resposta `200`: `{ success: true, data: { added: number } }`
  - Erros: `400` (lista vazia ou id ausente)

---

## Tipos (referência rápida)

### Autenticação

- `LoginRequest`: `{ email: string, password: string }`
- `LoginResponse`: `{ token?: string, user: UserInfo }`
- `UserInfo`: `{ id: string, email: string, name: string, role: string }`

### Usuários

- `UserAdminView`: `{ id: string, email: string, name?: string, role: 'admin'|'funcionario', createdAt: string, updatedAt: string }`
- `UserCreateInput`: `{ email: string, name?: string, role: 'admin'|'funcionario', password: string }`
- `UserUpdateInput`: `{ email?: string, name?: string, role?: 'admin'|'funcionario', password?: string }`

### Leis

- `LeiWithRelations` básico: `{ id, titulo, ementa?, numero, data?, origem, textoCompleto?, criadoEm, atualizadoEm, capitulos: CapituloWithRelations[] }`
- `CapituloWithRelations`: `{ id, numero, titulo?, ordem, artigos: ArtigoWithRelations[] }`
- `ArtigoWithRelations`: `{ id, numero, texto, ordem, paragrafos: ParagrafoWithRelations[], incisos: IncisoWithRelations[], capituloId?, capitulo? }`
- `ParagrafoWithRelations`: `{ id, numero, texto, ordem, incisos: IncisoWithRelations[], alineas: AlineaWithRelations[] }`
- `IncisoWithRelations`: `{ id, numero, texto, ordem, alineas: AlineaWithRelations[], itens: ItemWithRelations[] }`
- `AlineaWithRelations`: `{ id, letra, texto, ordem, itens: ItemWithRelations[] }`
- `ItemWithRelations`: `{ id, numero, texto, ordem }`

### Schemas de Input

- `LeiCreateInput`: Estrutura completa para criação de lei (inclui capitulos, artigos, paragrafos, incisos, alineas, itens)
- `LeiUpdateInput`: Campos opcionais para atualização parcial (titulo?, ementa?, numero?, data?, textoCompleto?)

### Outros

- `ListedLink`: `{ url: string, text?: string }`
- `Categoria`: `{ id, nome, slug, descricao?, criadoEm, atualizadoEm, palavras: CategoriaKeyword[] }`

---

## Padrões de erro

- Sempre `{ success: false, error: string }` (podem existir chaves extras como `path`, `method` em 404 globais)
- **Autenticação/Autorização**:
  - `401 Unauthorized`: Token ausente, inválido ou expirado
  - `403 Forbidden`: Token válido mas usuário sem permissão para a operação (role inadequada)
- **Validação**:
  - `400 Bad Request`: Dados inválidos, campos obrigatórios ausentes, formato incorreto
  - JSON inválido retorna `400` com `{ success: false, error: 'JSON inválido' }`
- **Upload**: pode retornar mensagens específicas do Multer: `LIMIT_FILE_SIZE` (413), `LIMIT_FILE_COUNT` (400), `LIMIT_UNEXPECTED_FILE` (400)
- **Rate Limit**: `429 Too Many Requests` com tempo de espera sugerido

---

## Boas práticas no front

### Autenticação e Segurança

- **Armazenamento de token**: Não armazene JWT no front. Use cookie `httpOnly` gerenciado pelo navegador.
- **Interceptors**: Use `credentials: 'include'` (fetch) ou `axios.defaults.withCredentials = true` em vez de header `Authorization`.
- **Renovação de token**: Implemente lógica para detectar tokens expirados (401) e redirecionar para login
- **Logout**: Limpe o token do storage local ao fazer logout
- **Validação de role**: Verifique a role do usuário antes de exibir funcionalidades restritas (criar/editar/deletar leis)

### Tratamento de Erros

- **401 Unauthorized**: Redirecione para tela de login e limpe tokens armazenados
- **403 Forbidden**: Exiba mensagem informando que o usuário não tem permissão
- **429 Rate Limit**: Implemente backoff exponencial e UI amigável (ex.: snackbar com tempo de espera)

### Performance e UX

- **Upload**: Use `FormData` e deixe o browser definir o boundary
- **Export**: Leia `Content-Type` e `Content-Disposition` para baixar arquivos corretamente
- **Cache**: Cache leve de `/categorias/dicionario` e invalide após criar/alterar categorias
- **Validação**: Use `zod` para validar dados antes de enviar e antes de consumir

### Exemplo de Interceptor (Axios)

```ts
// Enviar cookies httpOnly automaticamente
axios.defaults.withCredentials = true;

// Interceptor para tratar erros de autenticação
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```
