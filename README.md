# Genius_Web

Aplicação web responsiva do jogo **Genius (Simon Says)** em **HTML5, CSS3 puro e JavaScript Vanilla (ES6+)**, com modo **Multiplayer Local (1 a 4 jogadores)** e **Multiplayer Online em tempo real** via Firebase Realtime Database.

---

## Como Rodar Localmente

1. **Clonar e configurar as variáveis de ambiente (`.env`):**
   - Copie o arquivo de exemplo caso ainda não tenha o `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edite o `.env` e preencha as credenciais do seu aplicativo Web no Firebase:
     - `FIREBASE_API_KEY`
     - `FIREBASE_AUTH_DOMAIN`
     - `FIREBASE_DATABASE_URL`
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_STORAGE_BUCKET`
     - `FIREBASE_MESSAGING_SENDER_ID`
     - `FIREBASE_APP_ID`

   > **Nota:** Se você quiser jogar apenas o **Modo Local**, não é obrigatório preencher o `.env` — basta gerar o arquivo de configuração padrão executando `npm run build:env` (ou `npm run dev`).

2. **Gerar `js/firebaseConfig.js` e iniciar o servidor estático:**
   ```bash
   npm run dev
   ```
   Ou separadamente:
   ```bash
   npm run build:env
   npx serve .
   ```
   *(Os arquivos `.env` e `js/firebaseConfig.js` estão no `.gitignore` e nunca são enviados para o GitHub.)*

3. **Rodar os testes unitários (TDD):**
   ```bash
   npm test
   ```

---

## Deploy Estático (Vercel ou Netlify)

Como o projeto não usa bundler, o script `scripts/build-env.js` gera `js/firebaseConfig.js` durante o build a partir de `process.env`.

### 1. Configurar as Environment Variables
No painel do seu projeto na **Vercel** (*Settings → Environment Variables*) ou na **Netlify** (*Site configuration → Environment variables*), adicione as 7 variáveis:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

### 2. Configurar Build Command e Diretório Público
- **Build Command:** `npm run build:env`
- **Output Directory (Vercel) / Publish Directory (Netlify):** `.` (raiz do repositório)

---

## Regras de Teste do Firebase Realtime Database
No Console do Firebase em **Realtime Database → Regras**, utilize regras adequadas ao nó `rooms` durante seus testes:
```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    }
  }
}
```
