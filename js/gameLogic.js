/**
 * @fileoverview Máquina de estados pura e regras de jogabilidade do Genius (Simon Says).
 * Este módulo é totalmente desacoplado do DOM para permitir testes unitários (TDD)
 * determinísticos via Node.js e reutilização direta pela camada de interface.
 */

/**
 * Cores oficiais dos 4 quadrantes do tabuleiro, ordenadas no sentido de leitura:
 * Superior Esquerdo (blue), Superior Direito (red),
 * Inferior Esquerdo (green) e Inferior Direito (yellow).
 */
export const COLORS = Object.freeze(['blue', 'red', 'green', 'yellow']);

/**
 * Mapeamento de cor associada a cada jogador (1 a 4), seguindo os cards das telas.
 */
export const PLAYER_COLORS = Object.freeze(['blue', 'red', 'green', 'yellow']);

/**
 * Limites de vidas e participantes do modo multiplayer local.
 */
export const MAX_LIVES = 3;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

/**
 * Configurações de tempo (em milissegundos) para cada nível de dificuldade:
 * - litDurationMs: tempo em que cada quadrante permanece aceso durante a demonstração.
 * - intervalMs: pausa escura entre uma cor e a próxima na sequência.
 */
export const DIFFICULTY_CONFIG = Object.freeze({
  easy: Object.freeze({
    key: 'easy',
    label: 'Fácil',
    litDurationMs: 800,
    intervalMs: 300,
  }),
  medium: Object.freeze({
    key: 'medium',
    label: 'Médio',
    litDurationMs: 550,
    intervalMs: 200,
  }),
  hard: Object.freeze({
    key: 'hard',
    label: 'Difícil',
    litDurationMs: 350,
    intervalMs: 120,
  }),
});

/**
 * Fases possíveis da máquina de estados da partida:
 * - IDLE: partida criada, mas ainda não iniciada.
 * - SHOWING_SEQUENCE: sistema exibindo a sequência (cliques/teclas do jogador ficam bloqueados).
 * - AWAITING_INPUT: sistema aguardando o jogador atual repetir a sequência na ordem exata.
 * - GAME_OVER: derrota no modo 1 jogador após perder todas as vidas.
 * - VICTORY: vitória no modo 2 a 4 jogadores quando resta apenas 1 sobrevivente.
 */
export const GAME_PHASES = Object.freeze({
  IDLE: 'IDLE',
  SHOWING_SEQUENCE: 'SHOWING_SEQUENCE',
  AWAITING_INPUT: 'AWAITING_INPUT',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
});

/**
 * Cria a lista inicial de jogadores com 3/3 vidas e suas respectivas cores.
 *
 * @param {number} playerCount - Quantidade de jogadores (inteiro de 1 a 4).
 * @returns {Array<Object>} Lista de objetos representando cada jogador.
 */
export function createPlayers(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RangeError(
      `Quantidade de jogadores inválida: ${playerCount}. Informe um inteiro entre ${MIN_PLAYERS} e ${MAX_PLAYERS}.`
    );
  }

  return Array.from({ length: playerCount }, (_, index) => {
    const id = index + 1;
    return {
      id,
      name: `Jogador ${id}`,
      color: PLAYER_COLORS[index],
      lives: MAX_LIVES,
      maxLives: MAX_LIVES,
      eliminated: false,
    };
  });
}

/**
 * Obtém os parâmetros de tempo e rótulo correspondentes à dificuldade informada.
 *
 * @param {string} difficulty - Chave da dificuldade ('easy' | 'medium' | 'hard').
 * @returns {Object} Configuração imutável da dificuldade.
 */
export function getDifficultyConfig(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty];
  if (!config) {
    throw new RangeError(
      `Dificuldade inválida: "${difficulty}". Valores aceitos: ${Object.keys(DIFFICULTY_CONFIG).join(', ')}.`
    );
  }
  return config;
}

