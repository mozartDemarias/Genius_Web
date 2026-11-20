/**
 * @fileoverview Script gerador de configuração do Firebase sem dependências externas.
 * Lê as credenciais do arquivo `.env` (ambiente local) ou de `process.env`
 * (pipelines de deploy como Vercel e Netlify) e gera `js/firebaseConfig.js`
 * para consumo direto pelo navegador em JavaScript Vanilla (ES6+).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE_PATH = path.join(ROOT_DIR, '.env');
const OUTPUT_FILE_PATH = path.join(ROOT_DIR, 'js', 'firebaseConfig.js');

/** Lista das variáveis de ambiente suportadas pelo projeto. */
const FIREBASE_ENV_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

/** Variáveis mínimas obrigatórias para o funcionamento do modo multiplayer online. */
const REQUIRED_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
];

/** Valores ilustrativos do `.env.example` tratados como não configurados. */
const PLACEHOLDER_FRAGMENTS = [
  'SUA_API_KEY_AQUI',
  'SEU_PROJETO',
  'SEU_PROJECT_ID',
  'SEU_SENDER_ID',
  'SEU_APP_ID',
];

/**
 * Faz o parsing simples e seguro de um arquivo `.env`, ignorando comentários e
 * removendo aspas externas quando presentes.
 *
 * @param {string} rawContent - Conteúdo textual bruto do arquivo `.env`.
 * @returns {Record<string, string>} Mapa chave -> valor extraído.
 */
function parseDotEnv(rawContent) {
  const result = {};
  const lines = rawContent.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalizedLine = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;

    const eqIndex = normalizedLine.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, eqIndex).trim();
    let value = normalizedLine.slice(eqIndex + 1).trim();

    // Remove aspas simples ou duplas envolvendo todo o valor
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      // Remove comentários inline quando o valor não está entre aspas
      value = value.replace(/\s+#.*$/, '').trim();
    }

    result[key] = value;
  }

  return result;
}

/**
 * Verifica se um valor está vazio ou ainda contém um texto placeholder.
 *
 * @param {string} value - Valor da variável de ambiente.
 * @returns {boolean}
 */
function isMissingOrPlaceholder(value) {
  if (!value) {
    return true;
  }
  return PLACEHOLDER_FRAGMENTS.some((fragment) => value.includes(fragment));
}

/**
 * Lê variáveis de `.env` (se existir) e combina com `process.env` (que tem prioridade),
 * retornando o dicionário completo das chaves do Firebase.
 *
 * @returns {Record<string, string>}
 */
function loadFirebaseEnv() {
  let fileEnv = {};
  if (fs.existsSync(ENV_FILE_PATH)) {
    const content = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    fileEnv = parseDotEnv(content);
  }

  const resolved = {};
  for (const key of FIREBASE_ENV_KEYS) {
    const rawValue = process.env[key] !== undefined ? process.env[key] : fileEnv[key];
    resolved[key] = typeof rawValue === 'string' ? rawValue.trim() : '';
  }

  return resolved;
}

/**
 * Gera o conteúdo ES Module de `js/firebaseConfig.js` a partir das variáveis resolvidas.
 *
 * @param {Record<string, string>} env - Valores das variáveis do Firebase.
 * @returns {string} Código JavaScript pronto para gravação.
 */
function buildConfigFileSource(env) {
  const configObject = {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    databaseURL: env.FIREBASE_DATABASE_URL,
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
    appId: env.FIREBASE_APP_ID,
  };

  return `/**
 * @fileoverview Configuração gerada automaticamente por \`scripts/build-env.js\`.
 * ATENÇÃO: Este arquivo é ignorado pelo Git (.gitignore) para proteger suas chaves.
 * Para atualizar os valores localmente, edite o arquivo \`.env\` e rode \`npm run build:env\`.
 */

export const firebaseConfig = ${JSON.stringify(configObject, null, 2)};

/**
 * Verifica se as credenciais mínimas do Firebase foram configuradas antes de tentar
 * conectar ao Realtime Database.
 *
 * @returns {boolean} Verdadeiro quando apiKey, databaseURL e projectId são válidos.
 */
export function isFirebaseConfigured() {
  const { apiKey, databaseURL, projectId } = firebaseConfig;
  const hasApiKey = Boolean(apiKey) && !apiKey.includes('SUA_API_KEY_AQUI');
  const hasProjectId = Boolean(projectId) && !projectId.includes('SEU_PROJECT_ID');
  const hasDatabaseUrl =
    Boolean(databaseURL) &&
    databaseURL.startsWith('https://') &&
    !databaseURL.includes('SEU_PROJETO');

  return hasApiKey && hasProjectId && hasDatabaseUrl;
}
`;
}

function main() {
  const env = loadFirebaseEnv();
  const missingKeys = REQUIRED_KEYS.filter((key) => isMissingOrPlaceholder(env[key]));

  // Garante que a pasta js/ exista e grava js/firebaseConfig.js sempre para evitar erro 404 de módulo
  fs.mkdirSync(path.dirname(OUTPUT_FILE_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE_PATH, buildConfigFileSource(env), 'utf8');

  if (missingKeys.length > 0) {
    console.warn(
      [
        '[Genius Web] Aviso: credenciais do Firebase incompletas ou ausentes:',
        `  Variáveis pendentes: ${missingKeys.join(', ')}`,
        '  O Modo Local (1 a 4 jogadores) continuará funcionando normalmente.',
        '  Para ativar o Modo Online, preencha o arquivo `.env` (ou as Environment Variables na Vercel/Netlify) e execute `npm run build:env`.',
      ].join('\n')
    );
    return;
  }

  console.log('[Genius Web] js/firebaseConfig.js gerado com sucesso a partir das variáveis de ambiente.');
}

main();
