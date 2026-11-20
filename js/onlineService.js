/**
 * @fileoverview Camada de comunicação em tempo real com o Firebase Realtime Database.
 * Responsável por criar salas, validar entrada por código de convite, sincronizar
 * sequência/turnos/vidas via `onValue` e tratar desconexões via `onDisconnect`.
 *
 * A importação do SDK do Firebase (v10 via CDN oficial) é feita de forma sob demanda
 * (lazy import) apenas quando o usuário utiliza o modo online, preservando o Modo
 * Local 100% funcional mesmo offline.
 */

import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

/** URLs oficiais dos módulos ES do Firebase SDK v10 (compatível com deploy estático). */
const FIREBASE_APP_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
const FIREBASE_DB_CDN = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

/** Chave de sessão por aba para identificar o jogador mesmo testando no mesmo computador. */
const PLAYER_ID_SESSION_KEY = 'genius_online_player_id';

/** Erro específico de validação/conexão do modo online para exibição em toast. */
export class OnlineError extends Error {
  /**
   * @param {string} message - Mensagem amigável em português para o usuário.
   */
  constructor(message) {
    super(message);
    this.name = 'OnlineError';
  }
}

/** Cache singleton da inicialização do Firebase para evitar múltiplos initializeApp. */
let firebaseContextPromise = null;
/** Fallback em memória caso `sessionStorage` esteja bloqueado. */
let memoryPlayerId = null;

/**
 * Normaliza um código de sala digitado pelo usuário, removendo espaços
 * e convertendo todas as letras para maiúsculas.
 *
 * @param {string} rawCode - Código digitado no campo de convite.
 * @returns {string} Código normalizado (ex.: 'GENIUS1234').
 */
export function normalizeRoomCode(rawCode) {
  return String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Gera um código de sala curto e legível no padrão `GENIUS` + 4 dígitos.
 *
 * @returns {string} Código aleatório (ex.: 'GENIUS4821').
 */
export function generateRoomCode() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `GENIUS${randomDigits}`;
}

/**
 * Converte o mapa `players` salvo no Realtime Database em um array ordenado por `slot` (1..4).
 *
 * @param {Object|Array|null|undefined} playersMap - Estrutura `rooms/{code}/players`.
 * @returns {Array<Object>} Lista ordenada de objetos de jogadores.
 */
export function getSortedPlayers(playersMap) {
  if (!playersMap) {
    return [];
  }

  const list = Array.isArray(playersMap)
    ? playersMap.filter(Boolean)
    : Object.values(playersMap).filter(Boolean);

  return list
    .map((player) => ({
      ...player,
      slot: Number(player.slot),
      lives: Number(player.lives),
      alive: Boolean(player.alive),
      connected: Boolean(player.connected),
    }))
    .sort((a, b) => a.slot - b.slot);
}

/**
 * Retorna apenas os jogadores que ainda estão vivos e conectados à sala.
 *
 * @param {Object|Array|null|undefined} playersMap - Estrutura `players` da sala.
 * @returns {Array<Object>} Jogadores aptos a jogar em ordem crescente de slot.
 */
export function getAliveConnectedPlayers(playersMap) {
  return getSortedPlayers(playersMap).filter((player) => player.alive && player.connected);
}

/**
 * Determina o próximo `slot` vivo e conectado em ordem circular após `currentSlot`.
 * Funciona inclusive se o jogador de `currentSlot` acabou de ser eliminado ou desconectou.
 *
 * @param {Object|Array|null|undefined} playersMap - Estrutura `players` da sala.
 * @param {number} currentSlot - Slot (1 a 4) do turno atual.
 * @returns {number} Próximo slot ativo ou `-1` se não houver mais nenhum jogador vivo.
 */
export function getNextOnlineAliveSlot(playersMap, currentSlot) {
  const alivePlayers = getAliveConnectedPlayers(playersMap);
  if (alivePlayers.length === 0) {
    return -1;
  }

  const nextAfterCurrent = alivePlayers.find((player) => player.slot > Number(currentSlot));
  return nextAfterCurrent ? nextAfterCurrent.slot : alivePlayers[0].slot;
}