/**
 * Cria o estado inicial completo de uma partida antes do início do primeiro turno.
 *
 * Variáveis principais de estado:
 * - playerCount: total de participantes configurados (1 a 4).
 * - difficulty / timing: dificuldade escolhida e durações em ms da sequência.
 * - players: vetor de jogadores com vidas atuais e status de eliminação.
 * - currentPlayerIndex: índice (0-based) do jogador dono do turno atual.
 * - sequence: array ordenado das cores sorteadas até o momento.
 * - inputIndex: posição esperada da próxima cor que o jogador deve acertar na sequência.
 * - round: rodada atual em andamento (começa em 1 quando a partida inicia).
 * - completedRounds: quantidade de sequências completas com sucesso (usada para recorde).
 * - phase: estado atual da máquina de estados (GAME_PHASES).
 * - winner: referência ao jogador vencedor em partidas multiplayer finalizadas.
 * - lastErrorPlayerId: identificador do último jogador que cometeu erro no turno anterior.
 *
 * @param {Object} [options] - Opções iniciais da partida.
 * @param {number} [options.playerCount=1] - Quantidade de jogadores (1 a 4).
 * @param {string} [options.difficulty='medium'] - Nível de dificuldade.
 * @returns {Object} Estado inicial imutável por convenção.
 */
export function createGameState({ playerCount = 1, difficulty = 'medium' } = {}) {
  const players = createPlayers(playerCount);
  const timing = getDifficultyConfig(difficulty);

  return {
    playerCount,
    difficulty,
    timing,
    players,
    currentPlayerIndex: 0,
    sequence: [],
    inputIndex: 0,
    round: 0,
    completedRounds: 0,
    phase: GAME_PHASES.IDLE,
    winner: null,
    lastErrorPlayerId: null,
  };
}

/**
 * Sorteia uma cor aleatória entre as 4 disponíveis no tabuleiro.
 * Aceita uma função aleatória customizada para permitir testes unitários determinísticos.
 *
 * @param {Function} [randomFn=Math.random] - Gerador de número no intervalo [0, 1).
 * @returns {string} Nome da cor sorteada ('blue' | 'red' | 'green' | 'yellow').
 */
export function getRandomColor(randomFn = Math.random) {
  const rawValue = Number(randomFn());
  const clamped = Number.isFinite(rawValue) ? Math.min(Math.max(rawValue, 0), 0.999999999) : 0;
  const index = Math.floor(clamped * COLORS.length);
  return COLORS[index];
}

/**
 * Retorna apenas os jogadores que ainda não foram eliminados e possuem vidas > 0.
 *
 * @param {Array<Object>} players - Lista de jogadores da partida.
 * @returns {Array<Object>} Subconjunto dos jogadores ainda ativos.
 */
export function getActivePlayers(players) {
  return players.filter((player) => !player.eliminated && player.lives > 0);
}

/**
 * Retorna o objeto do jogador da vez com base em `currentPlayerIndex`.
 *
 * @param {Object} state - Estado atual do jogo.
 * @returns {Object|null} Jogador atual ou null caso não exista.
 */
export function getCurrentPlayer(state) {
  if (!state || !Array.isArray(state.players)) {
    return null;
  }
  return state.players[state.currentPlayerIndex] || null;
}

/**
 * Calcula o índice do próximo jogador vivo em ordem circular.
 * - Em modo multiplayer, pula automaticamente jogadores com `eliminated === true`.
 * - Em modo 1 jogador (se ainda vivo), retorna o próprio índice 0.
 * - Caso não exista nenhum jogador vivo, retorna -1.
 *
 * @param {Array<Object>} players - Lista de jogadores.
 * @param {number} currentIndex - Índice do jogador que acabou de jogar.
 * @returns {number} Índice do próximo jogador vivo ou -1.
 */
