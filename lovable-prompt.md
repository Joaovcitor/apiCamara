# Lovable Prompt — Portal de Leis (Admin + Público)

## Objetivo
- Construir um portal de leis com dois perfis principais:
  - Administradores: responsáveis por enviar leis, organizar pastas do "Computador das Leis", fazer upload de arquivos, reprocessar documentos e acompanhar logs/erros.
  - Público geral: pessoas que acessam leis publicadas, pesquisam, filtram, visualizam detalhes e exportam.

## Personas
- Administrador(a) da Câmara: cria/organiza pastas por exercício/ano, sobe autógrafos, acompanha processamento e corrige falhas.
- Colaborador(a) de secretaria: auxilia na digitalização e envio de documentos.
- Cidadão(ã): busca leis, navega por ano/tema/número, lê e exporta.

## Escopo Administrativo
- Dashboard com visão geral:
  - Indicadores: total de leis, leis por ano, documentos pendentes/erro, última importação.
  - Ações rápidas: importar autógrafos por pasta, reprocessar documento, buscar documento por nome.
- Gerenciamento de pastas e arquivos:
  - Listar conteúdo do `COMPUTADOR_DAS_LEIS` e subpastas.
  - Configurar raiz por ambiente (`AUTOGRAFOS_BASE_DIR`) ou pasta direta (`AUTOGRAFOS_DIR`).
  - Criar pastas de “Exercício de AAAA” e subpastas “Autógrafos”.
  - Upload manual de `.doc`/`.docx` com associação a ano/exercício.
  - Visualizar, baixar e remover arquivos importados (com confirmação).
- Importação e processamento:
  - Importar por pasta: varredura de “Exercício de AAAA” e dentro delas arquivos/diretórios que começam com “Autógrafo…”.
  - Importar arquivo único: enviar e processar diretamente.
  - Processamento com extração de múltiplas leis num mesmo documento pelo padrão de autógrafo.
  - Logs detalhados: arquivos ignorados (temp/lock), sucessos, falhas (ex.: documento sem texto), contagem por ano.
- Correções e reprocessamentos:
  - Reprocessar documento previamente armazenado.
  - Editar metadados da lei (título, número, ementa, data, origem).
  - Excluir lei e seus relacionamentos (com confirmação dupla).

## Regras e Validações
- Ignorar arquivos temporários do Office (`~$…`, `.~lock…`) e não-Word.
- Aceitar apenas `.doc` e `.docx` válidos; detectar e informar quando não há conteúdo textual.
- Padrão de detecção de autógrafos no conteúdo:
  - `aut[óo]grafo(s)? de lei( complementar)? (nº|n|n°)? <número>`
- Extração de título/número/data/ementa sempre que possível.
- Garantir unicidade razoável por `numero`+`ano` (se houver); permitir duplicatas quando necessário com aviso.

## Integrações e Ambiente
- Back-end Node/TypeScript já existente com Prisma/PostgreSQL.
- Variáveis de ambiente:
  - `AUTOGRAFOS_DIR`: caminho direto para varredura recursiva de autógrafos.
  - `AUTOGRAFOS_BASE_DIR`: raiz que contém pastas “Exercício de AAAA”.
  - `DATABASE_URL`: conexão PostgreSQL via Prisma.
- Serviços existentes (usar/consumir via API/UI):
  - Processamento de documentos (`DocumentService.processWordDocumentMultiple`).
  - Parser (`TextParser`) com suporte a múltiplas leis por autógrafo.
  - Salvamento de leis (`LeiService.saveLei`).

## UI e Navegação — Admin
- Página “Importar Autógrafos”:
  - Selecionar modo: raiz por ano (base) ou pasta direta.
  - Campo para caminho (com persistência por usuário) e botões “Validar”, “Importar”.
  - Tabela de resultado por ano: arquivos processados, leis salvas, falhas.
  - Filtro por ano e por status (sucesso/erro).
- Página “Arquivos do Computador das Leis”:
  - Browser de diretórios com breadcrumbs.
  - Ações: criar pasta, renomear, mover, excluir, upload.
- Página “Logs & Falhas”:
  - Lista de falhas com arquivo, motivo e ação “Reprocessar”.
- Página “Leis” (Admin):
  - Lista paginada com filtros (ano, número, título).
  - Ações: editar metadados, excluir, exportar.