/**
 * Gera ou recupera o identificador único desta aba no navegador.
 * Utilizar `sessionStorage` permite abrir múltiplas abas no mesmo PC para testar salas.
 *
 * @returns {string} Identificador único do cliente.
 */
export function getLocalPlayerId() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      let existing = window.sessionStorage.getItem(PLAYER_ID_SESSION_KEY);
      if (!existing) {
        existing = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        window.sessionStorage.setItem(PLAYER_ID_SESSION_KEY, existing);
      }
      return existing;
    }
  } catch {
    // Fallback em memória para contextos privados restritos
  }

  if (!memoryPlayerId) {
    memoryPlayerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return memoryPlayerId;
}

/**
 * Carrega dinamicamente o Firebase App e o Realtime Database via CDN oficial (v10+).
 * Lança `OnlineError` se as credenciais em `firebaseConfig.js` ainda estiverem com placeholders.
 *
 * @returns {Promise<Object>} Referência ao `db` e funções do Realtime Database.
 */
async function getDb() {
  if (!isFirebaseConfigured()) {
    throw new OnlineError(
      'Firebase ainda não configurado. Preencha o .env e execute npm run build:env!'
    );
  }

  if (!firebaseContextPromise) {
    firebaseContextPromise = (async () => {
      const [appMod, dbMod] = await Promise.all([
        import(FIREBASE_APP_CDN),
        import(FIREBASE_DB_CDN),
      ]);

      const app = appMod.getApps().length
        ? appMod.getApp()
        : appMod.initializeApp(firebaseConfig);
      const db = dbMod.getDatabase(app);

      return {
        db,
        ref: dbMod.ref,
        get: dbMod.get,
        set: dbMod.set,
        update: dbMod.update,
        remove: dbMod.remove,
        onValue: dbMod.onValue,
        onDisconnect: dbMod.onDisconnect,
        runTransaction: dbMod.runTransaction,
      };
    })().catch((error) => {
      firebaseContextPromise = null;
      throw error;
    });
  }

  return firebaseContextPromise;
}

/**
 * Cria uma nova sala em `rooms/{codigo}` com o criador ocupando o Slot 1 (Host).
 * Configura `onDisconnect` no lobby para remover a sala caso o Host feche a aba antes de iniciar.
 *
 * @param {Object} options - Configurações selecionadas na tela online.
 * @param {number} options.maxPlayers - Capacidade máxima da sala (2 a 4 jogadores).
 * @param {string} options.difficulty - Dificuldade selecionada ('easy' | 'medium' | 'hard').
 * @returns {Promise<{ code: string, slot: number, playerId: string, isHost: boolean }>}
 */
export async function createRoom({ maxPlayers, difficulty }) {
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
    throw new OnlineError('Selecione de 2 a 4 jogadores para criar uma sala online.');
  }

  const { db, ref, get, set, onDisconnect } = await getDb();
  const playerId = getLocalPlayerId();

  // Tenta gerar um código que ainda não esteja em uso no Realtime Database
  let roomCode = '';
  let roomRef = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateRoomCode();
    const candidateRef = ref(db, `rooms/${candidate}`);
    const snap = await get(candidateRef);
    if (!snap.exists()) {
      roomCode = candidate;
      roomRef = candidateRef;
      break;
    }
  }

  if (!roomCode || !roomRef) {
    throw new OnlineError('Não foi possível gerar um código de sala único. Tente novamente.');
  }

  const initialRoom = {
    code: roomCode,
    hostId: playerId,
    difficulty,
    maxPlayers,
    status: 'waiting',
    round: 1,
    completedRounds: 0,
    sequence: [],
    currentTurn: 1,
    inputIndex: 0,
    phase: 'showing',
    sequenceToken: 0,
    pendingNextRound: false,
    pendingReplay: false,
    winnerSlot: null,
    players: {
      1: {
        id: playerId,
        slot: 1,
        lives: 3,
        alive: true,
        connected: true,
      },
    },
    lastAction: null,
    createdAt: Date.now(),
  };

  await set(roomRef, initialRoom);

  // Enquanto a sala aguarda no lobby, se o Host desconectar a sala é limpa automaticamente
  await onDisconnect(roomRef).remove();

  return {
    code: roomCode,
    slot: 1,
    playerId,
    isHost: true,
  };
}