export function getNextAlivePlayerIndex(players, currentIndex) {
  if (!Array.isArray(players) || players.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidateIndex = (currentIndex + offset) % players.length;
    const candidate = players[candidateIndex];
    if (candidate && !candidate.eliminated && candidate.lives > 0) {
      return candidateIndex;
    }
  }

  return -1;
}

/**
 * Inicia (ou reinicia) uma partida com o mesmo número de jogadores e dificuldade.
 * Restaura todas as vidas para 3/3, sorteia a primeira cor da sequência
 * e coloca o jogo na fase SHOWING_SEQUENCE.
 *
 * @param {Object} state - Estado base configurado.
 * @param {Function} [randomFn=Math.random] - Função de sorteio (injetável para testes).
 * @returns {Object} Novo estado pronto para exibir a primeira sequência.
 */
export function startMatch(state, randomFn = Math.random) {
  const freshPlayers = createPlayers(state.playerCount);
  const firstColor = getRandomColor(randomFn);

  return {
    ...state,
    players: freshPlayers,
    currentPlayerIndex: 0,
    sequence: [firstColor],
    inputIndex: 0,
    round: 1,
    completedRounds: 0,
    phase: GAME_PHASES.SHOWING_SEQUENCE,
    winner: null,
    lastErrorPlayerId: null,
  };
}

/**
 * Libera a entrada do jogador após o término da exibição visual/sonora da sequência.
 * Só efetua a transição se a máquina estiver na fase SHOWING_SEQUENCE.
 *
 * @param {Object} state - Estado atual da partida.
 * @returns {Object} Novo estado em AWAITING_INPUT (ou o mesmo estado caso não aplicável).
 */
export function beginPlayerInput(state) {
  if (state.phase !== GAME_PHASES.SHOWING_SEQUENCE) {
    return state;
  }

  return {
    ...state,
    phase: GAME_PHASES.AWAITING_INPUT,
    inputIndex: 0,
  };
}

/**
 * Valida a jogada (toque, clique ou atalho de teclado) do jogador atual.
 *
 * Regras aplicadas:
 * 1. Se o jogo não estiver em AWAITING_INPUT (ex.: exibindo sequência ou encerrado),
 *    a entrada é ignorada sem alterar o estado ('IGNORED').
 * 2. Se a cor coincidir com `sequence[inputIndex]`:
 *    - Se ainda restarem passos na sequência, avança `inputIndex` ('STEP_CORRECT').
 *    - Se for o último passo da sequência, incrementa `completedRounds` e `round`,
 *      passa o turno para o próximo jogador vivo, sorteia uma nova cor para a sequência
 *      e retorna para SHOWING_SEQUENCE ('SEQUENCE_COMPLETE').
 * 3. Se a cor divergir da esperada:
 *    - Desconta 1 vida do jogador atual e verifica se chegou a 0/3 (eliminação).
 *    - No modo 1 jogador com 0 vidas: encerra em GAME_OVER ('GAME_OVER').
 *    - No modo 2 a 4 jogadores restando apenas 1 vivo: encerra em VICTORY ('VICTORY').
 *    - Caso a partida continue: mantém a mesma sequência e rodada, passa o turno
 *      para o próximo jogador vivo (ou repete no modo solo) em SHOWING_SEQUENCE
 *      ('LIFE_LOST' ou 'PLAYER_ELIMINATED').
 *
 * @param {Object} state - Estado atual da partida.
 * @param {string} color - Cor acionada pelo jogador.
 * @param {Function} [randomFn=Math.random] - Função aleatória para sortear próxima cor.
 * @returns {Object} Resultado da validação contendo `{ outcome, state, ...metadados }`.
 */
