# Mapeamento do fluxo autenticado de GRU (meu.inpi.gov.br/pag)

Levantado ao vivo em 14/07/2026 via `scripts/capture-gru.ts <organizationId>`
(conta e-INPI conectada no cofre). HTML/JS de referência ficam em
`scripts/.gru-capture/` (git-ignorado — contém dados da conta).

## Autenticação (JÁ IMPLEMENTADO e verificado)

- `GET /pag/` → serve o formulário de login e devolve o cookie `JSESSIONID`.
- Cliente grava também o cookie `sessionStorageValue = <tab-id>`.
- `POST /pag/autenticar` com `usuario.tab_id`, `usuario.browser`,
  `usuario.login`, `usuario.senha` (form-urlencoded).
  - **Sucesso:** `302 → /pag/gru/gerar` (a landing autenticada é a tela de emissão).
  - **Falha:** volta para a tela de login (`id="loginForm"`).
- ⚠️ `/pag/` e `/pag/` (com barra) **sempre** servem login, mesmo autenticado —
  não use isso para detectar sessão. Detecte pelo destino do redirect do
  `/autenticar` (é o que `GruSession.login` faz hoje, corretamente).
- gov.br **não** é suportado (usa o botão "Entrar com GOV.BR" → `/pag/lu/entrarGovBr`,
  com captcha/SSO). Aqui só login/senha e-INPI.

## Premissa central: tudo é centrado no CLIENTE (pagador)

Tanto emitir quanto consultar exigem **selecionar um cliente primeiro** (CPF/CNPJ).
O JS de `/pag/minhasgrus/` bloqueia a pesquisa se nenhum cliente foi escolhido
("Escolha um cliente para fazer a pesquisa"). Na modelagem da JurisPI, o cliente
sai do cadastro `Client`/`Case`.

## Consulta / listagem — `/pag/minhasgrus/` (forms HTML normais, PRG)

- `form-pesquisa-gru` → **POST `/pag/minhasgrus/pesquisa`** → responde `302` e os
  resultados são renderizados no `GET /pag/minhasgrus/` seguinte (Post/Redirect/Get).
  Campos:
  - `tipoPesquisa` = `D` (por data) ou `G` (por número da GRU)
  - `dataInicio`, `dataFim` no formato `dd/MM/yyyy` (quando `D`)
  - `numeroGru` (máx. 17 dígitos, quando `G`)
  - `cpfcnpj`, `clienteNome` (cliente selecionado)
  - `pagina`, `tamanhoPagina` (paginação; `form-navegacao-pagina` re-posta)
- `form-gera-segundavia` → **GET `/pag/minhasgrus/segundaviaboleto?codGru=<id>`** (2ª via do boleto)
- `form-gera-recibo` → **POST `/pag/minhasgrus/download/recibo`** (`codGru=<id>`)
- ⚠️ **Estrutura da tabela de resultados ainda NÃO confirmada:** a conta usada no
  mapeamento nunca emitiu GRU, então a seção "Resultado" veio vazia e é renderizada
  no servidor só quando há dados. Precisa de uma conta com GRUs (ou um número de GRU
  real) para fixar colunas (número, situação, valor, vencimento, `codGru`) e escrever
  o parser de `fetchGruStatus`.

## Emissão — `/pag/gru/gerar` (assistente AJAX com "cesta"/carrinho)

Fluxo por etapas (endpoints extraídos de `js/pagina/gru/index.js` e `modal.js`;
todos sob a base `/pag`):

1. **Selecionar cliente:** `POST /pag/gru/pesquisar/cliente/` (modal) — busca por
   documento/nome; `POST /pag/gru/buscar/cliente/`.
2. **Escolher serviço:** `POST /pag/gru/pesquisar/servico/` e
   `GET /pag/gru/buscar/servico/modal/...` — natureza → tipo de serviço → serviço
   (código da tabela de retribuições).
3. **Validações do processo/petição** (conforme o serviço):
   `/pag/gru/validarProcesso/`, `/pag/gru/verificarProcessoRegistroMarca/`,
   `/pag/gru/verificarCopiaOficial/`, `/pag/gru/validarObjetoPeticao/`,
   `/pag/gru/preencherQuantidadeDeClassesNiceOuNacional/`, `/pag/gru/buscar/peticao/total`.
4. **Cesta:** `POST /pag/gru/modal/incluir/servico`, `/pag/gru/modal/excluir/servico`,
   `/pag/gru/modal/visualizar/servico/`.
5. **Preview do valor:** `GET/POST /pag/gru/mostrar/preview`.
6. **Gerar a GRU:** **`POST /pag/gru/finalizar/gerarGru`** — ⚠️ **gera uma GRU real,
   com taxa/retribuição real do INPI.** Não testar sem autorização explícita e um
   código de serviço definido.

Campos do assistente (ids na tela): `select-dados-servico-natureza`,
`select-tipo-servico`, `select-servico`, `select-dados-servico-apresentacao`,
`input-servico-processo-administrativo`, `select-dados-servico-revista`,
`select-dados-servico-objeto-peticao`, `select-dados-servico-peticao-vinculada`,
`servico-total-solicitacoes`, `servico-valor-monetario`, entre outros.

## Estado da implementação (`src/lib/inpi/gru/`)

**TUDO IMPLEMENTADO E VERIFICADO AO VIVO (14/07/2026)**, com GRU real
29409172360927772 (serviço 389, R$ 440,00, não paga — expira sozinha):

- ✅ Cofre AES-256-GCM, login, verify, registro/listagem local (`InpiGru`).
- ✅ Catálogo: `GET /pag/gru/buscar/tipoServico`, `GET .../servico/diretoria/<d>`,
  `GET /pag/gru/pesquisar/servico/<s>/diretoria/<d>` (flags), selects auxiliares.
- ✅ Preview: `POST /pag/gru/mostrar/preview` (form-urlencoded `servico.*`).
- ✅ Emissão: `POST /pag/gru/finalizar/gerarGru` → responde o **número da GRU como
  string JSON**; `GET /pag/gru/finalizada` traz `/gru/imprimir/codigo/<id>` (boleto)
  e `/gru/copiar/codigo/<id>` (código de barras).
- ✅ Consulta: `POST /pag/minhasgrus/pesquisa` (PRG) — tabela: GRU | Serviço
  ("cód - nome") | Valor ("R$ 440.00") | Situação | 2ª via | Recibo | Data.
  2ª via: `GET /pag/minhasgrus/segundaviaboleto?codGru=<nº da GRU>` (PDF).
- ✅ Parsers puros com testes (`__tests__/gru-parser.test.ts` + fixtures sanitizadas).

## Gotchas descobertos na implementação

- **JSON em ISO-8859-1:** os endpoints AJAX respondem `charset=ISO-8859-1`; decodificar
  pelo charset do Content-Type (undici ignora e assume UTF-8 → acentos quebrados).
- **Pesquisa por data limitada a ~30 dias:** intervalos maiores retornam **vazio sem
  erro**. O `syncGrus` fatia o período em janelas de 30 dias na mesma sessão.
- **Conta sem perfil de procurador** (`temProcurador=false`): o pagador é o próprio
  titular da conta e-INPI, já fixado na sessão — não há seleção de cliente.
- Emissão sem preview prévio funciona, mas o preview na mesma sessão é o que dá o valor.
