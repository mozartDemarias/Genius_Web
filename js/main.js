/**
 * @fileoverview Controlador principal da interface do jogo Genius (Simon Says).
 * Conecta a máquina de estados pura (`gameLogic.js`), o motor de áudio (`audio.js`),
 * a navegação entre as 5 telas, os eventos híbridos (`pointerdown` + teclado)
 * e a persistência de recorde em `localStorage`.
 */

import {
  DIFFICULTY_CONFIG,
  GAME_PHASES,
  PLAYER_COLORS,
  beginPlayerInput,
  createGameState,
  getCurrentPlayer,
  getRandomColor,
  processPlayerInput,
  startMatch,
} from './gameLogic.js';
import { audioEngine } from './audio.js';
import {
  OnlineError,
  configureInGameDisconnect,
  createRoom,
  getAliveConnectedPlayers,
  getNextOnlineAliveSlot,
  getSortedPlayers,
  joinRoom,
  leaveRoom,
  subscribeRoom,
  updateRoomState,
} from './onlineService.js';

/** Chave utilizada no localStorage para persistir o maior recorde alcançado. */
const HIGH_SCORE_STORAGE_KEY = 'genius_high_score';

/** Mapeamento de teclas de atalho (Q, W, A, S) para as 4 cores do tabuleiro. */
const KEY_TO_COLOR = Object.freeze({
  q: 'blue',
  w: 'red',
  a: 'green',
  s: 'yellow',
});

/** Ícones SVG inline usados para representar som ligado e silenciado no menu. */
const SOUND_ICONS = Object.freeze({
  on: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
  </svg>`,
  off: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <line x1="23" y1="9" x2="17" y2="15"></line>
    <line x1="17" y1="9" x2="23" y2="15"></line>
  </svg>`,
});

/** Ícones SVG inline usados nos botões de Tela Cheia (expandir e recolher). */
const FULLSCREEN_ICONS = Object.freeze({
  enter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>`,
  exit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
  </svg>`,
});

