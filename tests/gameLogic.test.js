/**
 * @fileoverview Suíte de testes unitários (TDD) da lógica pura do jogo Genius.
 * Cobre criação de estado, tempos de dificuldade, geração e validação de sequência,
 * perda de vidas, eliminação de jogadores, troca de turnos e vitória/Game Over.
 *
 * Execução via terminal: node --test tests/gameLogic.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS,
  DIFFICULTY_CONFIG,
  GAME_PHASES,
  MAX_LIVES,
  beginPlayerInput,
  createGameState,
  createPlayers,
  getActivePlayers,
  getCurrentPlayer,
  getNextAlivePlayerIndex,
  getRandomColor,
  processPlayerInput,
  startMatch,
} from '../js/gameLogic.js';

/**
 * Cria um gerador determinístico de valores em [0, 1) para controlar a ordem
 * exata das cores sorteadas durante os testes unitários.
 *
 * @param {Array<string>} colors - Lista sequencial de cores desejadas.
 * @returns {Function} Função compatível com `randomFn`.
 */
function createDeterministicRandom(colors) {
  let cursor = 0;
  return () => {
    const color = colors[cursor % colors.length];
    cursor += 1;
    const colorIndex = COLORS.indexOf(color);
    // Centro do quadrante [0..3]/4 garante mapeamento exato para a cor alvo
    return (colorIndex + 0.5) / COLORS.length;
  };
}

test('createPlayers e createGameState validam jogadores e configuram tempos de dificuldade', () => {
  // Valida rejeição de quantidades fora de 1..4 e dificuldades desconhecidas
  assert.throws(() => createPlayers(0), RangeError);
  assert.throws(() => createPlayers(5), RangeError);
  assert.throws(() => createPlayers(2.5), RangeError);
  assert.throws(() => createGameState({ playerCount: 2, difficulty: 'extreme' }), RangeError);

  // Valida os tempos exatos exigidos para Fácil, Médio e Difícil
  assert.deepEqual(
    { lit: DIFFICULTY_CONFIG.easy.litDurationMs, gap: DIFFICULTY_CONFIG.easy.intervalMs },
    { lit: 800, gap: 300 }
  );
  assert.deepEqual(
    { lit: DIFFICULTY_CONFIG.medium.litDurationMs, gap: DIFFICULTY_CONFIG.medium.intervalMs },
    { lit: 550, gap: 200 }
  );
  assert.deepEqual(
    { lit: DIFFICULTY_CONFIG.hard.litDurationMs, gap: DIFFICULTY_CONFIG.hard.intervalMs },
    { lit: 350, gap: 120 }
  );

  // Valida criação padrão de 4 jogadores com cores distintas e 3/3 vidas
  const state = createGameState({ playerCount: 4, difficulty: 'hard' });
  assert.equal(state.phase, GAME_PHASES.IDLE);
  assert.equal(state.players.length, 4);
  assert.deepEqual(
    state.players.map((p) => ({ id: p.id, color: p.color, lives: p.lives, eliminated: p.eliminated })),
    [
      { id: 1, color: 'blue', lives: MAX_LIVES, eliminated: false },
      { id: 2, color: 'red', lives: MAX_LIVES, eliminated: false },
      { id: 3, color: 'green', lives: MAX_LIVES, eliminated: false },
      { id: 4, color: 'yellow', lives: MAX_LIVES, eliminated: false },
    ]
  );
  assert.equal(state.timing.litDurationMs, 350);
  assert.equal(state.timing.intervalMs, 120);
});

test('getRandomColor respeita limites [0, 1) e mapeia todas as 4 cores', () => {
  assert.equal(getRandomColor(() => 0), 'blue');
  assert.equal(getRandomColor(() => 0.25), 'red');
  assert.equal(getRandomColor(() => 0.5), 'green');
  assert.equal(getRandomColor(() => 0.99999), 'yellow');
  assert.equal(getRandomColor(() => 1.5), 'yellow');
});