export function processPlayerInput(state, color, randomFn = Math.random) {
  // Bloqueia qualquer tentativa de jogada enquanto a sequência é exibida ou após o fim do jogo
  if (state.phase !== GAME_PHASES.AWAITING_INPUT) {
    return {
      outcome: 'IGNORED',
      state,
    };
  }

  if (!COLORS.includes(color)) {
    throw new RangeError(
      `Cor inválida: "${color}". Cores permitidas: ${COLORS.join(', ')}.`
    );
  }

  const expectedColor = state.sequence[state.inputIndex];

  // Caso 1: Jogador acertou a cor esperada na posição atual
  if (color === expectedColor) {
    const nextInputIndex = state.inputIndex + 1;

    // Ainda faltam cores para completar a sequência desta rodada
    if (nextInputIndex < state.sequence.length) {
      return {
        outcome: 'STEP_CORRECT',
        state: {
          ...state,
          inputIndex: nextInputIndex,
        },
      };
    }

    // Sequência inteira repetida corretamente: avança rodada, sorteia nova cor e gira turno
    const completedRounds = state.completedRounds + 1;
    const nextRound = state.round + 1;
    const nextPlayerIndex = getNextAlivePlayerIndex(state.players, state.currentPlayerIndex);
    const nextColor = getRandomColor(randomFn);

    return {
      outcome: 'SEQUENCE_COMPLETE',
      completedRound: completedRounds,
      nextColor,
      state: {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        sequence: [...state.sequence, nextColor],
        inputIndex: 0,
        round: nextRound,
        completedRounds,
        phase: GAME_PHASES.SHOWING_SEQUENCE,
        lastErrorPlayerId: null,
      },
    };
  }

  // Caso 2: Jogador errou a cor esperada — clona lista de jogadores e aplica perda de 1 vida
  const updatedPlayers = state.players.map((player, index) => {
    if (index !== state.currentPlayerIndex) {
      return { ...player };
    }
    const newLives = Math.max(0, player.lives - 1);
    return {
      ...player,
      lives: newLives,
      eliminated: newLives === 0,
    };
  });

  const affectedPlayer = updatedPlayers[state.currentPlayerIndex];
  const isEliminated = affectedPlayer.eliminated;
  const alivePlayers = getActivePlayers(updatedPlayers);

  // Modo solo: jogador único perdeu a última vida -> Game Over
  if (state.playerCount === 1 && isEliminated) {
    return {
      outcome: 'GAME_OVER',
      expectedColor,
      affectedPlayer,
      eliminatedPlayer: affectedPlayer,
      state: {
        ...state,
        players: updatedPlayers,
        inputIndex: 0,
        phase: GAME_PHASES.GAME_OVER,
        winner: null,
        lastErrorPlayerId: affectedPlayer.id,
      },
    };
  }

  // Modo multiplayer (2 a 4 jogadores): partida termina quando resta apenas 1 sobrevivente
  if (state.playerCount > 1 && alivePlayers.length === 1) {
    const winner = alivePlayers[0];
    return {
      outcome: 'VICTORY',
      expectedColor,
      affectedPlayer,
      eliminatedPlayer: affectedPlayer,
      winner,
      state: {
        ...state,
        players: updatedPlayers,
        inputIndex: 0,
        phase: GAME_PHASES.VICTORY,
        winner,
        lastErrorPlayerId: affectedPlayer.id,
      },
    };
  }

  // Partida continua: mantém a sequência atual, passa a vez ao próximo vivo e reexibe
  const nextPlayerIndex = getNextAlivePlayerIndex(updatedPlayers, state.currentPlayerIndex);

  return {
    outcome: isEliminated ? 'PLAYER_ELIMINATED' : 'LIFE_LOST',
    expectedColor,
    affectedPlayer,
    eliminatedPlayer: isEliminated ? affectedPlayer : null,
    state: {
      ...state,
      players: updatedPlayers,
      currentPlayerIndex: nextPlayerIndex,
      inputIndex: 0,
      phase: GAME_PHASES.SHOWING_SEQUENCE,
      lastErrorPlayerId: affectedPlayer.id,
    },
  };
}
