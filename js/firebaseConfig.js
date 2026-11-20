/**
 * @fileoverview Configuração de conexão com o Firebase Realtime Database.
 *
 * COMO CONFIGURAR:
 * 1. Acesse https://console.firebase.google.com/ e crie ou abra seu projeto.
 * 2. Em "Configurações do projeto" > "Seus aplicativos" (Web </>), copie o objeto `firebaseConfig`.
 * 3. Em "Criação" > "Realtime Database", crie o banco de dados e copie a URL (`databaseURL`).
 * 4. Substitua os valores placeholder abaixo pelas credenciais reais do seu projeto.
 */

export const firebaseConfig = {
  apiKey: 'SUA_API_KEY_AQUI',
  authDomain: 'SEU_PROJETO.firebaseapp.com',
  databaseURL: 'https://SEU_PROJETO-default-rtdb.firebaseio.com',
  projectId: 'SEU_PROJECT_ID',
  storageBucket: 'SEU_PROJETO.appspot.com',
  messagingSenderId: 'SEU_SENDER_ID',
  appId: 'SEU_APP_ID',
};

/**
 * Verifica se as credenciais mínimas do Firebase já foram preenchidas pelo desenvolvedor,
 * evitando falhas silenciosas ao tentar abrir ou entrar em uma sala online.
 *
 * @returns {boolean} Verdadeiro quando apiKey, databaseURL e projectId foram configurados.
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