## Escopo Público
- Página inicial com destaque de últimas leis e busca rápida.
- Lista de leis com filtros:
  - Por ano (Exercício), número, tipo (Lei/Complementar), texto livre (título/ementa).
- Página da lei:
  - Título, número, data, ementa.
  - Texto completo quando houver.
  - Estrutura hierárquica: artigos, parágrafos, incisos, alíneas, itens.
  - Link “origem” do arquivo.
  - Botões de exportar (PDF/HTML/JSON) se disponíveis.
- Acessibilidade e responsividade completas.

## Pesquisa
- Barra de busca global (título, número, ementa, texto).
- Filtros combináveis: ano, tipo, número.
- Ordenação: mais recente, número crescente.

## Segurança & Permissões
- Admin:
  - Login (pode ser básico inicialmente).
  - Acesso a upload/import/logs/edição/exclusão.
- Público:
  - Acesso de leitura sem login.

## Critérios de Aceite
- Admin consegue configurar caminho base/pasta e importar com feedback por ano.
- Arquivos temporários e inválidos são ignorados com log.
- Parser detecta múltiplas leis em autógrafos e salva todas corretamente.
- Público consegue buscar, filtrar e visualizar estrutura completa das leis.
- Exportar link/origem presente em cada lei.

## Métricas & Logs
- Métricas de importação por ano: processados, salvos, falhas.
- Logs de erros de leitura/parse/salvamento com ação de reprocessar.

## Glossário
- “Exercício de AAAA”: diretório por ano.
- “Autógrafo”: documento base contendo o texto da(s) lei(s) aprovada(s).

## Notas Técnicas ao Lovable
- Considerar que a detecção de autógrafos é pelo conteúdo, não apenas pelo nome do arquivo.
- Usar as variáveis `AUTOGRAFOS_DIR` e `AUTOGRAFOS_BASE_DIR` para os dois modos de importação.
- Implementar UI de navegação de diretórios com operações básicas.
- Expor no Admin a execução de importação e reprocessamento com logs.
- Na visualização pública, renderizar a hierarquia jurídica com boa legibilidade.

## Scraping & Categorias — Front
### Ferramenta de scraping (UI)
- Página com formulário: campos `URL`, seletores `title[]`, `ementa[]`, `content[]`, `linkSelectors[]`.
- Botão “Pré-visualizar” que chama `POST /scrap/custom` e renderiza resultado (título, ementa, blocos de texto) antes de salvar.
- Mostrar erros de rede/parse com toasts e dicas para ajustar seletores.
- Opcional: iframe de referência da página-alvo para inspecionar elementos e copiar seletores.

### Listagem de links (UI)
- Página com campos `URL`, `linkSelectors[]` e `hrefInclude`.
- Ao enviar, consumir `POST /scrap/links` e exibir tabela de links: `texto`, `url`, `selecionado` (checkbox).
- Ações: “Abrir”, “Copiar”, “Scrap Selecionados” (dispara scraping por lote).

### Categorias (UI)
- Tela “Categorias”: lista com `nome`, `slug`, contagem de palavras; botões “Nova categoria”, “Adicionar palavras”.
- Modal de criação: `nome`, `descricao`, `keywords[]` opcionais; chama `POST /categorias`.
- Modal de palavras: aceita múltiplas entradas; chama `POST /categorias/:id/keywords` e atualiza lista.
- Detalhe da Lei: exibir badges de categorias calculadas (consumir `POST /leis/:id/categorize`); botão “Recalcular”.

### Diretrizes de consumo de API
- Centralizar base URL e headers (incl. `Content-Type: application/json`).
- Tratar estados: loading, sucesso, erro; feedback via toasts e skeletons.
- Cachear dicionário em memória/estado global; invalidar ao criar/adicionar keywords.
- Validar formulários no front com `zod` (ou lib similar) antes de enviar.

## Upload — Front
- Página de upload: drag & drop e seleção de arquivo `.doc/.docx` com preview de metadados.
- Campos para associar ano/exercício; barra de progresso e resultado por arquivo.
- Exibir logs de processamento e ações “Reprocessar” e “Excluir” quando disponíveis.
- Regras: avisar e bloquear temporários do Office; mensagens claras quando não houver texto.