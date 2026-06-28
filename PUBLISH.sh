#!/usr/bin/env bash
# VUUP — publica integration/all-waves e abre PR para main.
# Uso: GITHUB_TOKEN=ghp_xxx bash PUBLISH.sh
set -euo pipefail

REPO="wcristian799/Vuup-app"
BRANCH="integration/all-waves"
BASE="main"

: "${GITHUB_TOKEN:?defina GITHUB_TOKEN com escopo repo}"

echo "==> push ${BRANCH} (idempotente)"
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "${BRANCH}:${BRANCH}"

echo "==> abrindo PR ${BRANCH} -> ${BASE}"
HTTP=$(curl -s -o /tmp/pr_resp.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/pulls" \
  -d "{\"title\":\"VUUP — Entrega completa (Ondas 0-6 + QA)\",\"head\":\"${BRANCH}\",\"base\":\"${BASE}\",\"body\":\"Consolida todas as ondas. typecheck limpo, 41 testes frontend + 165 testes server verdes. Ver PUBLISH.md para detalhes.\"}")

if [ "$HTTP" = "201" ]; then
  python3 -c "import json;print('PR criado:',json.load(open('/tmp/pr_resp.json'))['html_url'])"
elif [ "$HTTP" = "422" ]; then
  # 422 = PR já existe para este head->base. Recupera a URL existente em vez de falhar.
  echo "PR já existe (HTTP 422). Recuperando URL do PR aberto..."
  curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/pulls?head=wcristian799:${BRANCH}&base=${BASE}&state=open" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('PR existente:', d[0]['html_url']) if d else print('Push OK; PR não encontrado — abra manualmente pela UI.')"
else
  echo "Falha ao criar PR (HTTP $HTTP):"; cat /tmp/pr_resp.json
  exit 1
fi
