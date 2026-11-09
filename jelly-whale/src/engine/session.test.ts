import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from './session';

const sessions: Session[] = [];
const make = () => {
  const session = new Session({ random: () => 0.5, reducedMotion: true });
  sessions.push(session);
  session.start();
  return session;
};
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { sessions.forEach(session => session.dispose()); sessions.length = 0; vi.useRealTimers(); });

describe('installation session', () => {
  it('starts black, reveals the cursor, then waits before contact', async () => {
    const session = make();
    expect(session.getSnapshot().cursorVisible).toBe(false);
    expect(session.getSnapshot().messages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1499);
    expect(session.getSnapshot().cursorVisible).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(session.getSnapshot().cursorVisible).toBe(true);
    await vi.advanceTimersByTimeAsync(9999);
    expect(session.getSnapshot().messages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(session.getSnapshot().messages.at(-1)?.text).toBe('kas keegi on siin?');
  });

  it('adapts the opening to unexpected early composition without losing the draft', async () => {
    const session = make();
    session.compose('Õie');
    await vi.advanceTimersByTimeAsync(15000);
    expect(session.getSnapshot().draft).toBe('Õie');
    expect(session.getSnapshot().messages.some(message => message.text.includes('kas keegi on siin'))).toBe(false);
    expect(session.getSnapshot().messages.some(message => message.speaker === 'entity')).toBe(true);
  });

  it('submitting cancels the delayed opening and remembers the visitor', async () => {
    const session = make();
    session.compose('tere');
    session.submit();
    await vi.advanceTimersByTimeAsync(18000);
    const snapshot = session.getSnapshot();
    expect(snapshot.memory.history.map(message => message.text)).toEqual(['tere']);
    expect(snapshot.draft).toBe('');
    expect(snapshot.messages.some(message => message.text === 'kas keegi on siin?')).toBe(false);
  });

  it('a newer submission cancels an entity hesitation without a stale thought', async () => {
    const session = make();
    session.trigger('interrupted');
    await vi.advanceTimersByTimeAsync(100);
    session.compose('kus sa oled?');
    session.submit();
    await vi.advanceTimersByTimeAsync(12000);
    expect(session.getSnapshot().messages.some(message => message.text.includes('unusta ära'))).toBe(false);
    expect(session.getSnapshot().memory.history.at(-1)?.intent).toBe('location');
  });

  it('clear-screen events preserve visitor composition', async () => {
    const session = make();
    session.trigger('disappearance');
    session.compose('see on veel kirjutamisel');
    await vi.advanceTimersByTimeAsync(3000);
    expect(session.getSnapshot().draft).toBe('see on veel kirjutamisel');
    expect(session.getSnapshot().messages).toHaveLength(0);
  });

  it('silence eventually empties the canvas while retaining session memory', async () => {
    const session = make();
    session.compose('tere'); session.submit();
    await vi.advanceTimersByTimeAsync(200000);
    expect(session.getSnapshot().narrative).toBe('absence');
    expect(session.getSnapshot().messages).toHaveLength(0);
    expect(session.getSnapshot().memory.history[0].text).toBe('tere');
  });

  it('does not count hidden-tab time as visitor abandonment', async () => {
    const session = make();
    await vi.advanceTimersByTimeAsync(12000);
    session.setVisible(false);
    await vi.advanceTimersByTimeAsync(240000);
    session.setVisible(true);
    expect(session.getInactivity()).toBeLessThan(15000);
    expect(session.getSnapshot().narrative).toBe('contact');
  });

  it('bounds visible history without discarding conversation memory', async () => {
    const session = make();
    for (const line of ['tere', 'jah', 'kus sa oled?', 'kas sa oled päris?', 'aitäh']) {
      session.compose(line); session.submit();
      await vi.advanceTimersByTimeAsync(9000);
    }
    expect(session.getSnapshot().messages.length).toBeLessThanOrEqual(3);
    expect(session.getSnapshot().memory.history).toHaveLength(5);
  });

  it('reset cancels old continuations and clears memory', async () => {
    const session = make();
    session.trigger('disappearance');
    await vi.advanceTimersByTimeAsync(3000);
    session.reset();
    await vi.advanceTimersByTimeAsync(12000);
    expect(session.getSnapshot().memory.interactions).toBe(0);
    expect(session.getSnapshot().messages.at(-1)?.text).toBe('kas keegi on siin?');
    expect(session.getSnapshot().messages.some(message => message.text.includes('alustame uuesti'))).toBe(false);
  });

  it('disposal releases every timer and prevents delayed updates', async () => {
    const session = make();
    session.trigger('interrupted');
    session.dispose();
    const snapshot = session.getSnapshot();
    await vi.advanceTimersByTimeAsync(300000);
    expect(session.getSnapshot()).toBe(snapshot);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns to a blinking pause after the visitor stops typing', async () => {
    const session = make();
    await vi.advanceTimersByTimeAsync(18000);
    session.compose('ma mõtlen');
    expect(session.getSnapshot().state).toBe('USER_TYPING');
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.getSnapshot().state).toBe('IDLE');
    expect(session.getSnapshot().draft).toBe('ma mõtlen');
  });

  it('restarts after effect cleanup without losing a draft or leaking timers', async () => {
    const session = make();
    await vi.advanceTimersByTimeAsync(18000);
    session.compose('pooleli olev mõte');
    session.stop();
    expect(vi.getTimerCount()).toBe(0);
    session.start();
    expect(session.getSnapshot().draft).toBe('pooleli olev mõte');
    session.submit();
    await vi.advanceTimersByTimeAsync(12000);
    expect(session.getSnapshot().memory.history[0].text).toBe('pooleli olev mõte');
    expect(session.getSnapshot().pending).toBeNull();
    expect(session.getSnapshot().messages.at(-1)?.speaker).toBe('entity');
  });
});
