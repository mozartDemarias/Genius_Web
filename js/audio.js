/**
 * @fileoverview Motor de áudio sintetizado com Web Audio API pura.
 * Gera notas musicais para as 4 cores do Genius, efeitos de erro, vitória,
 * fim de jogo e cliques de interface, além de gerenciar o estado de mudo
 * persistido em `localStorage`.
 */

/** Chave utilizada no localStorage para guardar a preferência de som (mudo). */
export const SOUND_STORAGE_KEY = 'genius_sound_muted';

/**
 * Frequências musicais (em Hz) associadas a cada quadrante do tabuleiro.
 * Formam um acorde agradável inspirado no Genius clássico:
 * - blue: Mi4 (E4)
 * - red: Lá4 (A4)
 * - green: Dó#4 (C#4)
 * - yellow: Dó#5 (C#5)
 */
const COLOR_FREQUENCIES = Object.freeze({
  blue: 329.63,
  red: 440.0,
  green: 277.18,
  yellow: 554.37,
});

/**
 * Motor responsável pela síntese sonora sem dependência de arquivos de áudio externos.
 */
export class AudioEngine {
  /**
   * @param {Object} [options] - Configurações opcionais do motor de áudio.
   * @param {string} [options.storageKey=SOUND_STORAGE_KEY] - Chave de persistência no localStorage.
   */
  constructor({ storageKey = SOUND_STORAGE_KEY } = {}) {
    this.storageKey = storageKey;
    /** Instância única de AudioContext criada apenas após interação do usuário. */
    this.context = null;
    /** Estado atual de silenciamento carregado de forma segura do localStorage. */
    this.muted = this._loadMutedPreference();
  }