/**
 * Entra em uma sala existente utilizando o código de convite informado.
 * Valida atomicamente via `runTransaction` se a sala existe, está em `waiting` e possui vaga.
 *
 * @param {string} rawCode - Código digitado pelo usuário.
 * @returns {Promise<{ code: string, slot: number, playerId: string, isHost: boolean }>}
 */
export async function joinRoom(rawCode) {
  const code = normalizeRoomCode(rawCode);
  if (!code) {
    throw new OnlineError('Digite o código de convite para entrar em uma sala.');
  }

  const { db, ref, get, runTransaction, onDisconnect } = await getDb();
  const playerId = getLocalPlayerId();
  const roomRef = ref(db, `rooms/${code}`);

  // Pré-checagem direta evita que a transação otimista interprete `null` antes da resposta remota
  const existingSnap = await get(roomRef);
  if (!existingSnap.exists()) {
    throw new OnlineError('Sala não encontrada');
  }

  let rejectionReason = '';
  let assignedSlot = -1;

  const txResult = await runTransaction(roomRef, (currentRoom) => {
    if (currentRoom === null) {
      return currentRoom;
    }

    if (currentRoom.status !== 'waiting') {
      rejectionReason = 'Partida já iniciada';
      return undefined;
    }

    const playersObj = currentRoom.players ? { ...currentRoom.players } : {};
    const maxSlots = Number(currentRoom.maxPlayers) || 4;

    // Caso o mesmo cliente reconecte no lobby, reaproveita o próprio slot
    for (let s = 1; s <= maxSlots; s += 1) {
      if (playersObj[s] && playersObj[s].id === playerId) {
        assignedSlot = s;
        playersObj[s] = {
          ...playersObj[s],
          slot: s,
          lives: 3,
          alive: true,
          connected: true,
        };
        return {
          ...currentRoom,
          players: playersObj,
        };
      }
    }

    // Procura o menor slot livre (2, 3 ou 4)
    let freeSlot = -1;
    for (let s = 1; s <= maxSlots; s += 1) {
      const existingPlayer = playersObj[s];
      if (!existingPlayer || !existingPlayer.connected) {
        freeSlot = s;
        break;
      }
    }

    if (freeSlot === -1) {
      rejectionReason = 'Sala cheia';
      return undefined;
    }

    assignedSlot = freeSlot;
    playersObj[freeSlot] = {
      id: playerId,
      slot: freeSlot,
      lives: 3,
      alive: true,
      connected: true,
    };

    return {
      ...currentRoom,
      players: playersObj,
    };
  });

  if (rejectionReason) {
    throw new OnlineError(rejectionReason);
  }

  if (!txResult.committed || !txResult.snapshot.exists() || assignedSlot < 1) {
    throw new OnlineError('Sala não encontrada');
  }

  // Enquanto estiver no lobby, se o convidado fechar a aba, libera o slot automaticamente
  const playerRef = ref(db, `rooms/${code}/players/${assignedSlot}`);
  await onDisconnect(playerRef).remove();

  return {
    code,
    slot: assignedSlot,
    playerId,
    isHost: false,
  };
}

/**
 * Escuta atualizações em tempo real de `rooms/{code}` via `onValue`.
 *
 * @param {string} code - Código normalizado da sala.
 * @param {Function} onRoomData - Callback executado sempre que a sala muda.
 * @param {Function} onRoomDeleted - Callback executado se a sala for removida (ex.: Host saiu do lobby).
 * @param {Function} [onError] - Callback opcional para erros de leitura/permissão.
 * @returns {Promise<Function>} Função `unsubscribe` para cancelar o listener.
 */
