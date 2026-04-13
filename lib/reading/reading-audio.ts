import { SHUFFLE_PHASE_VISUAL_CYCLE_SEC } from "@/lib/reading/shuffle-phase-timing";
import { devWarn } from "@/lib/dev-warn";

/**
 * Bus gains and spread-bed tuning: caps summed gain when many cards overlap; bed skips leading silence;
 * speed multiplier scales each audible slice to the CSS deal window (see `runScheduleSpreadDealShuffleBed`).
 */
const WALLET_SHUFFLE_LOOP_START_SEC = 0.16;
const SFX_BUS_GAIN = 0.52;
const AMBIENT_BUS_GAIN = 0.14;
const SHUFFLE_BUS_GAIN = 0.16;
const WALLET_SHUFFLE_SOURCE_GAIN = 0.34;
const SPREAD_DEAL_PER_CARD_GAIN_CAP = 0.38;
const SPREAD_SHUFFLE_BED_SPEED_MULT = 2.75;
const SPREAD_SHUFFLE_BED_BUFFER_OFFSET_SEC = 0.14;
const GAME_AMBIENT_GAIN = 0.18;
const GAME_SFX_GAIN = 0.65;

const READING_AUDIO_URLS = {
  ambient: "/audio/reading/ambient-drone-loop.mp3",
  enterPortal: "/audio/reading/enter-portal.mp3",
  shuffleBed: "/audio/reading/shuffle-bed.mp3",
  walletShuffle: "/audio/reading/wallet-shuffle.mp3",
  revealCinematic: "/audio/reading/reveal-cinematic.mp3",
} as const;

const GAME_AUDIO_URLS = {
  gameLoop: "/audio/game/game_bg_loop.wav",
  correct: "/audio/game/correct.wav",
  wrong: "/audio/game/wrong.wav",
  stinger: "/audio/game/stinger.mp3",
  damage01: "/audio/game/damage/damage_01.wav",
  damage02: "/audio/game/damage/damage_02.wav",
  damage03: "/audio/game/damage/damage_03.wav",
  damage04: "/audio/game/damage/damage_04.wav",
  damage05: "/audio/game/damage/damage_05.wav",
  damage06: "/audio/game/damage/damage_06.wav",
  damage07: "/audio/game/damage/damage_07.wav",
  damage08: "/audio/game/damage/damage_08.wav",
  damage09: "/audio/game/damage/damage_09.wav",
  damage10: "/audio/game/damage/damage_10.wav",
} as const;

type ReadingAudioBufferKey = keyof typeof READING_AUDIO_URLS;
type GameAudioBufferKey = keyof typeof GAME_AUDIO_URLS;

const GAME_DAMAGE_KEYS: GameAudioBufferKey[] = [
  "damage01",
  "damage02",
  "damage03",
  "damage04",
  "damage05",
  "damage06",
  "damage07",
  "damage08",
  "damage09",
  "damage10",
];

