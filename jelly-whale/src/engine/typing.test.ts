import { afterEach, describe, expect, it, vi } from 'vitest';
import { runScript } from './typing';

afterEach(() => vi.useRealTimers());

describe('typing runner', () => {
  it('types Unicode and partially deletes before rewriting', async () => {
    vi.useFakeTimers();
    let visible = '';
    const changes: string[] = [];
    const run = runScript([
      { type: 'type', text: 'Õie, öö' },
      { type: 'pause', ms: 1000 },
      { type: 'delete', count: 2, pace: 'slow' },
      { type: 'type', text: 'tere' },
    ], {
      text: () => visible,
      update: (text) => { visible = text; changes.push(text); },
      state: () => {}, clear: () => { visible = ''; },
    }, new AbortController().signal, { random: () => 0.5 });
    await vi.runAllTimersAsync();
    await run;
    expect(visible).toBe('Õie, tere');
    expect(changes).toContain('Õie, ö');
    expect(changes).toContain('Õie, ');
  });

  it('aborts pending work without a stale continuation', async () => {
    vi.useFakeTimers();
    let visible = '';
    const controller = new AbortController();
    const run = runScript([{ type: 'pause', ms: 5000 }, { type: 'type', text: 'vana' }], {
      text: () => visible, update: (text) => { visible = text; },
      state: () => {}, clear: () => {},
    }, controller.signal);
    controller.abort();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    await vi.runAllTimersAsync();
    expect(visible).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reduced motion presents whole thoughts while retaining narrative pauses', async () => {
    vi.useFakeTimers();
    let visible = '';
    const run = runScript([{ type: 'pause', ms: 2000 }, { type: 'type', text: 'olen siin.' }], {
      text: () => visible, update: (text) => { visible = text; },
      state: () => {}, clear: () => {},
    }, new AbortController().signal, { reducedMotion: true });
    await vi.advanceTimersByTimeAsync(1999);
    expect(visible).toBe('');
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(visible).toBe('olen siin.');
  });
});
