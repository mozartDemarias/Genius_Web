/**
 * @fileoverview Controlador principal da interface do jogo Genius (Simon Says).
 * Conecta a máquina de estados pura (`gameLogic.js`), o motor de áudio (`audio.js`),
 * a navegação entre as 5 telas, os eventos híbridos (`pointerdown` + teclado)
 * e a persistência de recorde em `localStorage`.
 */

import {
  GAME_PHASES,
  beginPlayerInput,
  createGameState,
  getCurrentPlayer,
  processPlayerInput,
  startMatch,
} from './gameLogic.js';
import { audioEngine } from './audio.js';

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
  btnRestartMatch: document.getElementById('btn-restart-match'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnSettingsHome: document.getElementById('btn-settings-home'),

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

/** Preferências selecionadas na tela de configuração online (apenas interface interativa). */
const onlineConfig = {
  playerCount: 2,
  difficulty: 'medium',
};

/** Estado corrente da partida gerenciado pelas funções puras de `gameLogic.js`. */
let gameState = createGameState(localConfig);

/** Recorde salvo no localStorage (maior número de sequências completadas). */
let highScore = loadHighScore();

/** Indica se o jogador superou o recorde durante a partida em andamento. */
let isNewRecordInMatch = false;

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
 * Verifica se há algum modal auxiliar (Configurações ou Fim de Jogo) aberto.
 *
 * @returns {boolean}
 */
function isAnyDialogOpen() {
  return !dom.modalSettings.hidden || !dom.modalEndgame.hidden;
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
 * modais abertos e estado da partida, e reativando a animação idle.
 */
function returnToStartScreen() {
  cancelActivePlayback();
  audioEngine.stopAll();
  dom.modalSettings.hidden = true;
  dom.modalEndgame.hidden = true;

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
  dom.hudRound.textContent = String(gameState.round);
  dom.gameStage.dataset.players = String(gameState.playerCount);

  const currentPlayer = getCurrentPlayer(gameState);
  const isShowing = gameState.phase === GAME_PHASES.SHOWING_SEQUENCE;
  const isEnded =
    gameState.phase === GAME_PHASES.GAME_OVER || gameState.phase === GAME_PHASES.VICTORY;

  // Bloqueia visualmente o tabuleiro enquanto o sistema demonstra a sequência ou após o fim
  dom.gameBoard.classList.toggle('is-locked', isShowing || isEnded);

  // Atualiza texto dinâmico no círculo central do tabuleiro
  if (isShowing) {
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
      card.classList.remove('is-current', 'is-eliminated');
      return;
    }

    card.hidden = false;
    const isCurrentTurn =
      !isEnded && currentPlayer && currentPlayer.id === player.id;

    card.classList.toggle('is-current', Boolean(isCurrentTurn));
    card.classList.toggle('is-eliminated', player.eliminated);

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
 * Inicializa uma nova partida local usando as configurações escolhidas pelo usuário.
 */
function startNewGame() {
  cancelActivePlayback();
  dom.modalSettings.hidden = true;
  dom.modalEndgame.hidden = true;

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
    startNewGame();
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

  const handleOnlineDevNotice = (event) => {
    event.preventDefault();
    audioEngine.unlock();
    audioEngine.playUiClick();
    showToast('Modo online em desenvolvimento. Utilize o modo Local para jogar!');
  };

  dom.onlineConfigForm.addEventListener('submit', handleOnlineDevNotice);
  dom.btnOnlineCreate.addEventListener('click', handleOnlineDevNotice);

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
    showScreen('local-config');
  });

  dom.btnGameHome.addEventListener('click', () => {
    audioEngine.unlock();
    returnToStartScreen();
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
    startNewGame();
  });

  dom.btnBackMenu.addEventListener('click', () => {
    audioEngine.playUiClick();
    showScreen('mode');
  });

  dom.btnEndgameHome.addEventListener('click', () => {
    returnToStartScreen();
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

    // Fecha modal de configurações com Escape
    if (event.key === 'Escape' && !dom.modalSettings.hidden) {
      event.preventDefault();
      closeSettingsModal();
      return;
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