export class ReadingAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private shuffleGain: GainNode | null = null;
  private gameAmbientGain: GainNode | null = null;
  private gameSfxGain: GainNode | null = null;
  private readonly buffers = new Map<ReadingAudioBufferKey, AudioBuffer>();
  private readonly gameBuffers = new Map<GameAudioBufferKey, AudioBuffer>();
  private ambientSource: AudioBufferSourceNode | null = null;
  private shuffleSource: AudioBufferSourceNode | null = null;
  private walletShuffleSource: AudioBufferSourceNode | null = null;
  private gameAmbientSource: AudioBufferSourceNode | null = null;
  private preloadDone = false;
  private preloadPromise: Promise<void> | null = null;
  private readonly rawArrayBuffers = new Map<ReadingAudioBufferKey, ArrayBuffer>();
  private readonly gameRawArrayBuffers = new Map<GameAudioBufferKey, ArrayBuffer>();
  /** Reused so lobby + duel can call `preloadGameAudio` without duplicate fetches. */
  private gameAudioPreloadPromise: Promise<void> | null = null;
  private prefetchDone = false;
  private prefetchPromise: Promise<void> | null = null;
  /** Decode shuffle-bed in parallel so deal SFX is not blocked by full buffer preload. */
  private shuffleBedLoadPromise: Promise<void> | null = null;
  private spreadDealSources: AudioBufferSourceNode[] = [];

  private outputEnabled = true;

  private ensureGraph(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = SFX_BUS_GAIN;
    this.sfxGain.connect(this.master);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = AMBIENT_BUS_GAIN;
    this.ambientGain.connect(this.master);

    this.shuffleGain = this.ctx.createGain();
    this.shuffleGain.gain.value = SHUFFLE_BUS_GAIN;
    this.shuffleGain.connect(this.master);

    this.gameAmbientGain = this.ctx.createGain();
    this.gameAmbientGain.gain.value = GAME_AMBIENT_GAIN;
    this.gameAmbientGain.connect(this.master);

    this.gameSfxGain = this.ctx.createGain();
    this.gameSfxGain.gain.value = GAME_SFX_GAIN;
    this.gameSfxGain.connect(this.master);

    return this.ctx;
  }

  async prefetchRaw(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.prefetchDone) return;
    if (this.prefetchPromise) return this.prefetchPromise;

    this.prefetchPromise = (async () => {
      const entries = Object.entries(READING_AUDIO_URLS) as [
        ReadingAudioBufferKey,
        string,
      ][];
      await Promise.all(
        entries.map(async ([key, url]) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            this.rawArrayBuffers.set(key, await res.arrayBuffer());
          } catch (e) {
            devWarn(`reading-audio:prefetch:${key}`, e);
          }
        }),
      );
      this.prefetchDone = true;
    })();

    try {
      await this.prefetchPromise;
    } finally {
      this.prefetchPromise = null;
    }
  }

  async preload(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.preloadDone) return;
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      const ctx = this.ensureGraph();
      if (!ctx) return;
      const entries = Object.entries(READING_AUDIO_URLS) as [
        ReadingAudioBufferKey,
        string,
      ][];
      await Promise.all(
        entries.map(async ([key, url]) => {
          try {
            let arr: ArrayBuffer;
            const raw = this.rawArrayBuffers.get(key);
            if (raw) {
              arr = raw.slice(0);
            } else {
              const res = await fetch(url);
              if (!res.ok) return;
              arr = await res.arrayBuffer();
            }
            const buf = await ctx.decodeAudioData(arr);
            this.buffers.set(key, buf);
          } catch (e) {
            devWarn(`reading-audio:preload:${key}`, e);
          }
        }),
      );
      this.preloadDone = true;
    })();

    try {
      await this.preloadPromise;
    } finally {
      this.preloadPromise = null;
    }
  }

  get isPreloaded(): boolean {
    return this.preloadDone;
  }

  beginResumeFromUserGesture(): void {
    const ctx = this.ensureGraph();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  async resume(): Promise<void> {
    const ctx = this.ensureGraph();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (e) {
        devWarn("reading-audio:resume", e);
      }
    }
  }

  setOutputEnabled(on: boolean): void {
    this.outputEnabled = on;
    if (this.master) this.master.gain.value = on ? 1 : 0;
    if (!on) {
      this.stopAmbientInternal();
      this.stopShuffleInternal();
      this.stopWalletShuffleInternal();
      this.stopGameLoop();
    }
  }

  get outputOn(): boolean {
    return this.outputEnabled;
  }

  private canPlay(): boolean {
    return this.outputEnabled && this.preloadDone && !!this.ctx && !!this.master;
  }

  private canPlayGame(): boolean {
    return this.outputEnabled && !!this.ctx && !!this.master;
  }

  private async ensureGameBuffer(key: GameAudioBufferKey): Promise<AudioBuffer | null> {
    if (typeof window === "undefined") return null;
    const ctx = this.ensureGraph();
    if (!ctx) return null;
    const existing = this.gameBuffers.get(key);
    if (existing) return existing;

    try {
      let arr: ArrayBuffer;
      const raw = this.gameRawArrayBuffers.get(key);
      if (raw) {
        arr = raw.slice(0);
      } else {
        const url = GAME_AUDIO_URLS[key];
        const res = await fetch(url);
        if (!res.ok) return null;
        arr = await res.arrayBuffer();
        this.gameRawArrayBuffers.set(key, arr.slice(0));
      }
      const buf = await ctx.decodeAudioData(arr);
      this.gameBuffers.set(key, buf);
      return buf;
    } catch (e) {
      devWarn(`reading-audio:game-preload:${key}`, e);
      return null;
    }
  }

  playEnterPortal(): void {
    if (!this.canPlay()) return;
    this.playOneShotKey("enterPortal", this.sfxGain!, 0.42);
  }

  async preloadGameAudio(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.gameAudioPreloadPromise) return this.gameAudioPreloadPromise;
    this.gameAudioPreloadPromise = Promise.all(
      (Object.keys(GAME_AUDIO_URLS) as GameAudioBufferKey[]).map((key) =>
        this.ensureGameBuffer(key),
      ),
    ).then(() => undefined);
    return this.gameAudioPreloadPromise;
  }

  startGameLoop(): void {
    if (!this.canPlayGame()) return;
    if (this.gameAmbientSource) return;
    void this.ensureGameBuffer("gameLoop").then((buf) => {
      if (!buf || !this.gameAmbientGain || this.gameAmbientSource) return;
      const ctx = this.ctx!;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.gameAmbientGain);
      src.start(0);
      this.gameAmbientSource = src;
    });
  }

  stopGameLoop(): void {
    if (this.gameAmbientSource) {
      try {
        this.gameAmbientSource.stop();
      } catch (e) {
        devWarn("reading-audio:game-loop-stop", e);
      }
      try {
        this.gameAmbientSource.disconnect();
      } catch (e) {
        devWarn("reading-audio:game-loop-disconnect", e);
      }
      this.gameAmbientSource = null;
    }
  }

  private playGameOneShot(key: GameAudioBufferKey, gain = 0.7): void {
    if (!this.canPlayGame() || !this.gameSfxGain) return;
    void this.ensureGameBuffer(key).then((buf) => {
      if (!buf || !this.gameSfxGain) return;
      const ctx = this.ctx!;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.gameSfxGain);
      src.start(0);
    });
  }

  playGameCorrect(): void {
    this.playGameOneShot("correct", 0.75);
  }

  playGameWrong(): void {
    this.playGameOneShot("wrong", 0.75);
  }

  playGameStinger(): void {
    this.playGameOneShot("stinger", 0.7);
  }

  playGameDamage(): void {
    const idx = Math.floor(Math.random() * GAME_DAMAGE_KEYS.length);
    const key = GAME_DAMAGE_KEYS[idx] ?? "damage01";
    this.playGameOneShot(key, 0.8);
  }

  startAmbientLoop(): void {
    if (!this.canPlay()) return;
    if (this.ambientSource) return;
    const ctx = this.ctx!;
    const buf = this.buffers.get("ambient");
    if (!buf || !this.ambientGain) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.ambientGain);
    src.start(0);
    this.ambientSource = src;
  }

  stopAmbientLoop(): void {
    this.stopAmbientInternal();
  }

  private stopAmbientInternal(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch (e) {
        devWarn("reading-audio:ambient-stop", e);
      }
      try {
        this.ambientSource.disconnect();
      } catch (e) {
        devWarn("reading-audio:ambient-disconnect", e);
      }
      this.ambientSource = null;
    }
  }

  startWalletShuffleLoop(
    visualCycleSec: number = SHUFFLE_PHASE_VISUAL_CYCLE_SEC,
  ): void {
    if (!this.canPlay()) return;
    this.stopWalletShuffleInternal();
    const ctx = this.ctx!;
    const buf = this.buffers.get("walletShuffle");
    if (!buf || !this.shuffleGain) return;

    const cycle = Math.max(0.25, visualCycleSec);
    let loopStart = Math.min(WALLET_SHUFFLE_LOOP_START_SEC, Math.max(0, buf.duration - 0.5));
    let loopEnd = Math.min(loopStart + cycle, buf.duration);
    if (loopEnd - loopStart < 0.2) {
      loopStart = 0;
      loopEnd = Math.min(cycle, buf.duration);
    }
    const segmentLen = loopEnd - loopStart;
    if (segmentLen <= 0) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;
    src.playbackRate.value = segmentLen / cycle;

    const step = ctx.createGain();
    step.gain.value = WALLET_SHUFFLE_SOURCE_GAIN;
    src.connect(step);
    step.connect(this.shuffleGain);
    src.start(ctx.currentTime);
    this.walletShuffleSource = src;
  }

  stopWalletShuffleLoop(): void {
    this.stopWalletShuffleInternal();
  }

  private stopWalletShuffleInternal(): void {
    if (this.walletShuffleSource) {
      try {
        this.walletShuffleSource.stop();
      } catch (e) {
        devWarn("reading-audio:wallet-shuffle-stop", e);
      }
      try {
        this.walletShuffleSource.disconnect();
      } catch (e) {
        devWarn("reading-audio:wallet-shuffle-disconnect", e);
      }
      this.walletShuffleSource = null;
    }
  }

  cancelSpreadDealSchedule(): void {
    for (const s of this.spreadDealSources) {
      try {
        s.stop();
      } catch (e) {
        devWarn("reading-audio:spread-stop", e);
      }
      try {
        s.disconnect();
      } catch (e) {
        devWarn("reading-audio:spread-disconnect", e);
      }
    }
    this.spreadDealSources = [];
  }

  /** Stagger on AudioContext time so hits align with CSS deal timing (`spread-phase-constants`). */
  scheduleSpreadDealShuffleBed(opts: {
    staggerSec: number;
    durationSec: number;
    playbackRates: number[];
  }): void {
    void this.runScheduleSpreadDealShuffleBed(opts);
  }

  /**
   * Per-card shuffle-bed slices; Web Audio `start(when, offset, duration)` uses buffer seconds, so
   * `bufferSlice` tracks wall clock via `effectiveRate` (duration/rate ≈ wall time).
   */
  private async runScheduleSpreadDealShuffleBed(opts: {
    staggerSec: number;
    durationSec: number;
    playbackRates: number[];
  }): Promise<void> {
    this.cancelSpreadDealSchedule();
    if (!this.outputEnabled) return;
    this.beginResumeFromUserGesture();
    const ctx = this.ensureGraph();
    if (!ctx || !this.shuffleGain) return;

    await this.ensureShuffleBedBuffer();
    const buf = this.buffers.get("shuffleBed");
    if (!buf) return;

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch (e) {
        devWarn("reading-audio:spread-resume", e);
      }
    }

    if (!this.outputEnabled) return;

    const n = Math.max(1, opts.playbackRates.length);
    const perCardGain = Math.min(SPREAD_DEAL_PER_CARD_GAIN_CAP, 0.82 / Math.sqrt(n));

    const wallSec = Math.max(0.035, opts.durationSec);
    const bufOffset = Math.min(
      SPREAD_SHUFFLE_BED_BUFFER_OFFSET_SEC,
      Math.max(0, buf.duration * 0.2 - 0.02),
    );
    const maxBufferSlice = Math.max(0.04, buf.duration - bufOffset - 0.02);

    const lookaheadSec = 0.06;
    const t0 = ctx.currentTime + lookaheadSec;

    for (let i = 0; i < opts.playbackRates.length; i++) {
      const userRate = Math.max(0.72, Math.min(1.18, opts.playbackRates[i] ?? 1));
      const effectiveRate = SPREAD_SHUFFLE_BED_SPEED_MULT * userRate;
      const bufferSlice = Math.min(maxBufferSlice, wallSec * effectiveRate);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = effectiveRate;
      const g = ctx.createGain();
      g.gain.value = perCardGain;
      src.connect(g);
      g.connect(this.shuffleGain);
      const when = t0 + i * opts.staggerSec;
      try {
        src.start(when, bufOffset, bufferSlice);
      } catch (e) {
        devWarn("reading-audio:spread-start-slice", e);
        try {
          src.start(when, bufOffset);
        } catch (e2) {
          devWarn("reading-audio:spread-start-fallback", e2);
        }
      }
      this.spreadDealSources.push(src);
    }
  }

  private ensureShuffleBedBuffer(): Promise<void> {
    if (this.buffers.get("shuffleBed")) return Promise.resolve();
    if (this.shuffleBedLoadPromise) return this.shuffleBedLoadPromise;

    this.shuffleBedLoadPromise = (async () => {
      const ctx = this.ensureGraph();
      if (!ctx) return;
      const key: ReadingAudioBufferKey = "shuffleBed";
      try {
        let arr: ArrayBuffer;
        const raw = this.rawArrayBuffers.get(key);
        if (raw) {
          arr = raw.slice(0);
        } else {
          const res = await fetch(READING_AUDIO_URLS.shuffleBed);
          if (!res.ok) return;
          arr = await res.arrayBuffer();
        }
        const buf = await ctx.decodeAudioData(arr);
        this.buffers.set(key, buf);
      } catch (e) {
        devWarn("reading-audio:shuffle-bed-decode", e);
      }
    })().finally(() => {
      this.shuffleBedLoadPromise = null;
    });

    return this.shuffleBedLoadPromise;
  }

  startShuffleBed(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const buf = this.buffers.get("shuffleBed");
    if (!buf || !this.shuffleGain) return;
    this.stopShuffleInternal();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 1;
    src.connect(this.shuffleGain);
    src.start(0);
    this.shuffleSource = src;
  }

  stopShuffleBed(): void {
    this.stopShuffleInternal();
  }

  private stopShuffleInternal(): void {
    if (this.shuffleSource) {
      try {
        this.shuffleSource.stop();
      } catch (e) {
        devWarn("reading-audio:shuffle-stop", e);
      }
      try {
        this.shuffleSource.disconnect();
      } catch (e) {
        devWarn("reading-audio:shuffle-disconnect", e);
      }
      this.shuffleSource = null;
    }
  }

  playRevealCinematic(): void {
    if (!this.canPlay()) return;
    this.playOneShotKey("revealCinematic", this.sfxGain!, 0.36);
  }

  private playOneShotKey(
    key: ReadingAudioBufferKey,
    bus: GainNode,
    gain: number,
  ): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(key);
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(bus);
    src.start(0);
  }

  dispose(): void {
    this.cancelSpreadDealSchedule();
    this.stopAmbientInternal();
    this.stopShuffleInternal();
    this.stopWalletShuffleInternal();
    this.stopGameLoop();
    try {
      this.ctx?.close();
    } catch (e) {
      devWarn("reading-audio:ctx-close", e);
    }
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.shuffleGain = null;
    this.buffers.clear();
    this.gameBuffers.clear();
    this.gameRawArrayBuffers.clear();
    this.gameAudioPreloadPromise = null;
    this.preloadDone = false;
    this.preloadPromise = null;
    this.shuffleBedLoadPromise = null;
  }
}
