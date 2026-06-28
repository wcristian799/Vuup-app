# Desbloquear o push do PR — passo único (operador)

Você já escolheu o mecanismo: **injetar REPO_GIT e TOKEN_GIT como variáveis de
ambiente nos agentes** (resposta na VUU-53). Falta só o operador colocar os
valores. Os agentes confirmaram que `env` ainda NÃO contém essas variáveis e que
todos os endpoints de secret são board-gated (403/404), então nenhum agente
consegue ler os valores sozinho.

## O passo (na máquina host, fora do sandbox do agente)

Edite o arquivo de ambiente da instância:

    /home/administrador/.paperclip/instances/default/.env

Adicione as duas linhas (cole o token real no lugar de <PAT>):

    REPO_GIT=https://github.com/wcristian799/Vuup-app.git
    TOKEN_GIT=<PAT>     # Personal Access Token com escopo `repo`

Reinicie a instância Paperclip para que os agentes herdem as variáveis.

## O que acontece em seguida (automático)

Assim que `TOKEN_GIT` estiver no ambiente do agente, o CTO (VUU-53/VUU-30/VUU-42)
publica com um comando, a partir da raiz do repo:

    git push https://x-access-token:${TOKEN_GIT}@github.com/wcristian799/Vuup-app.git integration/all-waves
    # depois abre o PR integration/all-waves -> main (via API, sem gh CLI)

Branch `integration/all-waves` = todo o produto (Ondas 0-6 + QA), 33 commits à
frente de `origin/main`, working tree limpo, CI verde. Ver PUBLISH.md.

## Por que o agente não faz sozinho

O valor do token é protegido por board authority (proposital). O agente tem o
nome do secret mas não o valor; injetar via env (sua escolha) é uma ação de
operador/host. Não há gh/glab CLI nem credential helper no sandbox.

## Atualização 28/06 — commit de deploy pendente de push

Além do produto, há agora artefatos de deploy commitados localmente em
`integration/all-waves` que também precisam ir para origin no mesmo push:

- `e430214` — `feat(deploy)`: `server/Dockerfile` + `.dockerignore`, CORS via
  `CORS_ORIGINS`, guard de `AUTH_SECRET` em produção, `vite` base via
  `VITE_BASE`, `vercel.json`, `DEPLOY.md` (runbook Vercel + Coolify).

Verificado local: typecheck limpo, 165/165 testes do servidor, build web com
`VITE_BASE=/`, `/health` 200. O comando de push acima (branch
`integration/all-waves`) já leva este commit junto — nenhum passo extra.