test('startMatch e bloqueio de jogadas fora de AWAITING_INPUT', () => {
  const random = createDeterministicRandom(['green', 'blue']);
  const idleState = createGameState({ playerCount: 2, difficulty: 'easy' });

  // Em IDLE, qualquer clique deve ser ignorado
  const ignoredIdle = processPlayerInput(idleState, 'blue');
  assert.equal(ignoredIdle.outcome, 'IGNORED');
  assert.equal(ignoredIdle.state.phase, GAME_PHASES.IDLE);

  // Ao iniciar partida, sorteia 1 cor e entra em SHOWING_SEQUENCE
  const showingState = startMatch(idleState, random);
  assert.equal(showingState.phase, GAME_PHASES.SHOWING_SEQUENCE);
  assert.deepEqual(showingState.sequence, ['green']);
  assert.equal(showingState.round, 1);
  assert.equal(showingState.completedRounds, 0);
  assert.equal(getCurrentPlayer(showingState).id, 1);

  // Durante SHOWING_SEQUENCE, cliques permanecem bloqueados
  const ignoredShowing = processPlayerInput(showingState, 'green');
  assert.equal(ignoredShowing.outcome, 'IGNORED');
  assert.equal(ignoredShowing.state, showingState);

  // Liberação para entrada do jogador
  const awaitingState = beginPlayerInput(showingState);
  assert.equal(awaitingState.phase, GAME_PHASES.AWAITING_INPUT);
  assert.equal(awaitingState.inputIndex, 0);

  // Cor inválida deve lançar RangeError
  assert.throws(() => processPlayerInput(awaitingState, 'purple'), RangeError);
});

test('validação passo a passo, crescimento da sequência e troca de turnos no multiplayer', () => {
  const random = createDeterministicRandom(['blue', 'red', 'yellow', 'green']);
  let state = startMatch(createGameState({ playerCount: 3, difficulty: 'medium' }), random);

  // Turno 1: Jogador 1 acerta ['blue'] -> avança para Jogador 2 com sequência ['blue', 'red']
  state = beginPlayerInput(state);
  const res1 = processPlayerInput(state, 'blue', random);
  assert.equal(res1.outcome, 'SEQUENCE_COMPLETE');
  assert.equal(res1.completedRound, 1);
  assert.equal(res1.nextColor, 'red');
  state = res1.state;

  assert.equal(state.phase, GAME_PHASES.SHOWING_SEQUENCE);
  assert.equal(state.round, 2);
  assert.equal(state.completedRounds, 1);
  assert.equal(getCurrentPlayer(state).id, 2);
  assert.deepEqual(state.sequence, ['blue', 'red']);

  // Turno 2: Jogador 2 acerta passo 1 ('blue') -> STEP_CORRECT, depois passo 2 ('red') -> Jogador 3
  state = beginPlayerInput(state);
  const step1 = processPlayerInput(state, 'blue', random);
  assert.equal(step1.outcome, 'STEP_CORRECT');
  assert.equal(step1.state.inputIndex, 1);
  // Confirma imutabilidade do estado anterior
  assert.equal(state.inputIndex, 0);

  const res2 = processPlayerInput(step1.state, 'red', random);
  assert.equal(res2.outcome, 'SEQUENCE_COMPLETE');
  assert.equal(res2.completedRound, 2);
  state = res2.state;

  assert.equal(getCurrentPlayer(state).id, 3);
  assert.deepEqual(state.sequence, ['blue', 'red', 'yellow']);

  // Turno 3: Jogador 3 acerta todos os 3 passos -> gira circularmente de volta ao Jogador 1
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'blue', random).state;
  state = processPlayerInput(state, 'red', random).state;
  const res3 = processPlayerInput(state, 'yellow', random);
  assert.equal(res3.outcome, 'SEQUENCE_COMPLETE');
  state = res3.state;

  assert.equal(getCurrentPlayer(state).id, 1);
  assert.equal(state.round, 4);
  assert.deepEqual(state.sequence, ['blue', 'red', 'yellow', 'green']);
});

