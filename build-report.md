# Relatório — Suíte E2E/integração dos fluxos críticos (openticket-relacionamentos)

**Branch:** `test/relacionamentos-e2e-criticos-staging` (base `origin/staging` @ `3f22b55`)
**Worktree:** `/tmp/ot-testes/relacionamentos`
**Data:** 2026-07-11 · QA sênior (vertical relacionamentos)

## Contexto
A vertical relacionamentos tinha **0 testes** e o script era `jest --passWithNoTests`
(gate vazio). Adicionei setup real (jest + jsdom + ts-jest + testing-library),
copiando o padrão de `openticket-eventos/jest.config.ts` (adaptado pra CommonJS
`jest.config.js` pra dispensar `ts-node`).

## Resultado
```
Test Suites: 5 passed, 5 total
Tests:       26 passed, 26 total
```
`npm test` roda a suíte real (não mais `--passWithNoTests`).

## Cobertura — fluxos CRÍTICOS que EXISTEM em staging
Todos mockam a rede (`global.fetch` / gateway `/api/graphql`) e asseguram
render + mutation certa com variables certas + loading/erro/vazio.

| Suíte | Arquivo | Fluxo | Testes |
|---|---|---|---|
| Swipe/match | `src/app/buscar/page.test.tsx` | deck Tinder: `discoverProfiles` → `acceptMatch`(LIKE/SUPER_LIKE)/`rejectMatch`; toast de `status:'matched'` | 6 |
| Checkout premium (DINHEIRO) | `src/app/premium/checkout/page.test.tsx` | `startPremiumCheckout` (R$39,90) e `buyBoostCheckout` (R$9,90); bloqueio sem aceite de termos; banner honesto SANDBOX/UNCONFIGURED | 5 |
| Chat 1:1 | `src/app/chat/id.page.test.tsx` | `messagesInConversation` + `sendMessage(input:{conversationId,content})`; vazio/erro; React 19 `use(params)` via Suspense | 5 |
| Lista de matches | `src/app/matches/page.test.tsx` | `myMatches`; loading/ready/empty/error; campos reais do contrato (intent/note) | 4 |
| Cliente GraphQL (money-path) | `src/lib/gql-client.test.ts` | `gqlRequest`: POST /api/graphql credentials:include; errors[]; HTTP não-ok; 400; "No data returned" | 6 |

## Assertivas reais (exemplos)
- Swipe like → `acceptMatch` com `input:{likedProfileId:'prof-123',type:'LIKE'}`; super → `SUPER_LIKE`; pass → `rejectMatch` (e NÃO `acceptMatch`).
- Checkout sem termos aceitos → NÃO chama o backend (guardrail de dinheiro).
- Checkout `?type=boost` → dispara `buyBoostCheckout` e mostra R$9,90.
- Chat: query carrega com `conversationId` da rota; enviar dispara `sendMessage` e limpa o campo.

## Fora de escopo (honesto)
- **Verificação (`perfil/verificar`)**: o submit é PLACEHOLDER (linha 62-63: "chamada real irá pra @openticket-dev/datavalid"). NÃO wireado a backend real em staging — não testei como fluxo de dinheiro/real. A validação client-side de CPF existe mas o fluxo de verificação em si não persiste nada.

## Alterações (nenhuma em código de produção)
- `package.json`: `test: jest` (era `jest --passWithNoTests`) + devDeps de teste.
- `jest.config.js`, `jest.setup.ts` (mocks next/link, next/navigation, scrollIntoView).
- 5 arquivos `*.test.ts(x)`.
- `package-lock.json` (install das devDeps).

## Notas técnicas
- Chat usa React 19 `use(params)`: render envolto em `<Suspense>` + flush via `act` + macrotask pra liberar o boundary antes das asserções.
- `next/link`/`next/navigation` mockados no `jest.setup.ts` (sem router real).
- NÃO push (responsabilidade do publisher).
