import { between, CONFIG } from './config';
import type { InteractionState, Step } from './types';

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

interface Callbacks {
  text(): string;
  update(text: string): void;
  state(state: InteractionState): void;
  clear(): void;
}
interface Options { random?: () => number; reducedMotion?: boolean }

export async function runScript(steps: Step[], callbacks: Callbacks, signal: AbortSignal, options: Options = {}): Promise<void> {
  const random = options.random ?? Math.random;
  for (const step of steps) {
    signal.throwIfAborted();
    if (step.type === 'pause') {
      callbacks.state('ENTITY_HESITATING');
      await delay(step.ms, signal);
    } else if (step.type === 'type') {
      callbacks.state('ENTITY_TYPING');
      if (options.reducedMotion) { callbacks.update(callbacks.text() + step.text); continue; }
      let index = 0;
      for (const char of Array.from(step.text)) {
        await delay(between(CONFIG.typingDelay, random), signal);
        callbacks.update(callbacks.text() + char);
        index++;
        if (/[.!?,]/u.test(char)) {
          callbacks.state('ENTITY_HESITATING');
          await delay(between(CONFIG.punctuationPause, random), signal);
          callbacks.state('ENTITY_TYPING');
        } else if (index > 6 && char === ' ' && random() < CONFIG.probabilities.midSentencePause) {
          callbacks.state('ENTITY_HESITATING');
          await delay(between(CONFIG.thoughtPause, random), signal);
          callbacks.state('ENTITY_TYPING');
        } else if (index > 8 && /[\p{L}]/u.test(char) && random() < CONFIG.probabilities.correction) {
          callbacks.state('ENTITY_HESITATING');
          await delay(420, signal);
          callbacks.state('ENTITY_DELETING');
          callbacks.update(Array.from(callbacks.text()).slice(0, -1).join(''));
          await delay(180, signal);
          callbacks.state('ENTITY_TYPING');
          callbacks.update(callbacks.text() + char);
        }
      }
    } else if (step.type === 'delete') {
      callbacks.state('ENTITY_DELETING');
      const chars = Array.from(callbacks.text());
      const amount = step.count === 'all' ? chars.length : Math.min(chars.length, step.count);
      if (options.reducedMotion) { callbacks.update(chars.slice(0, chars.length - amount).join('')); continue; }
      for (let i = 0; i < amount; i++) {
        await delay(CONFIG.deletionDelay[step.pace] * (0.8 + random() * 0.4), signal);
        callbacks.update(Array.from(callbacks.text()).slice(0, -1).join(''));
      }
    } else if (step.type === 'clear') {
      callbacks.state('TRANSITIONING');
      callbacks.clear();
    } else {
      callbacks.state('ENTITY_SILENT');
    }
  }
}
