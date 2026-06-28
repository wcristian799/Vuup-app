# VUUP — Relatório de Smoke Test Mobile (Capacitor) — VUU-37

**Data:** 2026-06-28  
**Autor:** QA & Test Engineer (agente Paperclip `650b42c9`)  
**Versão do app:** `vuup-pwa@0.1.0`  
**Issue:** [VUU-37](/VUU/issues/VUU-37)  
**Dependência declarada:** [VUU-24](/VUU/issues/VUU-24) (scaffold Capacitor)

---

## Resumo Executivo

> ⚠️ **BLOQUEANTE — Scaffold Capacitor ausente**

O scaffold Capacitor descrito no [VUU-24](/VUU/issues/VUU-24) **não está presente no repositório**. Não existem os pacotes `@capacitor/core` / `@capacitor/cli` no `package.json`, não há `capacitor.config.ts`, nem os diretórios `android/` ou `ios/`. O `notes/stack-analysis.md` confirma que a integração Capacitor foi apontada como trabalho futuro ("later mobile sprint"), indicando que o VUU-24 pode ter sido marcado como `done` com base no planejamento, mas sem entrega do artefato no código.

Como resultado, os testes nativos Android/iOS **não puderam ser executados**. Este relatório documenta:
1. O estado atual verificado do repositório (build web/PWA funcional).
2. Todos os critérios de aceite avaliados — com status de cada um.
3. Divergências PWA vs. nativo identificadas com base na análise estática.
4. Ações corretivas necessárias antes de re-executar os testes.

---

## Ambiente de Teste

| Item | Valor |
|---|---|
| SO do host | Linux (servidor CI) |
| Node | v22.x |
| npm | v10.x |
| Capacitor CLI | ❌ não instalado |
| Emulador Android | ❌ não configurado |
| Emulador iOS | ❌ não aplicável (requer macOS) |
| Build web | ✅ `npm run build` — sucesso |
| Testes unitários | ✅ `npm test` — 4/4 passando |
| TypeScript | ✅ `npm run typecheck` — sem erros |

---

## Critérios de Aceite — Status

### CA-1: Build Capacitor gera APK funcional sem erros de sync

**Status: ❌ FALHOU — Não executável**

- `@capacitor/core` e `@capacitor/cli` **ausentes** do `package.json`.
- Nenhum `capacitor.config.ts` (ou `.js`) encontrado.
- Nenhum diretório `android/` presente.
- Comando `cap sync` não pode ser executado.

**Pré-condição faltante:**
```bash
npm install @capacitor/core @capacitor/cli
npx cap init VUUP com.vuup.app --web-dir dist
npx cap add android
```

---

### CA-2: Fluxo corrida ponta-a-ponta roda no emulador Android sem crashar

**Status: ❌ BLOQUEADO — Emulador não disponível**

Sem APK gerado (CA-1 falhou), este critério não pôde ser executado.

**Análise estática do fluxo crítico (PWA):**

O fluxo `login → solicitar corrida → aceitar corrida → pagamento (wallet stub)` foi mapeado nos componentes existentes:

| Etapa | Componente / API | Estado no código |
|---|---|---|
| Login (OTP) | `apiClient.auth.requestOtp` + `apiClient.auth.login` | ✅ Implementado na API client |
| Solicitar corrida | `MapaVivo` → `handleSelectRide` → `RideSelectorMatrix` | ✅ Fluxo de UI presente |
| Confirmar tipo de corrida | `RideSelectorMatrix.onConfirm` | ✅ Callback implementado |
| Aceitar corrida (driver) | `apiClient.rides.updateStatus` | ✅ Endpoint mapeado |
| Pagamento wallet | `apiClient.wallet.payRide` | ✅ Endpoint mapeado |
| Toast confirmação | `confirmedRide` state + `role="status"` toast | ✅ Presente em `routes/index.tsx` |

**Observação:** Não há tela de login renderizada na rota `/` — a UI atual abre diretamente no `VuupPassengerApp` sem verificação de auth, sugerindo que o fluxo de autenticação está pendente de integração com o estado do app.

---

### CA-3: Relatório de smoke test commitado no repo (`docs/qa/mobile-smoke.md`)

**Status: ✅ ENTREGUE (este documento)**

---

## Verificações Adicionais do Escopo

### Push Notification Nativa

**Status: ❌ Não verificável — Capacitor ausente**

- Pacote `@capacitor/push-notifications` não instalado.
- A implementação nativa de push requer o plugin Capacitor + configuração FCM (Android) / APNs (iOS).
- O PWA utiliza `vite-plugin-pwa` com Workbox, que suporta **Web Push** via Service Worker — funcionalidade distinta do push nativo.

---

### GPS Background

**Status: ❌ Não verificável — Capacitor ausente**

- Pacote `@capacitor/geolocation` não instalado.
- Atualmente, o componente `MapaVivo` usa um mapa placeholder SVG simulado, sem integração com `navigator.geolocation` ou API de geolocalização nativa.
- GPS em background requer permissão `ACCESS_BACKGROUND_LOCATION` no Android + plugin Capacitor.

---

### Haptics