test('modo 1 jogador: acerto mantém turno no Jogador 1 e erro desconta vida até Game Over', () => {
  const random = createDeterministicRandom(['blue', 'yellow']);
  let state = startMatch(createGameState({ playerCount: 1, difficulty: 'easy' }), random);

  // Acerta rodada 1 -> permanece no Jogador 1
  state = beginPlayerInput(state);
  const winRound1 = processPlayerInput(state, 'blue', random);
  assert.equal(winRound1.outcome, 'SEQUENCE_COMPLETE');
  state = winRound1.state;
  assert.equal(getCurrentPlayer(state).id, 1);
  assert.equal(state.round, 2);
  assert.deepEqual(state.sequence, ['blue', 'yellow']);

  // Erro 1 (2/3 vidas): mantém sequência ['blue', 'yellow'] e rodada 2
  state = beginPlayerInput(state);
  const err1 = processPlayerInput(state, 'red', random);
  assert.equal(err1.outcome, 'LIFE_LOST');
  assert.equal(err1.expectedColor, 'blue');
  assert.equal(err1.affectedPlayer.lives, 2);
  assert.equal(err1.state.phase, GAME_PHASES.SHOWING_SEQUENCE);
  assert.deepEqual(err1.state.sequence, ['blue', 'yellow']);
  assert.equal(err1.state.round, 2);

  // Erro 2 (1/3 vida)
  state = beginPlayerInput(err1.state);
  state = processPlayerInput(state, 'blue', random).state; // acerta 1ª
  const err2 = processPlayerInput(state, 'green', random); // erra 2ª
  assert.equal(err2.outcome, 'LIFE_LOST');
  assert.equal(err2.expectedColor, 'yellow');
  assert.equal(err2.affectedPlayer.lives, 1);
  assert.equal(err2.affectedPlayer.eliminated, false);

  // Erro 3 (0/3 vidas): Game Over
  state = beginPlayerInput(err2.state);
  const err3 = processPlayerInput(state, 'yellow', random);
  assert.equal(err3.outcome, 'GAME_OVER');
  assert.equal(err3.affectedPlayer.lives, 0);
  assert.equal(err3.affectedPlayer.eliminated, true);
  assert.equal(err3.state.phase, GAME_PHASES.GAME_OVER);
  assert.equal(err3.state.winner, null);
  assert.equal(err3.state.completedRounds, 1);

  // Após Game Over, novas jogadas são ignoradas
  const afterEnd = processPlayerInput(err3.state, 'blue', random);
  assert.equal(afterEnd.outcome, 'IGNORED');
});