  /**
   * Lê a preferência de mudo no localStorage, tratando ambientes restritos.
   *
   * @returns {boolean} Verdadeiro se o som estiver silenciado.
   */
  _loadMutedPreference() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Salva a preferência de mudo no localStorage com proteção contra falhas de cota/privacidade.
   *
   * @param {boolean} muted - Novo estado de mudo.
   */
  _saveMutedPreference(muted) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, String(Boolean(muted)));
      }
    } catch {
      // Ignora erros de armazenamento em navegação privada ou ambiente sem DOM
    }
  }

  /**
   * Cria (se necessário) e desbloqueia o AudioContext na primeira interação do usuário,
   * atendendo às políticas de autoplay dos navegadores modernos.
   *
   * @returns {AudioContext|null} Instância pronta do AudioContext ou null se indisponível.
   */
  unlock() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }

    if (!this.context) {
      this.context = new AudioCtx();
    }

    if (this.context.state === 'suspended') {
      // resume() retorna Promise; capturamos rejeições caso ainda não haja gesto válido
      this.context.resume().catch(() => {});
    }

    return this.context;
  }

  /**
   * Retorna se o áudio está atualmente silenciado.
   *
   * @returns {boolean}
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Define explicitamente o estado de mudo e o persiste no localStorage.
   *
   * @param {boolean} muted - `true` para silenciar, `false` para ativar o som.
   * @returns {boolean} Estado resultante.
   */
  setMuted(muted) {
    this.muted = Boolean(muted);
    this._saveMutedPreference(this.muted);
    return this.muted;
  }

  /**
   * Alterna entre som ligado e desligado, retornando o novo estado de mudo.
   *
   * @returns {boolean} Novo valor de `muted`.
   */
  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /**
   * Sintetiza uma nota individual com envelope ADSR suave (ataque curto + decaimento)
   * para evitar estalos digitais no início e no fim do som.
   *
   * @param {Object} params - Parâmetros de síntese da nota.
   * @param {number} params.frequency - Frequência inicial em Hz.
   * @param {number} [params.endFrequency] - Frequência final para deslize (glissando).
   * @param {number} [params.durationMs=300] - Duração total da nota em milissegundos.
   * @param {string} [params.type='sine'] - Forma de onda primária ('sine' | 'triangle' | 'sawtooth').
   * @param {number} [params.peakGain=0.22] - Ganho máximo da nota (0 a 1).
   * @param {number} [params.delaySec=0] - Atraso em segundos para encadear arpejos.
   * @param {boolean} [params.addHarmonic=false] - Adiciona camada suave de onda triangular.
   */
  _playTone({
    frequency,
    endFrequency = frequency,
    durationMs = 300,
    type = 'sine',
    peakGain = 0.22,
    delaySec = 0,
    addHarmonic = false,
  }) {
    if (this.muted) {
      return;
    }

    const ctx = this.unlock();
    if (!ctx) {
      return;
    }

    const now = ctx.currentTime + delaySec;
    const durationSec = Math.max(0.05, durationMs / 1000);
    const attackSec = Math.min(0.015, durationSec * 0.2);
    const releaseStart = now + Math.max(attackSec, durationSec - 0.04);
    const stopTime = now + durationSec + 0.02;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + attackSec);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain * 0.65), releaseStart);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    gainNode.connect(ctx.destination);

    // Oscilador principal
    const primaryOsc = ctx.createOscillator();
    primaryOsc.type = type;
    primaryOsc.frequency.setValueAtTime(frequency, now);
    if (endFrequency !== frequency) {
      primaryOsc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stopTime);
    }
    primaryOsc.connect(gainNode);
    primaryOsc.start(now);
    primaryOsc.stop(stopTime);

    // Camada harmônica sutil em onda triangular para dar corpo às notas das cores
    if (addHarmonic) {
      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.0001, now);
      harmonicGain.gain.linearRampToValueAtTime(peakGain * 0.25, now + attackSec);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
      harmonicGain.connect(ctx.destination);

      const harmonicOsc = ctx.createOscillator();
      harmonicOsc.type = 'triangle';
      harmonicOsc.frequency.setValueAtTime(frequency, now);
      harmonicOsc.connect(harmonicGain);
      harmonicOsc.start(now);
      harmonicOsc.stop(stopTime);
    }
  }

  /**
   * Reproduz a nota musical correspondente a uma das 4 cores do tabuleiro.
   *
   * @param {string} color - Cor do quadrante ('blue' | 'red' | 'green' | 'yellow').
   * @param {number} [durationMs=350] - Tempo de sustentação da nota em ms.
   */
  playColor(color, durationMs = 350) {
    const frequency = COLOR_FREQUENCIES[color];
    if (!frequency) {
      return;
    }

    this._playTone({
      frequency,
      durationMs,
      type: 'sine',
      peakGain: 0.22,
      addHarmonic: true,
    });
  }

  /**
   * Reproduz efeito sonoro grave descendente quando o jogador erra uma cor.
   */
  playError() {
    this._playTone({
      frequency: 165,
      endFrequency: 92,
      durationMs: 420,
      type: 'sawtooth',
      peakGain: 0.16,
    });
    this._playTone({
      frequency: 120,
      endFrequency: 72,
      durationMs: 420,
      type: 'triangle',
      peakGain: 0.14,
    });
  }

  /**
   * Reproduz arpejo ascendente festivo para celebrar vitória em partida multiplayer.
   */
  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // Dó5, Mi5, Sol5, Dó6
    notes.forEach((frequency, index) => {
      this._playTone({
        frequency,
        durationMs: index === notes.length - 1 ? 380 : 140,
        type: 'triangle',
        peakGain: 0.2,
        delaySec: index * 0.11,
      });
    });
  }

  /**
   * Reproduz cadência curta descendente quando ocorre Game Over no modo solo.
   */
  playGameOver() {
    const notes = [329.63, 261.63, 196.0]; // Mi4, Dó4, Sol3
    notes.forEach((frequency, index) => {
      this._playTone({
        frequency,
        durationMs: index === notes.length - 1 ? 420 : 180,
        type: 'triangle',
        peakGain: 0.18,
        delaySec: index * 0.16,
      });
    });
  }

  /**
   * Reproduz um clique sutil ao interagir com botões de navegação e opções.
   */
  playUiClick() {
    this._playTone({
      frequency: 660,
      endFrequency: 740,
      durationMs: 65,
      type: 'sine',
      peakGain: 0.08,
    });
  }
}

/** Instância padrão compartilhada pela aplicação. */
export const audioEngine = new AudioEngine();