export async function subscribeRoom(code, onRoomData, onRoomDeleted, onError) {
  const { db, ref, onValue } = await getDb();
  const roomRef = ref(db, `rooms/${code}`);

  const unsubscribe = onValue(
    roomRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onRoomDeleted();
        return;
      }
      onRoomData(snapshot.val());
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Atualiza a política de `onDisconnect` quando a partida entra em andamento (`playing`):
 * cancela a remoção de sala do lobby e marca apenas este jogador como desconectado/eliminado
 * caso ele feche a aba no meio do jogo.
 *
 * @param {string} code - Código da sala.
 * @param {number} slot - Slot (1 a 4) do jogador local.
 */
export async function configureInGameDisconnect(code, slot) {
  const { db, ref, onDisconnect } = await getDb();
  const roomRef = ref(db, `rooms/${code}`);
  const playerRef = ref(db, `rooms/${code}/players/${slot}`);

  // Cancela qualquer ação pendente do lobby (ex.: Host remover a sala inteira)
  await onDisconnect(roomRef).cancel().catch(() => {});
  await onDisconnect(playerRef).cancel().catch(() => {});

  // Se fechar a aba durante a partida, marca como desconectado e eliminado para não travar turnos
  await onDisconnect(playerRef).update({
    connected: false,
    alive: false,
  });
}

/**
 * Restaura a política de `onDisconnect` do lobby (quando o Host retorna ou limpa desconexão).
 *
 * @param {string} code - Código da sala.
 * @param {number} slot - Slot do jogador local.
 * @param {boolean} isHost - Indica se o jogador atual é o Host.
 */
export async function configureLobbyDisconnect(code, slot, isHost) {
  const { db, ref, onDisconnect } = await getDb();
  const roomRef = ref(db, `rooms/${code}`);
  const playerRef = ref(db, `rooms/${code}/players/${slot}`);

  await onDisconnect(roomRef).cancel().catch(() => {});
  await onDisconnect(playerRef).cancel().catch(() => {});

  if (isHost) {
    await onDisconnect(roomRef).remove();
  } else {
    await onDisconnect(playerRef).remove();
  }
}

/**
 * Aplica uma atualização parcial no nó `rooms/{code}`.
 *
 * @param {string} code - Código da sala.
 * @param {Object} patch - Campos a atualizar no Realtime Database (aceita caminhos aninhados).
 */
export async function updateRoomState(code, patch) {
  const { db, ref, update } = await getDb();
  const roomRef = ref(db, `rooms/${code}`);
  await update(roomRef, patch);
}

/**
 * Sai voluntariamente da sala atual, limpando listeners de desconexão e atualizando o banco.
 *
 * @param {Object} params
 * @param {string} params.code - Código da sala.
 * @param {number} params.slot - Slot do jogador local.
 * @param {boolean} params.isHost - Se o jogador atual é o Host.
 * @param {string} params.roomStatus - Status atual da sala ('waiting' | 'playing' | 'finished').
 */
export async function leaveRoom({ code, slot, isHost, roomStatus }) {
  if (!code) {
    return;
  }

  try {
    const { db, ref, update, remove, onDisconnect } = await getDb();
    const roomRef = ref(db, `rooms/${code}`);
    const playerRef = ref(db, `rooms/${code}/players/${slot}`);

    await onDisconnect(roomRef).cancel().catch(() => {});
    await onDisconnect(playerRef).cancel().catch(() => {});

    if (roomStatus === 'waiting') {
      if (isHost) {
        await remove(roomRef);
      } else if (slot >= 1) {
        await remove(playerRef);
      }
      return;
    }

    if (slot >= 1) {
      await update(playerRef, {
        connected: false,
        alive: false,
      });
    }
  } catch {
    // Ignora falhas de rede ao sair voluntariamente da sala
  }
}