test('eliminação no modo 3 jogadores pula jogador eliminado e declara vitória ao último vivo', () => {
  const random = createDeterministicRandom(['red']);
  let state = startMatch(createGameState({ playerCount: 3, difficulty: 'hard' }), random);

  // Jogador 1 erra 1ª vez -> passa para Jogador 2
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'blue', random).state; // J1: 2 vidas
  assert.equal(getCurrentPlayer(state).id, 2);

  // Jogador 2 acerta para chegar de volta ao Jogador 1 depois do J3
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'red', random).state; // sequência: ['red', 'red'], vez J3

  // Jogador 3 acerta ['red', 'red'] -> vez volta ao Jogador 1 (com 2 vidas)
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'red', random).state;
  state = processPlayerInput(state, 'red', random).state; // sequência: 3x 'red', vez J1

  // Jogador 1 erra 2ª vez -> 1 vida restante, vez vai ao J2
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'green', random).state; // J1: 1 vida
  assert.equal(getCurrentPlayer(state).id, 2);

  // J2 erra (2 vidas), J3 erra (2 vidas), volta ao J1
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'yellow', random).state; // J2: 2 vidas, vez J3
  state = beginPlayerInput(state);
  state = processPlayerInput(state, 'yellow', random).state; // J3: 2 vidas, vez J1

  // Jogador 1 erra pela 3ª vez -> ELIMINADO (ainda restam J2 e J3 vivos)
  state = beginPlayerInput(state);
  const elimJ1 = processPlayerInput(state, 'blue', random);
  assert.equal(elimJ1.outcome, 'PLAYER_ELIMINATED');
  assert.equal(elimJ1.eliminatedPlayer.id, 1);
  assert.equal(elimJ1.state.players[0].lives, 0);
  assert.equal(elimJ1.state.players[0].eliminated, true);
  assert.equal(getActivePlayers(elimJ1.state.players).length, 2);
  assert.equal(getCurrentPlayer(elimJ1.state).id, 2);
  assert.equal(elimJ1.state.phase, GAME_PHASES.SHOWING_SEQUENCE);

  // J2 erra (1 vida) -> passa para J3
  state = beginPlayerInput(elimJ1.state);
  state = processPlayerInput(state, 'blue', random).state; // J2: 1 vida, vez J3
  assert.equal(getCurrentPlayer(state).id, 3);

  // J3 acerta toda a sequência -> DEVE PULAR J1 (eliminado) e ir direto para J2!
  state = beginPlayerInput(state);
  for (let i = 0; i < state.sequence.length - 1; i += 1) {
    state = processPlayerInput(state, state.sequence[i], random).state;
  }
  const j3Complete = processPlayerInput(state, state.sequence[state.sequence.length - 1], random);
  assert.equal(j3Complete.outcome, 'SEQUENCE_COMPLETE');
  assert.equal(getCurrentPlayer(j3Complete.state).id, 2);

  // J2 erra pela 3ª vez -> Jogador 3 vence como último sobrevivente!
  state = beginPlayerInput(j3Complete.state);
  const victory = processPlayerInput(state, 'green', random);
  assert.equal(victory.outcome, 'VICTORY');
  assert.equal(victory.eliminatedPlayer.id, 2);
  assert.equal(victory.winner.id, 3);
  assert.equal(victory.state.phase, GAME_PHASES.VICTORY);
  assert.equal(victory.state.winner.id, 3);

  // Após vitória, entradas adicionais são ignoradas
  assert.equal(processPlayerInput(victory.state, 'red').outcome, 'IGNORED');
});

test('modo 2 jogadores: derrota de um declara vitória imediata do outro', () => {
  const random = createDeterministicRandom(['yellow']);
  let state = startMatch(createGameState({ playerCount: 2, difficulty: 'medium' }), random);

  // Alterna erros: J1 (2), J2 (2), J1 (1), J2 (1)
  for (let i = 0; i < 4; i += 1) {
    state = beginPlayerInput(state);
    state = processPlayerInput(state, 'blue', random).state;
  }

  assert.equal(getCurrentPlayer(state).id, 1);
  assert.equal(state.players[0].lives, 1);
  assert.equal(state.players[1].lives, 1);

  // J1 erra sua 3ª vida -> Jogador 2 vence imediatamente
  state = beginPlayerInput(state);
  const victory = processPlayerInput(state, 'red', random);
  assert.equal(victory.outcome, 'VICTORY');
  assert.equal(victory.winner.id, 2);
  assert.equal(victory.state.phase, GAME_PHASES.VICTORY);
});

test('getNextAlivePlayerIndex retorna -1 quando não há jogadores vivos', () => {
  const deadPlayers = createPlayers(2).map((p) => ({ ...p, lives: 0, eliminated: true }));
  assert.equal(getNextAlivePlayerIndex(deadPlayers, 0), -1);
  assert.equal(getNextAlivePlayerIndex([], 0), -1);
});
