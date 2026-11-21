<h1 align="center">
  🔴 🟢 🔵 🟡<br>
  Genius_Web
</h1>

<p align="center">
  <img src="https://img.shields.io/static/v1?label=HTML&message=5&color=E34F26&style=for-the-badge&logo=html5&logoColor=white"/>
  <img src="https://img.shields.io/static/v1?label=CSS&message=3&color=1572B6&style=for-the-badge&logo=css3&logoColor=white"/>
  <img src="https://img.shields.io/static/v1?label=JavaScript&message=ES6%2B&color=F7DF1E&style=for-the-badge&logo=javascript&logoColor=black"/>
  <img src="https://img.shields.io/static/v1?label=Firebase&message=Realtime%20Database&color=FFCA28&style=for-the-badge&logo=firebase&logoColor=black"/>
<a href="LICENSE">
  <img src="https://img.shields.io/static/v1?label=License&message=GPL-3.0&color=blue&style=for-the-badge&logo=gnu&logoColor=white"/>
</a>
</p>

> **Status do Projeto:** :heavy_check_mark: concluído

## Contexto :

<p align="justify">

O <strong>Genius_Web</strong> é um projeto desenvolvido para a disciplina de <strong>Design de Interface e Usabilidade</strong>, do 3º período do curso de Ciência da Computação da Universidade Católica de Pernambuco (UNICAP), durante o semestre 2026.2.

</p>

<p align="justify">
   
O projeto consiste na aplicação web responsiva do jogo <strong>Genius (Simon Says)</strong> em <strong>HTML5, CSS3 puro e JavaScript Vanilla (ES6+)</strong>, com modo <strong>Multiplayer Local (1 a 4 jogadores)</strong> e <strong>Multiplayer Online em tempo real</strong> via Firebase Realtime Database.

</p>


## Como Rodar Localmente :

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
---
## Desenvolvedores : 
Time responsável pelo desenvolvimento do projeto.

| [<img src="https://github.com/Sofiafs.png" width="115"><br><sub>Sofia Farias</sub>](https://github.com/Sofiafs) | [<img src="https://github.com/mozartDemarias.png" width="115"><br><sub>Mozart de Marias</sub>](https://github.com/mozartDemarias) |
| :---: | :---: |
---
