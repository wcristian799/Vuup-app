# VUUP — Publicação do PR (handoff)

Todo o produto (Ondas 0–6 + QA) está consolidado e **pronto para PR** na branch
`integration/all-waves`. O único bloqueio é credencial de push para o GitHub.
Este documento permite publicar com **um único comando** assim que o token chegar.

## Estado verificado (28/06/2026)

- Branch: `integration/all-waves` — 31 commits à frente de `origin/main`, 209 arquivos (~35.8k inserções). Working tree limpo, CI gate verde.
- `npm run typecheck` (frontend): ✅ limpo
- `npm test` (frontend): ✅ 41/41
- `npm run test:server`: ✅ 165/165
- Remote: `https://github.com/wcristian799/Vuup-app.git` (leitura OK via `ls-remote`; push falta credencial).
- CI já presente em `.github/workflows/ci.yml` (lint + typecheck + testes).

## O único bloqueio

Push falha com:
```
fatal: could not read Username for 'https://github.com': No such device or address
```
Não há `gh`/`glab` CLI, helper de credencial, nem `GITHUB_TOKEN` no ambiente.
É necessário um Personal Access Token com escopo `repo` do dono do repositório.

## Publicar (um comando)

A partir da raiz do repositório, com um token em `$GITHUB_TOKEN`:

```bash
GITHUB_TOKEN=ghp_xxx bash PUBLISH.sh
```

O script faz: configura credencial temporária, push de `integration/all-waves`,
e abre o PR via API do GitHub (sem precisar de `gh` CLI).

## Alternativa manual

```bash
git push https://<TOKEN>@github.com/wcristian799/Vuup-app.git integration/all-waves
# depois abrir PR integration/all-waves -> main pela UI do GitHub
```

## Alternativa offline (sem credencial no sandbox)

O sandbox não tem interop Windows nem helper de credencial, então o push tem que
sair de uma máquina com acesso ao GitHub. Para evitar reconstruir o histórico
(31 commits / 209 arquivos), foi gerado um **git bundle** com todas as branches:

- Arquivo: `vuup-integration-all-waves.bundle` (~568 KB, histórico completo, verificado com `git bundle verify`).
- Refs incluídas: `integration/all-waves`, `feature/VUU-40-capacitor-scaffold`, `feature/VUU-2-pwa-scaffold`, `feature/VUU-22-persistent-backend`.

Numa máquina com credencial GitHub:

```bash
# 1. clonar/atualizar o repo destino
git clone https://github.com/wcristian799/Vuup-app.git && cd Vuup-app
# 2. puxar tudo do bundle
git bundle verify /caminho/vuup-integration-all-waves.bundle
git fetch /caminho/vuup-integration-all-waves.bundle integration/all-waves:integration/all-waves
# 3. publicar
git push origin integration/all-waves
# depois abrir PR integration/all-waves -> main pela UI do GitHub
```

## Conteúdo do PR (resumo por onda)

- Onda 0: scaffold PWA (React 19 + Vite + TanStack Router + Tailwind v4), design system, CI.
- Onda 1: fluxo real de solicitação de corrida (passageiro) + APIs de preço.
- Onda 2: dashboard Motorista/Fundador (carteira, renda passiva, Janela VIP).
- Onda 3: matching realtime (SSE), Disputa de corrida (15s + GPS), Efeito Enxame.
- Onda 4: Entregas & Comércio + Supermercado.
- Onda 5: Carteira Vuup, pagamentos, transfers, campanhas, Upgrade de Sociedade.
- Onda 6: empacotamento Ionic/Capacitor (Android) + deep link `vuup://`.
- Backend persistente (SQLite + auth) e suíte QA E2E/integração.
