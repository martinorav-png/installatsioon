import { between, CONFIG } from './config';
import { DialogueEngine } from './dialogue';
import { delay, runScript } from './typing';
import type { InteractionState, Script, Snapshot, Special, VisibleMessage } from './types';

interface SessionOptions { random?: () => number; reducedMotion?: boolean }

// One coordinator owns the animation controller and clock. No React render owns a timer.
export class Session {
  private engine: DialogueEngine;
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private sequence = 0;
  private started = false;
  private disposed = false;
  private visible = true;
  private hiddenAt: number | null = null;
  private lastActivity = Date.now();
  private lastComposedAt = 0;
  private compositionStartedAt: number | null = null;
  private silenceLevel = 0;
  private earlyContact = false;
  private openingFinished = false;
  private prematureUsed = false;
  private sharedAt = -10;
  private random: () => number;
  private reducedMotion: boolean;

  constructor(options: SessionOptions = {}) {
    this.random = options.random ?? Math.random;
    this.reducedMotion = options.reducedMotion ?? false;
    this.engine = new DialogueEngine(this.random);
    this.snapshot = this.initialSnapshot();
  }

  private initialSnapshot(): Snapshot {
    return {
      state: 'INITIALIZING', narrative: 'contact', cursorVisible: false,
      messages: [], draft: '', pending: null, announcement: '',
      memory: this.copyMemory(), error: null, quiet: false,
    };
  }

  private copyMemory() {
    const memory = this.engine.memory;
    return { ...memory, history: [...memory.history], repeatedWords: { ...memory.repeatedWords }, recentPhrases: [...memory.recentPhrases] };
  }

  getSnapshot = (): Snapshot => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getInactivity = () => Math.max(0, (this.hiddenAt ?? Date.now()) - this.lastActivity);
  getDuration = () => Date.now() - this.engine.memory.startedAt;