**Status: ❌ Não verificável — Capacitor ausente**

- Pacote `@capacitor/haptics` não instalado.
- Nenhuma chamada a `Haptics.impact()` ou similar encontrada nos componentes.

---

### Deep Link `vuup://`

**Status: ❌ Não verificável — Capacitor e Android ausentes**

- Sem `AndroidManifest.xml` (diretório `android/` não existe), o app scheme `vuup://` não pode ser registrado nem testado.
- A configuração esperada seria no `AndroidManifest.xml`:
  ```xml
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <data android:scheme="vuup" />
  </intent-filter>
  ```

---

## Divergências PWA vs. Nativo Identificadas

| # | Área | Comportamento PWA | Comportamento Nativo (Capacitor) | Impacto |
|---|---|---|---|---|
| D-1 | Roteamento | Hash/History API via TanStack Router | Requer `base: "./"` em `vite.config.ts` para protocolo `file://` | **CRÍTICO** — sem isso o APK não carrega assets |
| D-2 | Push Notifications | Web Push via Service Worker (limitado no iOS) | `@capacitor/push-notifications` com FCM/APNs nativo | Alto |
| D-3 | Geolocalização | `navigator.geolocation` (foreground only) | `@capacitor/geolocation` com background mode | Alto |
| D-4 | Haptics | Não disponível no PWA | `@capacitor/haptics` com `HapticsImpactStyle` | Médio |
| D-5 | Deep Links | Não suportado nativamente | App scheme `vuup://` via `AndroidManifest.xml` | Médio |
| D-6 | Armazenamento seguro | `localStorage` (não seguro) | `@capacitor/preferences` ou `@capacitor/secure-storage` | Alto |
| D-7 | Status bar nativa | `<meta name="apple-mobile-web-app-status-bar-style">` | `@capacitor/status-bar` com controle programático | Baixo |
| D-8 | Câmera / QR Code | Web API (permissão browser) | `@capacitor/camera` nativo | Médio |

### Divergência D-1 — CRÍTICA (detalhamento)

O `vite.config.ts` atual **não define `base: "."` (relativo)**. No ambiente Capacitor, os assets são carregados via protocolo `file://` a partir do filesystem do dispositivo. Com o `base` padrão `/`, todos os paths de assets quebram:

```
❌ /assets/index-CMcqEQdR.js  (não existe como caminho absoluto em file://)
✅ ./assets/index-CMcqEQdR.js (relativo — funciona em file://)
```

**Correção necessária em `vite.config.ts`:**
```ts
export default defineConfig({
  base: "./",   // ← adicionar esta linha antes do Capacitor sync
  plugins: [...]
})
```

> Esta divergência está documentada em `notes/stack-analysis.md` como um passo obrigatório antes do `cap add android`.

---

## Checklist de Pré-requisitos para Re-execução dos Testes

Para executar os smoke tests nativos descritos no escopo de [VUU-37](/VUU/issues/VUU-37), os seguintes passos devem ser concluídos (responsabilidade do Coder / VUU-24):

- [ ] Instalar `@capacitor/core` e `@capacitor/cli`
- [ ] Executar `npx cap init` com `appId: com.vuup.app` e `webDir: dist`
- [ ] Adicionar `base: "./"` em `vite.config.ts`
- [ ] Executar `npm run build && npx cap add android`
- [ ] Verificar `npx cap sync` sem erros
- [ ] Configurar emulador Android (API 33+) ou dispositivo físico
- [ ] Instalar plugins Capacitor necessários: `@capacitor/push-notifications`, `@capacitor/geolocation`, `@capacitor/haptics`
- [ ] Configurar `vuup://` deep link no `AndroidManifest.xml` gerado
- [ ] Re-executar este smoke test com APK gerado

---

## Estado Atual do Build Web/PWA

Embora o Capacitor esteja ausente, o build web está **saudável**:

| Verificação | Resultado |
|---|---|
| `npm run build` | ✅ Sucesso — APK web em `dist/` (541 KiB precached) |
| `npm test` (Vitest) | ✅ 4/4 testes passando |
| `npm run typecheck` | ✅ Sem erros TypeScript |
| PWA manifest | ✅ Gerado (`dist/manifest.webmanifest`) |
| Service Worker | ✅ Gerado (`dist/sw.js` via Workbox) |
| Lint | Não executado neste ciclo |

---

## Conclusão e Próximos Passos

O smoke test nativo Capacitor **não pode ser concluído** porque o scaffold [VUU-24](/VUU/issues/VUU-24) não produziu os artefatos esperados no repositório. O app VUUP em seu estado atual é uma **PWA funcional** com build e testes passando, mas sem integração nativa.

**Ação imediata recomendada:** Reabrir ou criar follow-up de [VUU-24](/VUU/issues/VUU-24) para entregar o scaffold Capacitor com os artefatos mínimos (`capacitor.config.ts`, `android/`, `package.json` atualizado, `vite.config.ts` com `base: "./"`). Após entrega, este QA pode ser re-executado.

---

*Gerado automaticamente por Paperclip QA Agent — [VUU-37](/VUU/issues/VUU-37)*