// ============================================================================
// REFERÊNCIAS DE ELEMENTOS DO DOM
// ============================================================================
const dom = {
  menuBgBoard: document.getElementById('menu-bg-board'),
  screens: {
    start: document.getElementById('screen-start'),
    mode: document.getElementById('screen-mode'),
    'local-config': document.getElementById('screen-local-config'),
    'online-config': document.getElementById('screen-online-config'),
    game: document.getElementById('screen-game'),
  },

  // Tela inicial
  startBoard: document.getElementById('start-board'),
  startPads: document.querySelectorAll('[data-start-pad]'),
  btnStartPrompt: document.getElementById('btn-start-prompt'),

  // Seleção de modo
  btnModeOnline: document.getElementById('btn-mode-online'),
  btnModeLocal: document.getElementById('btn-mode-local'),

  // Configuração Local
  btnLocalBack: document.getElementById('btn-local-back'),
  localPlayerButtons: document.querySelectorAll('[data-local-players]'),
  localDifficultyButtons: document.querySelectorAll('[data-local-difficulty]'),
  btnLocalStart: document.getElementById('btn-local-start'),

  // Configuração Online
  btnOnlineBack: document.getElementById('btn-online-back'),
  onlineConfigForm: document.getElementById('online-config-form'),
  onlinePlayerButtons: document.querySelectorAll('[data-online-players]'),
  onlineDifficultyButtons: document.querySelectorAll('[data-online-difficulty]'),
  onlineInviteCode: document.getElementById('online-invite-code'),
  btnOnlineJoin: document.getElementById('btn-online-join'),
  btnOnlineCreate: document.getElementById('btn-online-create'),

  // Tela de jogo
  btnGameBack: document.getElementById('btn-game-back'),
  btnGameHome: document.getElementById('btn-game-home'),
  btnGameRules: document.getElementById('btn-game-rules'),
  btnGameFullscreen: document.getElementById('btn-game-fullscreen'),
  btnGameSettings: document.getElementById('btn-game-settings'),
  hudRound: document.getElementById('hud-round'),
  gameStage: document.getElementById('game-stage'),
  gameBoard: document.getElementById('game-board'),
  gamePads: document.querySelectorAll('#game-board .pad[data-color]'),
  hubStatusPrefix: document.getElementById('hub-status-prefix'),
  hubStatusMain: document.getElementById('hub-status-main'),
  playerCards: [
    document.getElementById('player-card-1'),
    document.getElementById('player-card-2'),
    document.getElementById('player-card-3'),
    document.getElementById('player-card-4'),
  ],

  // Modal de Configurações
  modalSettings: document.getElementById('modal-settings'),
  settingsHighScore: document.getElementById('settings-high-score'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  soundStatusIcon: document.getElementById('sound-status-icon'),
  soundStatusText: document.getElementById('sound-status-text'),
  btnSettingsFullscreen: document.getElementById('btn-settings-fullscreen'),
  fullscreenStatusIcon: document.getElementById('fullscreen-status-icon'),
  fullscreenStatusText: document.getElementById('fullscreen-status-text'),
  btnSettingsRules: document.getElementById('btn-settings-rules'),
  btnRestartMatch: document.getElementById('btn-restart-match'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnSettingsHome: document.getElementById('btn-settings-home'),

  // Modal de Como Jogar e Regras
  modalRules: document.getElementById('modal-rules'),
  btnRulesConfirm: document.getElementById('btn-rules-confirm'),

  // Modal de Fim de Jogo
  modalEndgame: document.getElementById('modal-endgame'),
  endgameRecordBadge: document.getElementById('endgame-record-badge'),
  endgameTitle: document.getElementById('endgame-title'),
  endgameSubtitle: document.getElementById('endgame-subtitle'),
  endgameRound: document.getElementById('endgame-round'),
  endgameCompleted: document.getElementById('endgame-completed'),
  endgameHighScore: document.getElementById('endgame-highscore'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  btnBackMenu: document.getElementById('btn-back-menu'),
  btnEndgameHome: document.getElementById('btn-endgame-home'),

  // Modal de Lobby Online
  modalLobby: document.getElementById('modal-lobby'),
  lobbyRoomCode: document.getElementById('lobby-room-code'),
  btnLobbyCopy: document.getElementById('btn-lobby-copy'),
  lobbyDifficultyBadge: document.getElementById('lobby-difficulty-badge'),
  lobbyCountBadge: document.getElementById('lobby-count-badge'),
  lobbySlots: document.getElementById('lobby-slots'),
  lobbyHint: document.getElementById('lobby-hint'),
  btnLobbyStart: document.getElementById('btn-lobby-start'),
  btnLobbyLeave: document.getElementById('btn-lobby-leave'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
};

// ============================================================================
// VARIÁVEIS DE ESTADO DA APLICAÇÃO
// ============================================================================
/** Tela atualmente visível ('start' | 'mode' | 'local-config' | 'online-config' | 'game'). */
let currentScreen = 'start';

/** Preferências selecionadas na tela de configuração local (padrão fiel às imagens: 2 / Médio). */
const localConfig = {
  playerCount: 2,
  difficulty: 'medium',
};

/** Modo da partida atual ('local' | 'online'). */
let gameMode = 'local';

/** Preferências selecionadas na tela de configuração online. */
const onlineConfig = {
  playerCount: 2,
  difficulty: 'medium',
};

/**
 * Cria o estado limpo da sessão online utilizada na sincronização em tempo real
 * com o Firebase Realtime Database.
 */
function createEmptyOnlineSession() {
  return {
    code: '',
    slot: 0,
    playerId: '',
    isHost: false,
    unsubscribe: null,
    room: null,
    lastPlayedSequenceToken: 0,
    lastProcessedActionTs: 0,
    localInputIndex: 0,
    inGameDisconnectConfigured: false,
    hasShownEndgame: false,
    hostActionLock: false,
    isBusy: false,
  };
}

/** Sessão online corrente. */
let onlineSession = createEmptyOnlineSession();

/** Estado corrente da partida gerenciado pelas funções puras de `gameLogic.js`. */
let gameState = createGameState(localConfig);

/** Recorde salvo no localStorage (maior número de sequências completadas). */
let highScore = loadHighScore();

/** Indica se o jogador superou o recorde durante a partida em andamento. */
let isNewRecordInMatch = false;

/**
 * Define o contexto de abertura do modal de regras:
 * - 'start': aberto automaticamente após "Continuar", iniciando a partida ao confirmar.
 * - 'review': aberto pelo menu de Configurações, apenas fechando ao confirmar.
 */
let rulesModalMode = 'start';

/**
 * Identificador incremental da sessão de reprodução da sequência.
 * Sempre que a partida é reiniciada ou abandonada, incrementamos este contador
 * e limpamos os timers ativos para evitar condições de corrida.
 */
let playbackSessionId = 0;
const activeTimers = new Set();

/** Controle de temporização do toast de notificações. */
let toastHideTimer = null;
let toastHiddenTimer = null;

// ============================================================================
// PERSISTÊNCIA DE RECORDE EM LOCALSTORAGE
// ============================================================================
/**
 * Lê o recorde salvo no localStorage com proteção contra navegação privada.
 *
 * @returns {number} Recorde numérico (>= 0).
 */
function loadHighScore() {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/**
 * Grava o novo recorde no localStorage de forma segura.
 *
 * @param {number} score - Pontuação máxima a persistir.
 */
function saveHighScore(score) {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(score));
  } catch {
    // Ignora falhas de armazenamento caso localStorage esteja bloqueado
  }
}

// ============================================================================
// GERENCIAMENTO DE TIMERS E CANCELAMENTO SEGURO
// ============================================================================
/**
 * Agenda um callback garantindo rastreamento em `activeTimers` para limpeza imediata
 * caso o usuário saia da partida ou reinicie no meio de uma sequência.
 *
 * @param {Function} callback - Função a executar após o atraso.
 * @param {number} delayMs - Tempo de espera em milissegundos.
 */
function scheduleTimer(callback, delayMs) {
  const timerId = window.setTimeout(() => {
    activeTimers.delete(timerId);
    callback();
  }, delayMs);
  activeTimers.add(timerId);
  return timerId;
}

/**
 * Cancela todas as reproduções de sequência, áudios e animações pendentes na partida.
 */
function cancelActivePlayback() {
  playbackSessionId += 1;
  activeTimers.forEach((timerId) => window.clearTimeout(timerId));
  activeTimers.clear();
  audioEngine.stopAll();

  dom.gamePads.forEach((pad) => pad.classList.remove('is-active'));
  dom.gameBoard.classList.remove('is-error');
  dom.playerCards.forEach((card) => card.classList.remove('is-error'));
}

// ============================================================================
// NOTIFICAÇÕES (TOAST) E MODAIS AUXILIARES
// ============================================================================
/**
 * Exibe um aviso flutuante elegante na parte inferior da tela.
 *
 * @param {string} message - Texto da notificação.
 * @param {number} [durationMs=3400] - Tempo de permanência visível em ms.
 */
function showToast(message, durationMs = 3400) {
  window.clearTimeout(toastHideTimer);
  window.clearTimeout(toastHiddenTimer);

  dom.toastMessage.textContent = message;
  dom.toast.hidden = false;

  // Força reflow para garantir que a transição CSS de entrada seja animada
  void dom.toast.offsetWidth;
  dom.toast.classList.add('is-visible');

  toastHideTimer = window.setTimeout(() => {
    dom.toast.classList.remove('is-visible');
    toastHiddenTimer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 240);
  }, durationMs);
}

/**
 * Verifica se há algum modal auxiliar (Configurações, Regras ou Fim de Jogo) aberto.
 *
 * @returns {boolean}
 */
function isAnyDialogOpen() {
  return (
    !dom.modalSettings.hidden ||
    !dom.modalEndgame.hidden ||
    !dom.modalRules.hidden ||
    !dom.modalLobby.hidden
  );
}

/**
 * Atualiza o rótulo, ícone e atributo ARIA do botão de som no modal de configurações.
 */
function syncSoundToggleUI() {
  const muted = audioEngine.isMuted();
  dom.soundStatusIcon.innerHTML = muted ? SOUND_ICONS.off : SOUND_ICONS.on;
  dom.soundStatusText.textContent = muted ? 'Som: Desligado' : 'Som: Ligado';
  dom.btnToggleSound.setAttribute('aria-pressed', String(!muted));
}

/**
 * Verifica se o navegador atual suporta a Fullscreen API (incluindo prefixo WebKit).
 *
 * @returns {boolean}
 */
function isFullscreenSupported() {
  const docEl = document.documentElement;
  const hasMethod = Boolean(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  const enabledFlag =
    typeof document.fullscreenEnabled === 'boolean'
      ? document.fullscreenEnabled
      : Boolean(document.webkitFullscreenEnabled);
  return hasMethod && enabledFlag;
}

/**
 * Verifica se a aplicação está atualmente exibida em modo tela cheia.
 *
 * @returns {boolean}
 */
function isFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * Atualiza os botões e ícones de Tela Cheia na barra superior e nas Configurações.
 */
function syncFullscreenUI() {
  const supported = isFullscreenSupported();
  const active = isFullscreenActive();

  // Em navegadores sem Fullscreen API (ex.: Safari iOS), oculta o atalho do topo
  dom.btnGameFullscreen.hidden = !supported;

  if (!supported) {
    dom.fullscreenStatusIcon.innerHTML = FULLSCREEN_ICONS.enter;
    dom.fullscreenStatusText.textContent = 'Tela Cheia (indisponível)';
    dom.btnSettingsFullscreen.setAttribute('aria-pressed', 'false');
    return;
  }

  const iconSvg = active ? FULLSCREEN_ICONS.exit : FULLSCREEN_ICONS.enter;
  dom.btnGameFullscreen.innerHTML = iconSvg;
  dom.btnGameFullscreen.setAttribute('aria-pressed', String(active));
  dom.btnGameFullscreen.setAttribute('aria-label', active ? 'Sair da tela cheia' : 'Ativar tela cheia');
  dom.btnGameFullscreen.title = active ? 'Sair da tela cheia' : 'Tela cheia';

  dom.fullscreenStatusIcon.innerHTML = iconSvg;
  dom.fullscreenStatusText.textContent = active ? 'Tela Cheia: Ativada' : 'Tela Cheia: Desativada';
  dom.btnSettingsFullscreen.setAttribute('aria-pressed', String(active));
}

/**
 * Alterna o modo Tela Cheia utilizando Fullscreen API com fallback WebKit.
 */
async function toggleFullscreen() {
  audioEngine.unlock();
  audioEngine.playUiClick();

  if (!isFullscreenSupported()) {
    showToast('Tela cheia não suportada neste navegador. Adicione à tela inicial para usar em tela cheia!');
    return;
  }

  try {
    if (!isFullscreenActive()) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch {
    showToast('Não foi possível alternar a tela cheia neste dispositivo.');
  } finally {
    syncFullscreenUI();
  }
}

/**
 * Abre o modal de configurações da partida com o recorde atual e estado do áudio.
 */
function openSettingsModal() {
  audioEngine.unlock();
  audioEngine.playUiClick();
  dom.settingsHighScore.textContent = String(highScore);
  // Em partidas online em tempo real, o reinício individual pelo menu fica desabilitado
  const isOnline = gameMode === 'online';
  dom.btnRestartMatch.hidden = isOnline;
  if (dom.btnRestartMatch.parentElement) {
    dom.btnRestartMatch.parentElement.classList.toggle('is-single', isOnline);
  }
  syncSoundToggleUI();
  syncFullscreenUI();
  dom.modalSettings.hidden = false;
  dom.btnToggleSound.focus();
}

/**
 * Fecha o modal de configurações da partida.
 */
function closeSettingsModal() {
  dom.modalSettings.hidden = true;
}

/**
 * Abre o modal de "Como Jogar e Regras".
 *
 * @param {'start'|'review'} [mode='start'] - 'start' inicia a partida ao confirmar;
 *   'review' apenas fecha o modal mantendo a partida atual.
 */
function openRulesModal(mode = 'start') {
  rulesModalMode = mode;
  dom.btnRulesConfirm.textContent = mode === 'start' ? 'Entendi, Começar!' : 'Voltar ao Jogo';
  dom.modalRules.hidden = false;

  const rulesDialog = dom.modalRules.querySelector('.neon-modal--rules');
  const rulesScrollArea = dom.modalRules.querySelector('.rules-content');
  const resetScrollTop = () => {
    if (rulesDialog) {
      rulesDialog.scrollTop = 0;
    }
    if (rulesScrollArea) {
      rulesScrollArea.scrollTop = 0;
    }
  };

  // Garante início no topo evitando corte do primeiro tópico após o modal abrir
  resetScrollTop();
  window.requestAnimationFrame(resetScrollTop);
  dom.btnRulesConfirm.focus({ preventScroll: true });
}

/**
 * Confirma o pop-up de regras, desbloqueia a Web Audio API e inicia a
 * primeira rodada caso o modal tenha sido aberto na entrada do jogo.
 */
function confirmRulesModal() {
  audioEngine.unlock();
  audioEngine.playUiClick();
  dom.modalRules.hidden = true;

  if (rulesModalMode === 'start') {
    startNewGame();
  }
}

/**
 * Abre o modal de encerramento da partida (Game Over ou Vitória multiplayer).
 */
function openEndgameModal() {
  const isVictory = gameState.phase === GAME_PHASES.VICTORY && gameState.winner;

  if (isVictory) {
    dom.endgameTitle.textContent = `${gameState.winner.name} Venceu!`;
    dom.endgameSubtitle.textContent = `Último jogador sobrevivente após ${gameState.completedRounds} sequência(s) completa(s).`;
  } else {
    dom.endgameTitle.textContent = 'Game Over';
    dom.endgameSubtitle.textContent = 'Você perdeu todas as 3 vidas.';
  }

  dom.endgameRound.textContent = String(gameState.round);
  dom.endgameCompleted.textContent = String(gameState.completedRounds);
  dom.endgameHighScore.textContent = String(highScore);
  dom.endgameRecordBadge.hidden = !isNewRecordInMatch;

  dom.modalEndgame.hidden = false;
  dom.btnPlayAgain.focus();
}

// ============================================================================
// CONTROLE DE NAVEGAÇÃO ENTRE AS 5 TELAS
// ============================================================================
/**
 * Alterna a tela ativa da aplicação, gerenciando o fundo desfocado dos menus
 * e interrompendo timers da partida caso o usuário saia do jogo.
 *
 * @param {'start'|'mode'|'local-config'|'online-config'|'game'} screenName - Tela destino.
 */
function showScreen(screenName) {
  if (currentScreen === 'game' && screenName !== 'game') {
    cancelActivePlayback();
    dom.modalSettings.hidden = true;
    dom.modalEndgame.hidden = true;
    dom.modalRules.hidden = true;

    if (gameMode === 'online' && onlineSession.code) {
      cleanupOnlineSession({ notifyServer: true });
    }
  }

  currentScreen = screenName;

  Object.entries(dom.screens).forEach(([name, element]) => {
    element.hidden = name !== screenName;
  });

  // Exibe o tabuleiro desfocado atrás dos modais das telas 2, 3 e 4
  const usesBlurredMenuBg =
    screenName === 'mode' || screenName === 'local-config' || screenName === 'online-config';
  dom.menuBgBoard.hidden = !usesBlurredMenuBg;
}

/**
 * Retorna imediatamente para a Tela Principal limpando timers, áudio,
 * modais abertos, sessão online (se houver) e estado da partida.
 */
function returnToStartScreen() {
  if (onlineSession.code || gameMode === 'online') {
    cleanupOnlineSession({ notifyServer: true });
  }

  cancelActivePlayback();
  audioEngine.stopAll();
  dom.modalSettings.hidden = true;
  dom.modalEndgame.hidden = true;
  dom.modalRules.hidden = true;
  dom.modalLobby.hidden = true;

  gameMode = 'local';
  isNewRecordInMatch = false;
  gameState = createGameState(localConfig);
  renderGameUI();

  if (dom.startBoard) {
    dom.startBoard.classList.remove('idle-animation');
    // Força reflow para reiniciar sincronia de anéis e botões da vitrine
    void dom.startBoard.offsetWidth;
    dom.startBoard.classList.add('idle-animation');
  }

  showScreen('start');
}

/**
 * Atualiza visualmente um grupo de botões seletores (jogadores ou dificuldade).
 *
 * @param {NodeListOf<HTMLElement>} buttons - Lista de botões do grupo.
 * @param {string} dataAttribute - Nome do atributo `dataset` comparado.
 * @param {string|number} activeValue - Valor atualmente selecionado.
 */
function syncSelectorGroup(buttons, dataAttribute, activeValue) {
  const targetValue = String(activeValue);
  buttons.forEach((btn) => {
    const isSelected = btn.dataset[dataAttribute] === targetValue;
    btn.classList.toggle('is-selected', isSelected);
    btn.setAttribute('aria-pressed', String(isSelected));
  });
}

// ============================================================================
// RENDERIZAÇÃO DA TELA DE JOGO E EXIBIÇÃO DA SEQUÊNCIA
// ============================================================================
/**
 * Sincroniza o tabuleiro, indicador central de turno e cards de jogadores
 * com base no objeto `gameState` atual.
 */
function renderGameUI() {
  dom.hudRound.textContent = String(Math.max(1, gameState.round));
  dom.gameStage.dataset.players = String(gameState.playerCount);

  const currentPlayer = getCurrentPlayer(gameState);
  const isIdle = gameState.phase === GAME_PHASES.IDLE;
  const isShowing = gameState.phase === GAME_PHASES.SHOWING_SEQUENCE;
  const isEnded =
    gameState.phase === GAME_PHASES.GAME_OVER || gameState.phase === GAME_PHASES.VICTORY;

  // Bloqueia visualmente o tabuleiro antes de confirmar regras, durante exibição ou após o fim
  dom.gameBoard.classList.toggle('is-locked', isIdle || isShowing || isEnded);

  // Atualiza texto dinâmico no círculo central do tabuleiro
  if (isIdle) {
    dom.hubStatusPrefix.hidden = false;
    dom.hubStatusPrefix.textContent = 'Pronto';
    dom.hubStatusMain.textContent = currentPlayer ? currentPlayer.name : 'Genius';
  } else if (isShowing) {
    dom.hubStatusPrefix.hidden = true;
    dom.hubStatusPrefix.textContent = '';
    dom.hubStatusMain.textContent = 'Observe...';
  } else if (gameState.phase === GAME_PHASES.VICTORY && gameState.winner) {
    dom.hubStatusPrefix.hidden = false;
    dom.hubStatusPrefix.textContent = 'Vencedor';
    dom.hubStatusMain.textContent = gameState.winner.name;
  } else if (gameState.phase === GAME_PHASES.GAME_OVER) {
    dom.hubStatusPrefix.hidden = true;
    dom.hubStatusPrefix.textContent = '';
    dom.hubStatusMain.textContent = 'Fim de jogo';
  } else if (currentPlayer) {
    dom.hubStatusPrefix.hidden = false;
    dom.hubStatusPrefix.textContent = 'Vez do';
    dom.hubStatusMain.textContent = currentPlayer.name;
  }

  // Atualiza os cards laterais exibindo somente a quantidade configurada (1 a 4)
  dom.playerCards.forEach((card, index) => {
    const player = gameState.players[index];
    if (!player) {
      card.hidden = true;
      card.classList.remove('is-current', 'is-eliminated', 'player-card--self');
      return;
    }

    card.hidden = false;
    const isCurrentTurn =
      !isEnded && currentPlayer && currentPlayer.id === player.id;

    card.classList.toggle('is-current', Boolean(isCurrentTurn));
    card.classList.toggle('is-eliminated', player.eliminated);
    card.classList.remove('player-card--self');

    const nameEl = card.querySelector('.player-card__name');
    if (nameEl) {
      nameEl.textContent = player.name;
    }

    const livesCurrentEl = card.querySelector('.lives-current');
    if (livesCurrentEl) {
      livesCurrentEl.textContent = String(player.lives);
    }

    const blocks = card.querySelectorAll('.life-block');
    blocks.forEach((block, blockIndex) => {
      block.classList.toggle('is-lost', blockIndex >= player.lives);
    });

    const badge = card.querySelector('.eliminated-badge');
    if (badge) {
      badge.hidden = !player.eliminated;
    }
  });
}

/**
 * Obtém o elemento `<button>` correspondente a uma cor no tabuleiro de jogo.
 *
 * @param {string} color - Nome da cor ('blue' | 'red' | 'green' | 'yellow').
 * @returns {HTMLElement|null}
 */
function getGamePadElement(color) {
  return document.querySelector(`#game-board .pad[data-color="${color}"]`);
}

/**
 * Acende brevemente um quadrante durante o clique/toque do jogador e dispara sua nota.
 *
 * @param {string} color - Cor acionada.
 * @param {number} [durationMs=240] - Duração do brilho visual e nota sonora.
 */
function flashPlayerPad(color, durationMs = 240) {
  const padEl = getGamePadElement(color);
  if (padEl) {
    padEl.classList.add('is-active');
    scheduleTimer(() => {
      padEl.classList.remove('is-active');
    }, durationMs);
  }
  audioEngine.playColor(color, durationMs);
}

/**
 * Executa passo a passo a demonstração da sequência sorteada utilizando
 * os tempos exatos da dificuldade selecionada (litDurationMs e intervalMs).
 * Durante toda a execução os cliques permanecem bloqueados.
 */
function runSequencePlayback() {
  const sessionId = ++playbackSessionId;
  const { sequence, timing } = gameState;
  const { litDurationMs, intervalMs } = timing;
  const stepCycleMs = litDurationMs + intervalMs;

  // Garante estado visual bloqueado e texto "Observe..." durante a exibição
  renderGameUI();

  sequence.forEach((color, index) => {
    const startAt = index * stepCycleMs;

    scheduleTimer(() => {
      if (sessionId !== playbackSessionId || currentScreen !== 'game') {
        return;
      }

      const padEl = getGamePadElement(color);
      if (padEl) {
        padEl.classList.add('is-active');
      }
      audioEngine.playColor(color, litDurationMs);

      scheduleTimer(() => {
        if (sessionId !== playbackSessionId) {
          return;
        }
        if (padEl) {
          padEl.classList.remove('is-active');
        }
      }, litDurationMs);
    }, startAt);
  });

  // Libera a entrada do jogador somente após a última pausa entre notas
  const totalPlaybackMs = sequence.length * stepCycleMs;
  scheduleTimer(() => {
    if (sessionId !== playbackSessionId || currentScreen !== 'game') {
      return;
    }

    gameState = beginPlayerInput(gameState);
    renderGameUI();
  }, totalPlaybackMs);
}

/**
 * Prepara a tela de jogo com os cards configurados sem iniciar a sequência,
 * exibindo primeiro o modal de "Como Jogar e Regras" para confirmação.
 */
function enterGameWithRules() {
  if (onlineSession.code) {
    cleanupOnlineSession({ notifyServer: true });
  }
  gameMode = 'local';
  cancelActivePlayback();
  dom.modalSettings.hidden = true;
  dom.modalEndgame.hidden = true;
  dom.modalRules.hidden = true;
  dom.modalLobby.hidden = true;

  isNewRecordInMatch = false;
  gameState = createGameState(localConfig);

  showScreen('game');
  renderGameUI();
  openRulesModal('start');
}

/**
 * Inicializa uma nova partida local usando as configurações escolhidas pelo usuário.
 */
function startNewGame() {
  gameMode = 'local';
  cancelActivePlayback();
  dom.modalSettings.hidden = true;
  dom.modalEndgame.hidden = true;
  dom.modalRules.hidden = true;
  dom.modalLobby.hidden = true;

  dom.btnPlayAgain.disabled = false;
  dom.btnPlayAgain.textContent = 'Jogar Novamente';
  dom.btnRestartMatch.hidden = false;
  if (dom.btnRestartMatch.parentElement) {
    dom.btnRestartMatch.parentElement.classList.remove('is-single');
  }

  isNewRecordInMatch = false;
  gameState = startMatch(createGameState(localConfig));

  showScreen('game');
  renderGameUI();

  // Pequena pausa inicial para o jogador localizar o tabuleiro antes da 1ª nota
  scheduleTimer(() => {
    runSequencePlayback();
  }, 450);
}

// ============================================================================
// TRATAMENTO DE JOGADAS (TOQUE / CLIQUE / TECLADO) E VALIDAÇÃO
// ============================================================================
/**
 * Aplica feedback visual de erro no tabuleiro e no card do jogador que errou.
 *
 * @param {number} playerId - ID (1 a 4) do jogador que cometeu o erro.
 */
function triggerErrorFeedback(playerId) {
  audioEngine.playError();
  dom.gameBoard.classList.add('is-error');

  const affectedCard = dom.playerCards[playerId - 1];
  if (affectedCard) {
    affectedCard.classList.add('is-error');
  }

  scheduleTimer(() => {
    dom.gameBoard.classList.remove('is-error');
    if (affectedCard) {
      affectedCard.classList.remove('is-error');
    }
  }, 520);
}

/**
 * Processa a escolha de uma cor pelo jogador da vez, validando acertos/erros
 * através da máquina de estados pura e disparando os efeitos correspondentes.
 *
 * @param {string} color - Cor pressionada ('blue' | 'red' | 'green' | 'yellow').
 */
function handlePadInput(color) {
  audioEngine.unlock();

  if (currentScreen !== 'game' || isAnyDialogOpen()) {
    return;
  }

  if (gameMode === 'online') {
    handleOnlinePadInput(color);
    return;
  }

  const result = processPlayerInput(gameState, color);

  // Ignora cliques fora da fase AWAITING_INPUT (ex.: enquanto "Observe..." está ativo)
  if (result.outcome === 'IGNORED') {
    return;
  }

  gameState = result.state;

  if (result.outcome === 'STEP_CORRECT') {
    flashPlayerPad(color, 230);
    return;
  }

  if (result.outcome === 'SEQUENCE_COMPLETE') {
    flashPlayerPad(color, 260);

    // Atualiza e persiste o recorde quando o total de sequências superá-lo
    if (gameState.completedRounds > highScore) {
      highScore = gameState.completedRounds;
      isNewRecordInMatch = true;
      saveHighScore(highScore);
    }

    renderGameUI();
    scheduleTimer(() => {
      runSequencePlayback();
    }, 760);
    return;
  }

  if (result.outcome === 'LIFE_LOST' || result.outcome === 'PLAYER_ELIMINATED') {
    triggerErrorFeedback(result.affectedPlayer.id);
    renderGameUI();

    if (result.outcome === 'PLAYER_ELIMINATED') {
      showToast(`${result.eliminatedPlayer.name} foi eliminado!`);
    }

    scheduleTimer(() => {
      runSequencePlayback();
    }, 1180);
    return;
  }

  if (result.outcome === 'GAME_OVER' || result.outcome === 'VICTORY') {
    triggerErrorFeedback(result.affectedPlayer.id);
    renderGameUI();

    scheduleTimer(() => {
      if (result.outcome === 'VICTORY') {
        audioEngine.playVictory();
      } else {
        audioEngine.playGameOver();
      }
      openEndgameModal();
    }, 680);
  }
}

// ============================================================================
// MODO MULTIPLAYER ONLINE EM TEMPO REAL (FIREBASE REALTIME DATABASE)
// ============================================================================
/**
 * Bloqueia ou libera os controles da tela de configuração online durante chamadas de rede.
 *
 * @param {boolean} busy - Verdadeiro enquanto aguarda criação/entrada na sala.
 */
function setOnlineFormBusy(busy) {
  onlineSession.isBusy = busy;
  dom.btnOnlineCreate.disabled = busy;
  dom.btnOnlineJoin.disabled = busy;
  dom.onlineInviteCode.disabled = busy;
}

/**
 * Encerra a sessão online local, removendo listeners e opcionalmente notificando o banco.
 *
 * @param {Object} [options]
 * @param {boolean} [options.notifyServer=true] - Envia saída/desconexão para o Firebase.
 */
function cleanupOnlineSession({ notifyServer = true } = {}) {
  const snapshotCode = onlineSession.code;
  const snapshotSlot = onlineSession.slot;
  const snapshotIsHost = onlineSession.isHost;
  const snapshotStatus = onlineSession.room?.status || 'waiting';
  const unsubscribe = onlineSession.unsubscribe;

  onlineSession = createEmptyOnlineSession();
  gameMode = 'local';
  cancelActivePlayback();

  if (typeof unsubscribe === 'function') {
    try {
      unsubscribe();
    } catch {
      // Ignora erro ao remover listener
    }
  }

  dom.modalLobby.hidden = true;
  dom.btnPlayAgain.disabled = false;
  dom.btnPlayAgain.textContent = 'Jogar Novamente';
  dom.btnRestartMatch.hidden = false;
  if (dom.btnRestartMatch.parentElement) {
    dom.btnRestartMatch.parentElement.classList.remove('is-single');
  }

  if (notifyServer && snapshotCode) {
    leaveRoom({
      code: snapshotCode,
      slot: snapshotSlot,
      isHost: snapshotIsHost,
      roomStatus: snapshotStatus,
    });
  }
}

/**
 * Renderiza os dados em tempo real da Sala de Espera (Lobby).
 *
 * @param {Object} room - Snapshot atualizado de `rooms/{code}`.
 */
function renderLobby(room) {
  dom.lobbyRoomCode.textContent = room.code || onlineSession.code;

  const diffConfig = DIFFICULTY_CONFIG[room.difficulty] || DIFFICULTY_CONFIG.medium;
  dom.lobbyDifficultyBadge.textContent = `Dificuldade: ${diffConfig.label}`;

  const playersObj = room.players || {};
  const maxSlots = Number(room.maxPlayers) || 2;
  const connectedCount = getSortedPlayers(playersObj).filter((p) => p.connected).length;
  dom.lobbyCountBadge.textContent = `${connectedCount}/${maxSlots} conectados`;

  // Monta a lista visual de slots (1 a maxSlots)
  dom.lobbySlots.innerHTML = '';
  for (let slot = 1; slot <= maxSlots; slot += 1) {
    const player = playersObj[slot];
    const isConnected = Boolean(player && player.connected);
    const isMe = slot === onlineSession.slot;
    const isSlotHost = Boolean(player && player.id === room.hostId);
    const colorKey = PLAYER_COLORS[slot - 1] || 'blue';

    const li = document.createElement('li');
    li.className = `lobby-slot lobby-slot--${colorKey}${isConnected ? '' : ' is-empty'}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'lobby-slot__name';

    const dot = document.createElement('span');
    dot.className = 'lobby-slot__dot';
    dot.setAttribute('aria-hidden', 'true');

    let label = `Jogador ${slot}`;
    if (isMe) {
      label += ' (Você)';
    }
    if (isSlotHost) {
      label += ' • Host';
    }

    const labelText = document.createTextNode(label);
    nameSpan.append(dot, labelText);

    const statusPill = document.createElement('span');
    statusPill.className = `lobby-status-pill ${
      isConnected ? 'lobby-status-pill--connected' : 'lobby-status-pill--waiting'
    }`;
    statusPill.textContent = isConnected ? 'Conectado' : 'Aguardando...';

    li.append(nameSpan, statusPill);
    dom.lobbySlots.appendChild(li);
  }

  // Apenas o Host enxerga o botão Iniciar Partida (liberado com >= 2 conectados)
  const isHost = room.hostId === onlineSession.playerId;
  onlineSession.isHost = isHost;

  dom.btnLobbyStart.hidden = !isHost;
  dom.btnLobbyStart.disabled = connectedCount < 2;
  if (dom.btnLobbyStart.parentElement) {
    dom.btnLobbyStart.parentElement.classList.toggle('is-guest', !isHost);
  }

  if (isHost) {
    dom.lobbyHint.textContent =
      connectedCount < 2
        ? 'Aguardando pelo menos 2 jogadores conectados para iniciar...'
        : 'Tudo pronto! Clique em "Iniciar Partida" quando desejar começar.';
  } else {
    dom.lobbyHint.textContent = 'Aguardando o Host iniciar a partida...';
  }

  dom.modalLobby.hidden = false;
}

/**
 * Inicia (ou reinicia) uma partida online pelo Host sorteando a primeira cor
 * e gravando o estado inicial em `rooms/{code}`.
 */
async function startOnlineMatch() {
  const room = onlineSession.room;
  if (!room || !onlineSession.isHost) {
    return;
  }

  const connectedPlayers = getSortedPlayers(room.players).filter((p) => p.connected);
  if (connectedPlayers.length < 2) {
    showToast('É necessário pelo menos 2 jogadores conectados.');
    return;
  }

  // Reconstroi o objeto `players` apenas com quem está conectado e com 3/3 vidas
  const freshPlayers = {};
  connectedPlayers.forEach((player) => {
    freshPlayers[player.slot] = {
      id: player.id,
      slot: player.slot,
      lives: 3,
      alive: true,
      connected: true,
    };
  });

  const firstTurn = connectedPlayers[0].slot;
  const firstColor = getRandomColor();
  const nextToken = (Number(room.sequenceToken) || 0) + 1;

  try {
    dom.btnLobbyStart.disabled = true;
    await updateRoomState(onlineSession.code, {
      status: 'playing',
      round: 1,
      completedRounds: 0,
      sequence: [firstColor],
      currentTurn: firstTurn,
      inputIndex: 0,
      phase: 'showing',
      sequenceToken: nextToken,
      pendingNextRound: false,
      pendingReplay: false,
      winnerSlot: null,
      lastAction: null,
      players: freshPlayers,
    });
  } catch {
    showToast('Erro ao iniciar a partida online. Tente novamente.');
    dom.btnLobbyStart.disabled = false;
  }
}

/**
 * Atualiza a tela de jogo com base no snapshot atual da sala online,
 * destacando o card local com "(Você)" e bloqueando turnos alheios.
 *
 * @param {Object} room - Snapshot da sala.
 */
function renderOnlineGameUI(room) {
  const playersObj = room.players || {};
  const sortedPlayers = getSortedPlayers(playersObj);
  const maxSlot = sortedPlayers.reduce((max, p) => Math.max(max, p.slot), 2);
  const isFinished = room.status === 'finished';
  const isShowing = room.phase === 'showing';
  const isTransition = room.phase === 'transition';
  const isMyTurn = !isFinished && room.phase === 'playing' && Number(room.currentTurn) === onlineSession.slot;

  dom.hudRound.textContent = String(Math.max(1, Number(room.round) || 1));
  dom.gameStage.dataset.players = String(Math.min(4, Math.max(2, maxSlot)));

  // Apenas o jogador do turno atual (durante `phase === 'playing'`) tem entrada liberada
  dom.gameBoard.classList.toggle('is-locked', !isMyTurn);

  if (isFinished) {
    dom.hubStatusPrefix.hidden = false;
    dom.hubStatusPrefix.textContent = 'Vencedor';
    dom.hubStatusMain.textContent = room.winnerSlot ? `Jogador ${room.winnerSlot}` : 'Fim de jogo';
  } else if (isShowing || isTransition) {
    dom.hubStatusPrefix.hidden = true;
    dom.hubStatusPrefix.textContent = '';
    dom.hubStatusMain.textContent = 'Observe...';
  } else {
    dom.hubStatusPrefix.hidden = false;
    dom.hubStatusPrefix.textContent = 'Vez do';
    dom.hubStatusMain.textContent =
      Number(room.currentTurn) === onlineSession.slot
        ? `Jogador ${room.currentTurn} (Você)`
        : `Jogador ${room.currentTurn}`;
  }

  dom.playerCards.forEach((card, index) => {
    const slotNumber = index + 1;
    const player = playersObj[slotNumber];

    if (!player) {
      card.hidden = true;
      card.classList.remove('is-current', 'is-eliminated', 'player-card--self');
      return;
    }

    card.hidden = false;
    const isMe = slotNumber === onlineSession.slot;
    const isEliminated = !player.alive || !player.connected;
    const isCurrentTurn = !isFinished && !isEliminated && Number(room.currentTurn) === slotNumber;

    card.classList.toggle('player-card--self', isMe);
    card.classList.toggle('is-current', isCurrentTurn);
    card.classList.toggle('is-eliminated', isEliminated);

    const nameEl = card.querySelector('.player-card__name');
    if (nameEl) {
      nameEl.textContent = isMe ? `Jogador ${slotNumber} (Você)` : `Jogador ${slotNumber}`;
    }

    const lives = Math.max(0, Number(player.lives) || 0);
    const livesCurrentEl = card.querySelector('.lives-current');
    if (livesCurrentEl) {
      livesCurrentEl.textContent = String(lives);
    }

    const blocks = card.querySelectorAll('.life-block');
    blocks.forEach((block, blockIndex) => {
      block.classList.toggle('is-lost', blockIndex >= lives);
    });

    const badge = card.querySelector('.eliminated-badge');
    if (badge) {
      badge.hidden = !isEliminated;
    }
  });
}

/**
 * Reproduz visual e sonoramente a sequência recebida do Firebase na velocidade da sala.
 * Apenas o Host atualiza `phase: 'playing'` ao final da demonstração.
 *
 * @param {Array<string>} sequence - Sequência oficial da rodada.
 * @param {string} difficultyKey - Chave da dificuldade ('easy' | 'medium' | 'hard').
 */
function runOnlineSequencePlayback(sequence, difficultyKey) {
  cancelActivePlayback();
  const sessionId = ++playbackSessionId;
  const timing = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.medium;
  const { litDurationMs, intervalMs } = timing;
  const stepCycleMs = litDurationMs + intervalMs;

  if (!Array.isArray(sequence) || sequence.length === 0) {
    return;
  }

  sequence.forEach((color, index) => {
    const startAt = index * stepCycleMs;

    scheduleTimer(() => {
      if (sessionId !== playbackSessionId || gameMode !== 'online' || currentScreen !== 'game') {
        return;
      }

      const padEl = getGamePadElement(color);
      if (padEl) {
        padEl.classList.add('is-active');
      }
      audioEngine.playColor(color, litDurationMs);

      scheduleTimer(() => {
        if (sessionId !== playbackSessionId) {
          return;
        }
        if (padEl) {
          padEl.classList.remove('is-active');
        }
      }, litDurationMs);
    }, startAt);
  });

  const totalPlaybackMs = sequence.length * stepCycleMs;
  scheduleTimer(() => {
    if (sessionId !== playbackSessionId || gameMode !== 'online' || currentScreen !== 'game') {
      return;
    }

    // Somente o Host libera a fase `playing` após todos concluírem a exibição
    if (onlineSession.isHost && onlineSession.room?.status === 'playing') {
      updateRoomState(onlineSession.code, {
        phase: 'playing',
        inputIndex: 0,
      }).catch(() => {});
    }
  }, totalPlaybackMs + 160);
}

/**
 * Abre o modal de Vitória ao encerrar uma partida online.
 *
 * @param {Object} room - Snapshot final da sala.
 */
function openOnlineEndgameModal(room) {
  const winnerSlot = Number(room.winnerSlot);
  const iWon = winnerSlot === onlineSession.slot;

  dom.endgameTitle.textContent = iWon
    ? `Você Venceu! (Jogador ${winnerSlot})`
    : winnerSlot
      ? `Jogador ${winnerSlot} Venceu!`
      : 'Partida Encerrada';
  dom.endgameSubtitle.textContent = `Partida online concluída após ${Number(room.completedRounds) || 0} sequência(s) completa(s).`;

  dom.endgameRound.textContent = String(Number(room.round) || 1);
  dom.endgameCompleted.textContent = String(Number(room.completedRounds) || 0);
  dom.endgameHighScore.textContent = String(highScore);
  dom.endgameRecordBadge.hidden = true;

  // No modo online, apenas o Host pode reiniciar uma nova rodada para todos na sala
  if (onlineSession.isHost) {
    dom.btnPlayAgain.disabled = false;
    dom.btnPlayAgain.textContent = 'Jogar Novamente';
  } else {
    dom.btnPlayAgain.disabled = true;
    dom.btnPlayAgain.textContent = 'Aguardando Host...';
  }

  dom.modalEndgame.hidden = false;
  if (!dom.btnPlayAgain.disabled) {
    dom.btnPlayAgain.focus();
  } else {
    dom.btnBackMenu.focus();
  }
}

/**
 * Coordena ações exclusivas do Host durante a partida online:
 * - Avançar rodada (`pendingNextRound`) sorteando apenas 1 nova cor.
 * - Reexibir sequência após erro (`pendingReplay`).
 * - Tratar desconexão inesperada do jogador da vez ou fim por sobrevivente único.
 *
 * @param {Object} room - Snapshot atual da sala.
 */
function processOnlineHostDuties(room) {
  if (!onlineSession.isHost || room.status !== 'playing') {
    return;
  }

  const aliveConnected = getAliveConnectedPlayers(room.players);

  // Vitória automática caso reste apenas 1 jogador vivo/conectado (ex.: desconexões)
  if (aliveConnected.length <= 1) {
    if (!onlineSession.hostActionLock) {
      onlineSession.hostActionLock = true;
      updateRoomState(onlineSession.code, {
        status: 'finished',
        phase: 'finished',
        winnerSlot: aliveConnected[0]?.slot ?? null,
        pendingNextRound: false,
        pendingReplay: false,
      })
        .catch(() => {})
        .finally(() => {
          onlineSession.hostActionLock = false;
        });
    }
    return;
  }

  // Se o jogador dono do turno atual desconectou ou foi eliminado sem transição agendada
  const currentTurnPlayer = room.players?.[room.currentTurn];
  if (
    room.phase !== 'transition' &&
    (!currentTurnPlayer || !currentTurnPlayer.alive || !currentTurnPlayer.connected)
  ) {
    if (!onlineSession.hostActionLock) {
      onlineSession.hostActionLock = true;
      const nextSlot = getNextOnlineAliveSlot(room.players, room.currentTurn);
      updateRoomState(onlineSession.code, {
        currentTurn: nextSlot,
        inputIndex: 0,
        phase: 'showing',
        sequenceToken: (Number(room.sequenceToken) || 0) + 1,
        pendingNextRound: false,
        pendingReplay: false,
        lastAction: {
          type: 'disconnect',
          playerSlot: Number(room.currentTurn),
          timestamp: Date.now(),
        },
      })
        .catch(() => {})
        .finally(() => {
          onlineSession.hostActionLock = false;
        });
    }
    return;
  }

  // Host sorteia a próxima cor após acerto completo da sequência (por ele ou por um convidado)
  if (room.pendingNextRound && !onlineSession.hostActionLock) {
    onlineSession.hostActionLock = true;
    scheduleTimer(() => {
      const latestRoom = onlineSession.room;
      if (
        gameMode !== 'online' ||
        !onlineSession.isHost ||
        !latestRoom ||
        latestRoom.status !== 'playing' ||
        !latestRoom.pendingNextRound
      ) {
        onlineSession.hostActionLock = false;
        return;
      }

      const nextColor = getRandomColor();
      const nextSequence = [...(Array.isArray(latestRoom.sequence) ? latestRoom.sequence : []), nextColor];
      const nextTurn = getNextOnlineAliveSlot(latestRoom.players, latestRoom.currentTurn);

      updateRoomState(onlineSession.code, {
        sequence: nextSequence,
        round: (Number(latestRoom.round) || 1) + 1,
        completedRounds: (Number(latestRoom.completedRounds) || 0) + 1,
        currentTurn: nextTurn,
        inputIndex: 0,
        phase: 'showing',
        sequenceToken: (Number(latestRoom.sequenceToken) || 0) + 1,
        pendingNextRound: false,
      })
        .catch(() => {})
        .finally(() => {
          onlineSession.hostActionLock = false;
        });
    }, 700);
    return;
  }

  // Host dispara reexibição da sequência após algum jogador perder vida
  if (room.pendingReplay && !onlineSession.hostActionLock) {
    onlineSession.hostActionLock = true;
    scheduleTimer(() => {
      const latestRoom = onlineSession.room;
      if (
        gameMode !== 'online' ||
        !onlineSession.isHost ||
        !latestRoom ||
        latestRoom.status !== 'playing' ||
        !latestRoom.pendingReplay
      ) {
        onlineSession.hostActionLock = false;
        return;
      }

      updateRoomState(onlineSession.code, {
        phase: 'showing',
        inputIndex: 0,
        sequenceToken: (Number(latestRoom.sequenceToken) || 0) + 1,
        pendingReplay: false,
      })
        .catch(() => {})
        .finally(() => {
          onlineSession.hostActionLock = false;
        });
    }, 1150);
  }
}

/**
 * Callback principal acionado pelo `onValue` do Firebase sempre que `rooms/{code}` muda.
 *
 * @param {Object} room - Snapshot atualizado da sala.
 */
function handleOnlineRoomUpdate(room) {
  if (gameMode !== 'online' || !onlineSession.code) {
    return;
  }

  onlineSession.room = room;
  const sortedPlayers = getSortedPlayers(room.players);
  const aliveConnected = getAliveConnectedPlayers(room.players);
  const hostPlayer = sortedPlayers.find((p) => p.id === room.hostId);

  // Migração automática de Host se o Host original desconectar durante uma partida em curso
  if (
    room.status === 'playing' &&
    (!hostPlayer || !hostPlayer.connected) &&
    aliveConnected.length > 0 &&
    aliveConnected[0].id === onlineSession.playerId
  ) {
    onlineSession.isHost = true;
    updateRoomState(onlineSession.code, { hostId: onlineSession.playerId }).catch(() => {});
  } else {
    onlineSession.isHost = room.hostId === onlineSession.playerId;
  }

  // --- Estado 1: Aguardando no Lobby ---
  if (room.status === 'waiting') {
    onlineSession.hasShownEndgame = false;
    renderLobby(room);
    return;
  }

  // --- Estado 2: Partida em andamento ---
  if (room.status === 'playing') {
    onlineSession.hasShownEndgame = false;
    dom.modalLobby.hidden = true;
    dom.modalEndgame.hidden = true;

    if (currentScreen !== 'game') {
      showScreen('game');
    }

    // Troca a regra de onDisconnect do lobby para marcar apenas o jogador como desconectado
    if (!onlineSession.inGameDisconnectConfigured) {
      onlineSession.inGameDisconnectConfigured = true;
      configureInGameDisconnect(onlineSession.code, onlineSession.slot).catch(() => {});
    }

    renderOnlineGameUI(room);

    // Espelhamento audiovisual em tempo real das ações recebidas
    const action = room.lastAction;
    if (action && Number(action.timestamp) > onlineSession.lastProcessedActionTs) {
      onlineSession.lastProcessedActionTs = Number(action.timestamp);

      if ((action.type === 'press' || action.type === 'complete') && Number(action.playerSlot) !== onlineSession.slot) {
        flashPlayerPad(action.color, 230);
      } else if (action.type === 'error') {
        triggerErrorFeedback(Number(action.playerSlot));
        if (action.eliminated) {
          showToast(`Jogador ${action.playerSlot} foi eliminado!`);
        }
      } else if (action.type === 'disconnect') {
        showToast(`Jogador ${action.playerSlot} desconectou!`);
      }
    }

    // Dispara a exibição sincronizada da sequência quando o token avançar
    if (room.phase === 'showing' && Number(room.sequenceToken) !== onlineSession.lastPlayedSequenceToken) {
      onlineSession.lastPlayedSequenceToken = Number(room.sequenceToken);
      onlineSession.localInputIndex = 0;
      runOnlineSequencePlayback(room.sequence, room.difficulty);
    }

    processOnlineHostDuties(room);
    return;
  }

  // --- Estado 3: Partida encerrada ---
  if (room.status === 'finished') {
    dom.modalLobby.hidden = true;
    renderOnlineGameUI(room);

    const action = room.lastAction;
    if (action && Number(action.timestamp) > onlineSession.lastProcessedActionTs) {
      onlineSession.lastProcessedActionTs = Number(action.timestamp);
      if (action.type === 'error') {
        triggerErrorFeedback(Number(action.playerSlot));
      }
    }

    if (!onlineSession.hasShownEndgame) {
      onlineSession.hasShownEndgame = true;
      scheduleTimer(() => {
        if (gameMode !== 'online' || !onlineSession.room || onlineSession.room.status !== 'finished') {
          return;
        }
        audioEngine.playVictory();
        openOnlineEndgameModal(onlineSession.room);
      }, 650);
    }
  }
}

/**
 * Valida e envia uma jogada (toque/clique/tecla) durante uma partida online.
 * Só executa quando `phase === 'playing'` e `currentTurn === onlineSession.slot`.
 *
 * @param {string} color - Cor pressionada ('blue' | 'red' | 'green' | 'yellow').
 */
function handleOnlinePadInput(color) {
  const room = onlineSession.room;
  if (
    !room ||
    room.status !== 'playing' ||
    room.phase !== 'playing' ||
    Number(room.currentTurn) !== onlineSession.slot
  ) {
    return;
  }

  const sequence = Array.isArray(room.sequence) ? room.sequence : [];
  const expectedColor = sequence[onlineSession.localInputIndex];
  if (!expectedColor) {
    return;
  }

  const timestamp = Date.now();
  onlineSession.lastProcessedActionTs = timestamp;

  // Caso 1: Acertou a cor esperada neste passo
  if (color === expectedColor) {
    onlineSession.localInputIndex += 1;
    flashPlayerPad(color, 230);

    // Ainda faltam cores na sequência atual
    if (onlineSession.localInputIndex < sequence.length) {
      updateRoomState(onlineSession.code, {
        inputIndex: onlineSession.localInputIndex,
        lastAction: {
          type: 'press',
          color,
          playerSlot: onlineSession.slot,
          timestamp,
        },
      }).catch(() => {});
      return;
    }

    // Completou toda a sequência: trava entrada e sinaliza para o Host sortear a próxima cor
    dom.gameBoard.classList.add('is-locked');
    updateRoomState(onlineSession.code, {
      phase: 'transition',
      inputIndex: 0,
      pendingNextRound: true,
      lastAction: {
        type: 'complete',
        color,
        playerSlot: onlineSession.slot,
        timestamp,
      },
    }).catch(() => {});
    return;
  }

  // Caso 2: Errou a cor esperada -> desconta 1 vida e verifica eliminação/vitória
  const myPlayer = room.players?.[onlineSession.slot];
  const currentLives = myPlayer ? Number(myPlayer.lives) : 3;
  const newLives = Math.max(0, currentLives - 1);
  const stillAlive = newLives > 0;

  triggerErrorFeedback(onlineSession.slot);
  if (!stillAlive) {
    showToast(`Jogador ${onlineSession.slot} foi eliminado!`);
  }

  // Simula o mapa de jogadores atualizado para calcular próximo turno ou vencedor
  const simulatedPlayers = { ...(room.players || {}) };
  simulatedPlayers[onlineSession.slot] = {
    ...(myPlayer || { id: onlineSession.playerId, slot: onlineSession.slot, connected: true }),
    lives: newLives,
    alive: stillAlive,
  };

  const survivors = getAliveConnectedPlayers(simulatedPlayers);
  dom.gameBoard.classList.add('is-locked');

  if (survivors.length <= 1) {
    updateRoomState(onlineSession.code, {
      [`players/${onlineSession.slot}/lives`]: newLives,
      [`players/${onlineSession.slot}/alive`]: stillAlive,
      inputIndex: 0,
      status: 'finished',
      phase: 'finished',
      winnerSlot: survivors[0]?.slot ?? null,
      pendingNextRound: false,
      pendingReplay: false,
      lastAction: {
        type: 'error',
        color,
        playerSlot: onlineSession.slot,
        eliminated: !stillAlive,
        timestamp,
      },
    }).catch(() => {});
    return;
  }

  const nextTurn = getNextOnlineAliveSlot(simulatedPlayers, onlineSession.slot);
  updateRoomState(onlineSession.code, {
    [`players/${onlineSession.slot}/lives`]: newLives,
    [`players/${onlineSession.slot}/alive`]: stillAlive,
    currentTurn: nextTurn,
    inputIndex: 0,
    phase: 'transition',
    pendingReplay: true,
    lastAction: {
      type: 'error',
      color,
      playerSlot: onlineSession.slot,
      eliminated: !stillAlive,
      timestamp,
    },
  }).catch(() => {});
}

/**
 * Conecta o cliente à assinatura em tempo real da sala após criar ou entrar no Lobby.
 *
 * @param {Object} sessionInfo - Dados retornados por `createRoom` ou `joinRoom`.
 */
async function attachToOnlineRoom(sessionInfo) {
  gameMode = 'online';
  onlineSession = {
    ...createEmptyOnlineSession(),
    code: sessionInfo.code,
    slot: sessionInfo.slot,
    playerId: sessionInfo.playerId,
    isHost: sessionInfo.isHost,
  };

  const unsubscribe = await subscribeRoom(
    sessionInfo.code,
    handleOnlineRoomUpdate,
    () => {
      // Sala removida (ex.: Host encerrou ou desconectou do Lobby)
      if (!onlineSession.code) {
        return;
      }
      cleanupOnlineSession({ notifyServer: false });
      showScreen('online-config');
      showToast('A sala foi encerrada pelo Host.');
    },
    () => {
      showToast('Erro de conexão com o Firebase Realtime Database.');
    }
  );

  onlineSession.unsubscribe = unsubscribe;
}

/**
 * Cria uma nova sala online no Firebase a partir da tela `configuracao_jogo_online`.
 */
async function handleCreateOnlineRoom() {
  audioEngine.unlock();
  audioEngine.playUiClick();

  if (onlineSession.isBusy) {
    return;
  }

  if (onlineConfig.playerCount < 2) {
    showToast('Selecione de 2 a 4 jogadores para criar uma sala online!');
    return;
  }

  setOnlineFormBusy(true);
  try {
    const sessionInfo = await createRoom({
      maxPlayers: onlineConfig.playerCount,
      difficulty: onlineConfig.difficulty,
    });
    await attachToOnlineRoom(sessionInfo);
  } catch (error) {
    cleanupOnlineSession({ notifyServer: false });
    showToast(
      error instanceof OnlineError
        ? error.message
        : 'Não foi possível criar a sala. Verifique sua conexão e o Firebase.'
    );
  } finally {
    setOnlineFormBusy(false);
  }
}

/**
 * Entra em uma sala existente utilizando o código digitado no input.
 *
 * @param {Event} event - Evento submit do formulário online.
 */
async function handleJoinOnlineRoom(event) {
  event.preventDefault();
  audioEngine.unlock();
  audioEngine.playUiClick();

  if (onlineSession.isBusy) {
    return;
  }

  const rawCode = dom.onlineInviteCode.value;
  setOnlineFormBusy(true);

  try {
    const sessionInfo = await joinRoom(rawCode);
    await attachToOnlineRoom(sessionInfo);
  } catch (error) {
    cleanupOnlineSession({ notifyServer: false });
    showToast(
      error instanceof OnlineError
        ? error.message
        : 'Não foi possível entrar na sala. Verifique o código e o Firebase.'
    );
  } finally {
    setOnlineFormBusy(false);
  }
}

/**
 * Copia o código da sala do Lobby para a área de transferência do dispositivo.
 */
async function copyLobbyCode() {
  audioEngine.playUiClick();
  const code = dom.lobbyRoomCode.textContent || onlineSession.code;
  if (!code) {
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const tempInput = document.createElement('input');
      tempInput.value = code;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    }
    showToast(`Código ${code} copiado!`);
  } catch {
    showToast(`Código da sala: ${code}`);
  }
}

// ============================================================================
// REGISTRO DE EVENTOS DA INTERFACE
// ============================================================================
/**
 * Avança da Tela 1 (Principal) para a Tela 2 (Seleção de Modo) após interação.
 *
 * @param {string|null} [padColor=null] - Cor opcional se o usuário tocou em um quadrante.
 */
function enterGameFromStartScreen(padColor = null) {
  if (currentScreen !== 'start') {
    return;
  }

  audioEngine.unlock();
  if (padColor) {
    audioEngine.playColor(padColor, 180);
  } else {
    audioEngine.playUiClick();
  }
  showScreen('mode');
}

/**
 * Inicializa todos os ouvintes de clique/toque (`pointerdown`), formulários e teclado.
 */
function bindEvents() {
  // --- Tela 1: Entrada por toque em qualquer quadrante ou botão ---
  dom.startPads.forEach((pad) => {
    pad.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      enterGameFromStartScreen(pad.dataset.startPad);
    });

    // Garante ativação acessível ao pressionar Enter/Espaço com foco no botão
    pad.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enterGameFromStartScreen(pad.dataset.startPad);
      }
    });
  });

  dom.btnStartPrompt.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    enterGameFromStartScreen(null);
  });

  dom.btnStartPrompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      enterGameFromStartScreen(null);
    }
  });

  // --- Tela 2: Seleção de modo ---
  dom.btnModeOnline.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    showScreen('online-config');
  });

  dom.btnModeLocal.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    showScreen('local-config');
  });

  // --- Tela 3: Configuração Local ---
  dom.btnLocalBack.addEventListener('click', () => {
    audioEngine.playUiClick();
    showScreen('mode');
  });

  dom.localPlayerButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      localConfig.playerCount = Number(btn.dataset.localPlayers);
      syncSelectorGroup(dom.localPlayerButtons, 'localPlayers', localConfig.playerCount);
    });
  });

  dom.localDifficultyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      localConfig.difficulty = btn.dataset.localDifficulty;
      syncSelectorGroup(dom.localDifficultyButtons, 'localDifficulty', localConfig.difficulty);
    });
  });

  dom.btnLocalStart.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    enterGameWithRules();
  });

  // --- Tela 4: Configuração Online (interface interativa sem backend) ---
  dom.btnOnlineBack.addEventListener('click', () => {
    audioEngine.playUiClick();
    showScreen('mode');
  });

  dom.onlinePlayerButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      onlineConfig.playerCount = Number(btn.dataset.onlinePlayers);
      syncSelectorGroup(dom.onlinePlayerButtons, 'onlinePlayers', onlineConfig.playerCount);
    });
  });

  dom.onlineDifficultyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      audioEngine.unlock();
      audioEngine.playUiClick();
      onlineConfig.difficulty = btn.dataset.onlineDifficulty;
      syncSelectorGroup(dom.onlineDifficultyButtons, 'onlineDifficulty', onlineConfig.difficulty);
    });
  });

  const handleOnlineSubmit = (event) => {
    handleJoinOnlineRoom(event);
  };

  dom.onlineConfigForm.addEventListener('submit', handleOnlineSubmit);
  dom.btnOnlineCreate.addEventListener('click', handleCreateOnlineRoom);

  // --- Modal de Lobby Online ---
  dom.btnLobbyCopy.addEventListener('click', copyLobbyCode);

  dom.btnLobbyStart.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    startOnlineMatch();
  });

  dom.btnLobbyLeave.addEventListener('click', () => {
    audioEngine.playUiClick();
    cleanupOnlineSession({ notifyServer: true });
    showScreen('online-config');
  });

  // --- Tela 5: Tabuleiro jogável com pointerdown (zero atraso de 300ms e sem duplo disparo) ---
  dom.gamePads.forEach((pad) => {
    pad.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handlePadInput(pad.dataset.color);
    });

    // Suporte acessível para acionar o quadrante focado via Enter ou Espaço
    pad.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
        event.preventDefault();
        handlePadInput(pad.dataset.color);
      }
    });
  });

  dom.btnGameBack.addEventListener('click', () => {
    audioEngine.playUiClick();
    if (gameMode === 'online') {
      cleanupOnlineSession({ notifyServer: true });
      showScreen('online-config');
    } else {
      showScreen('local-config');
    }
  });

  dom.btnGameHome.addEventListener('click', () => {
    audioEngine.unlock();
    returnToStartScreen();
  });

  dom.btnGameRules.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    // No modo online ou quando a partida local já iniciou, exibe "Voltar ao Jogo"
    const mode = gameMode === 'local' && gameState.phase === GAME_PHASES.IDLE ? 'start' : 'review';
    openRulesModal(mode);
  });

  dom.btnGameFullscreen.addEventListener('click', toggleFullscreen);
  dom.btnGameSettings.addEventListener('click', openSettingsModal);

  // --- Modal de Configurações ---
  dom.btnToggleSound.addEventListener('click', () => {
    audioEngine.unlock();
    const muted = audioEngine.toggleMute();
    syncSoundToggleUI();
    if (!muted) {
      audioEngine.playUiClick();
    }
  });

  dom.btnSettingsFullscreen.addEventListener('click', toggleFullscreen);

  dom.btnSettingsRules.addEventListener('click', () => {
    audioEngine.playUiClick();
    closeSettingsModal();
    openRulesModal('review');
  });

  dom.btnRestartMatch.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    startNewGame();
  });

  dom.btnCloseSettings.addEventListener('click', () => {
    audioEngine.playUiClick();
    closeSettingsModal();
  });

  dom.btnSettingsHome.addEventListener('click', () => {
    returnToStartScreen();
  });

  // Fecha o modal de configurações ao clicar no fundo escurecido
  dom.modalSettings.addEventListener('click', (event) => {
    if (event.target === dom.modalSettings) {
      closeSettingsModal();
    }
  });

  // --- Modal de Fim de Jogo ---
  dom.btnPlayAgain.addEventListener('click', () => {
    audioEngine.unlock();
    audioEngine.playUiClick();
    if (gameMode === 'online') {
      if (onlineSession.isHost) {
        dom.modalEndgame.hidden = true;
        startOnlineMatch();
      }
      return;
    }
    startNewGame();
  });

  dom.btnBackMenu.addEventListener('click', () => {
    audioEngine.playUiClick();
    if (gameMode === 'online') {
      cleanupOnlineSession({ notifyServer: true });
    }
    showScreen('mode');
  });

  dom.btnEndgameHome.addEventListener('click', () => {
    returnToStartScreen();
  });

  // --- Modal de Regras ---
  dom.btnRulesConfirm.addEventListener('click', confirmRulesModal);

  // Clicar fora da caixa do modal fecha o pop-up (inicia se for a 1ª abertura; retoma se já em jogo)
  dom.modalRules.addEventListener('click', (event) => {
    if (event.target === dom.modalRules) {
      confirmRulesModal();
    }
  });

  // Mantém ícones e textos sincronizados quando o usuário sai/entra em tela cheia pelo sistema
  document.addEventListener('fullscreenchange', syncFullscreenUI);
  document.addEventListener('webkitfullscreenchange', syncFullscreenUI);

  // --- Atalhos globais de teclado ---
  document.addEventListener('keydown', (event) => {
    // Na tela inicial, qualquer tecla não modificadora entra no jogo
    if (currentScreen === 'start') {
      const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'];
      if (!ignoredKeys.includes(event.key) && !event.repeat) {
        event.preventDefault();
        enterGameFromStartScreen(null);
      }
      return;
    }

    // Fecha modal de configurações ou regras com Escape
    if (event.key === 'Escape') {
      if (!dom.modalSettings.hidden) {
        event.preventDefault();
        closeSettingsModal();
        return;
      }
      if (!dom.modalRules.hidden) {
        event.preventDefault();
        confirmRulesModal();
        return;
      }
    }

    // Durante a partida, Q/W/A/S acionam Azul/Vermelho/Verde/Amarelo (ignorando repetição contínua)
    if (currentScreen === 'game' && !isAnyDialogOpen() && !event.repeat) {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      const mappedColor = KEY_TO_COLOR[event.key.toLowerCase()];
      if (mappedColor) {
        event.preventDefault();
        handlePadInput(mappedColor);
      }
    }
  });
}

// ============================================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================================
function init() {
  syncSelectorGroup(dom.localPlayerButtons, 'localPlayers', localConfig.playerCount);
  syncSelectorGroup(dom.localDifficultyButtons, 'localDifficulty', localConfig.difficulty);
  syncSelectorGroup(dom.onlinePlayerButtons, 'onlinePlayers', onlineConfig.playerCount);
  syncSelectorGroup(dom.onlineDifficultyButtons, 'onlineDifficulty', onlineConfig.difficulty);
  syncSoundToggleUI();
  syncFullscreenUI();
  bindEvents();
  showScreen('start');
}

init();