  private patch(change: Partial<Snapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...change, memory: this.copyMemory(), narrative: this.engine.memory.narrative };
    this.listeners.forEach(listener => listener());
  }

  private cancel() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }

  private fail(error: unknown, generation: number) {
    if (generation !== this.generation || this.disposed) return;
    this.controller = null;
    this.patch({ pending: null, state: 'ENTITY_SILENT', error: error instanceof Error ? error.message : String(error) });
  }

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.lastActivity = Date.now();
    this.ticker = setInterval(() => this.tick(), 500);
    if (this.openingFinished) {
      this.patch({ pending: null, state: this.snapshot.draft ? 'USER_TYPING' : 'IDLE' });
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    void (async () => {
      await delay(CONFIG.cursorDelay, controller.signal);
      this.patch({ cursorVisible: true, state: 'IDLE' });
      await delay(between(CONFIG.openingDelay, this.random), controller.signal);
      if (!this.visible) return;
      this.openingFinished = true;
      this.perform(this.engine.opening());
    })().catch(error => this.fail(error, generation));
  }

  compose(text: string) {
    if (this.disposed) return;
    const draft = text.slice(0, CONFIG.maxInputLength);
    this.lastActivity = Date.now();
    this.lastComposedAt = Date.now();
    this.silenceLevel = 0;
    if (this.compositionStartedAt === null && draft) this.compositionStartedAt = Date.now();
    if (!draft) this.compositionStartedAt = null;
    this.patch({ draft, cursorVisible: true, quiet: false,
      ...(!this.snapshot.pending ? { state: draft ? 'USER_TYPING' as const : 'IDLE' as const } : {}),
    });
    if (!this.openingFinished && !this.earlyContact && draft) {
      this.earlyContact = true;
      this.openingFinished = true;
      this.perform(this.engine.opening(true), between(CONFIG.responseDelay, this.random));
    }
  }

  submit() {
    if (this.disposed) return;
    const text = this.snapshot.draft.trim();
    this.lastActivity = Date.now();
    this.silenceLevel = 0;
    this.compositionStartedAt = null;
    this.openingFinished = true;
    this.cancel();
    if (text) this.append('visitor', text);
    this.patch({ draft: '', cursorVisible: true, quiet: false, error: null });
    const script = this.engine.reply(text, Date.now());
    const absenceDelay = this.engine.memory.narrative === 'absence' ? 1800 : 0;
    this.perform(script, between(CONFIG.responseDelay, this.random) + absenceDelay);
  }

  private append(speaker: VisibleMessage['speaker'], text: string): number {
    const id = ++this.sequence;
    const message: VisibleMessage = { id, speaker, text, createdAt: Date.now(), fading: false };
    this.patch({ messages: [...this.snapshot.messages.filter(item => item.text), message].slice(-CONFIG.maxVisibleMessages) });
    return id;
  }

  private perform(script: Script, wait = 0, reusePrevious = false) {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    const generation = this.generation;
    let target: number | null = reusePrevious
      ? this.snapshot.messages.findLast(message => message.speaker === 'entity')?.id ?? null
      : null;
    let result: InteractionState = 'IDLE';
    this.patch({ pending: script, state: wait ? 'WAITING_FOR_RESPONSE' : 'ENTITY_HESITATING', cursorVisible: true });
    void (async () => {
      if (wait) await delay(wait, controller.signal);
      await runScript(script.steps, {
        text: () => this.snapshot.messages.find(message => message.id === target)?.text ?? '',
        update: text => {
          if (target === null && text) target = this.append('entity', text);
          else this.patch({ messages: this.snapshot.messages.map(message => message.id === target ? { ...message, text, fading: false, createdAt: Date.now() } : message) });
        },
        state: state => { result = state; this.patch({ state }); },
        clear: () => { target = null; this.patch({ messages: [], announcement: '' }); },
      }, controller.signal, { random: this.random, reducedMotion: this.reducedMotion });
      if (generation !== this.generation || this.disposed) return;
      this.controller = null;
      const silent = (result as InteractionState) === 'ENTITY_SILENT';
      const announcement = this.snapshot.messages.find(message => message.id === target)?.text ?? '';
      this.patch({ pending: null, announcement,
        messages: this.snapshot.messages.filter(message => message.text),
        state: this.snapshot.draft ? 'USER_TYPING' : silent ? 'ENTITY_SILENT' : 'IDLE',
      });
    })().catch(error => this.fail(error, generation));
  }

  private tick() {
    if (this.disposed || !this.visible) return;
    const now = Date.now();
    if (!this.snapshot.pending && this.snapshot.state === 'USER_TYPING' && now - this.lastComposedAt >= 900) {
      this.patch({ state: 'IDLE' });
    }
    const messages = this.snapshot.messages;
    if (!this.snapshot.pending && messages.some(message => now - message.createdAt > CONFIG.fadeAfter)) {
      this.patch({ messages: messages
        .filter(message => now - message.createdAt < CONFIG.fadeAfter + CONFIG.fadeDuration)
        .map(message => ({ ...message, fading: now - message.createdAt >= CONFIG.fadeAfter })),
      });
    }
    const elapsed = this.getInactivity() / 1000;
    const threshold = [...CONFIG.silenceThresholds].reverse().find(seconds => elapsed >= seconds && seconds > this.silenceLevel);
    if (threshold && (threshold >= 180 || (!this.snapshot.pending && this.openingFinished))) {
      this.silenceLevel = threshold;
      const script = this.engine.silence(threshold, now);
      if (script) {
        if (threshold >= 180) this.patch({ quiet: true });
        this.perform(script, 0, threshold >= 120);
      }
    }
    if (!this.prematureUsed && !this.snapshot.pending && this.compositionStartedAt !== null &&
      now - this.compositionStartedAt >= CONFIG.prematureAfter && now - this.lastComposedAt < 2500 &&
      this.engine.memory.interactions >= 4 && this.snapshot.draft.length >= 15) {
      // One opportunity per composition interval, rather than a probability on every keystroke.
      this.compositionStartedAt = now;
      if (this.random() < CONFIG.probabilities.premature) {
        this.prematureUsed = true;
        this.perform(this.engine.special('premature'));
      }
    }
  }

  backspace() {
    const count = this.engine.memory.interactions;
    if (this.snapshot.pending || count < 5 || count - this.sharedAt < 5 || this.random() >= CONFIG.probabilities.sharedDeletion) return;
    const target = this.snapshot.messages.findLast(message => message.speaker === 'entity' && message.text);
    if (!target) return;
    this.sharedAt = count;
    this.patch({ messages: this.snapshot.messages.map(message => message.id === target.id
      ? { ...message, text: Array.from(message.text).slice(0, -2).join('') } : message) });
  }

  setVisible(visible: boolean) {
    if (this.disposed || visible === this.visible) return;
    this.visible = visible;
    if (!visible) {
      this.hiddenAt = Date.now();
      this.cancel();
      this.patch({ pending: null, state: 'ENTITY_SILENT' });
    } else {
      const away = Date.now() - (this.hiddenAt ?? Date.now());
      this.lastActivity += away;
      this.hiddenAt = null;
      this.patch({ state: this.snapshot.draft ? 'USER_TYPING' : 'IDLE' });
      if (!this.openingFinished) {
        this.openingFinished = true;
        this.perform(this.engine.opening(), between(CONFIG.openingDelay, this.random));
      }
    }
  }

  setReducedMotion(value: boolean) { this.reducedMotion = value; }

  trigger(kind: Special | 'shared-deletion' | 'silence') {
    if (this.disposed) return;
    this.openingFinished = true;
    if (kind === 'silence') {
      this.lastActivity = Date.now() - 60000;
      this.silenceLevel = 30;
      this.tick();
    } else if (kind === 'shared-deletion') {
      const target = this.snapshot.messages.findLast(message => message.speaker === 'entity');
      if (target && !this.snapshot.pending) this.perform({ id: 'debug:shared', intent: 'shared-deletion', steps: [{ type: 'delete', count: 4, pace: 'slow' }] }, 0, true);
    } else this.perform(this.engine.special(kind));
  }

  reset() {
    this.cancel();
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.engine = new DialogueEngine(this.random);
    this.started = false;
    this.earlyContact = false;
    this.openingFinished = false;
    this.prematureUsed = false;
    this.sharedAt = -10;
    this.silenceLevel = 0;
    this.compositionStartedAt = null;
    this.hiddenAt = null;
    this.patch({ ...this.initialSnapshot(), state: 'RESETTING' });
    this.start();
  }

  // React may replay effects during development. Stop resources without destroying memory.
  stop() {
    this.cancel();
    this.started = false;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.patch({ pending: null, state: this.snapshot.draft ? 'USER_TYPING' : 'IDLE' });
  }

  dispose() {
    this.cancel();
    this.disposed = true;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.listeners.clear();
  }
}
