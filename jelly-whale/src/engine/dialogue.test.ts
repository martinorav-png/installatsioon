import { describe, expect, it } from 'vitest';
import { DialogueEngine, normalize } from './dialogue';

describe('authored dialogue', () => {
  it.each([
    ['Tere!', 'greeting'], ['kes sa oled?', 'identity'], ['kus sa oled?', 'location'],
    ['kas sa oled päris?', 'real'], ['ma pean minema', 'leaving'], ['head aega', 'leaving'],
    ['jah', 'affirmative'], ['ei', 'negative'], ['', 'empty'], ['miks sa ootad?', 'question'],
    ['mul on üksildane olla', 'loneliness'], ['mu nimi on Õie', 'name'],
  ])('recognizes %s contextually', (input, intent) => {
    const engine = new DialogueEngine(() => 0.5);
    expect(engine.reply(input, 1000).intent).toBe(intent);
    expect(engine.memory.interactions).toBe(1);
  });

  it('normalizes Estonian without stripping its letters', () => {
    expect(normalize('  ÕIE, kas sa oled PÄRIS?  ')).toBe('õie kas sa oled päris');
  });

  it('recognizes a repeated message despite case and punctuation', () => {
    const engine = new DialogueEngine(() => 0.5);
    engine.reply('Kes sa oled?', 1000);
    expect(engine.reply('KES SA OLED', 2000).intent).toBe('repeated');
    expect(engine.memory.history).toHaveLength(2);
    expect(engine.memory.repeatedWords['oled']).toBe(2);
  });

  it('answers long input without losing the memory of it', () => {
    const engine = new DialogueEngine(() => 0.5);
    const text = 'mõtlen vaikselt '.repeat(40);
    expect(engine.reply(text, 1000).intent).toBe('long');
    expect(engine.memory.history[0].text).toBe(text);
  });

  it('uses earlier visitor details in intentional recognition', () => {
    const engine = new DialogueEngine(() => 0.5);
    engine.reply('mu nimi on Õie', 1000);
    const response = engine.special('recognition');
    expect(JSON.stringify(response.steps)).toContain('Õie');
  });

  it('progresses through contact, recognition and attachment without resetting memory', () => {
    const engine = new DialogueEngine(() => 0.5);
    expect(engine.memory.narrative).toBe('contact');
    for (const [i, line] of ['tere', 'olen siin', 'kuulan', 'räägi', 'veel', 'ma jään siia'].entries()) {
      engine.reply(line, i * 2000);
    }
    expect(engine.memory.narrative).toBe('attachment');
    expect(engine.memory.hasResponded).toBe(true);
    engine.silence(180, 200000);
    expect(engine.memory.narrative).toBe('absence');
    expect(engine.memory.history).toHaveLength(6);
  });

  it('avoids recent phrases even with a fixed random source', () => {
    const engine = new DialogueEngine(() => 0.5);
    const first = engine.reply('tere', 1000);
    engine.reply('olen siin', 2000);
    const second = engine.reply('tsau', 3000);
    expect(second.id).not.toBe(first.id);
  });

  it('keeps silence sparse and reaches prolonged quiet', () => {
    const engine = new DialogueEngine(() => 0.5);
    expect(engine.silence(15, 15000)).toBeNull();
    expect(engine.silence(30, 30000)).toBeNull();
    expect(engine.silence(60, 60000)?.steps.length).toBeGreaterThan(0);
    expect(engine.silence(180, 180000)?.steps).toContainEqual({ type: 'silent' });
  });
});
