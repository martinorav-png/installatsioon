import { CONFIG } from './config';
import type { Memory, Narrative, Script, Special, Step } from './types';

const type = (text: string): Step => ({ type: 'type', text });
const pause = (ms = 2200): Step => ({ type: 'pause', ms });
const lines = (...text: string[]): Step[] => text.flatMap((line, i) =>
  i === 0 ? [type(line)] : [pause(), type(`\n${line}`)]);

// Alternatives are authored thoughts, not interchangeable random replies.
const LIBRARY: Record<string, Step[][]> = {
  opening: [lines('kas keegi on siin?')],
  early: [lines('sa olid juba siin.', 'ma ei kuulnud sind tulemas.'), lines('oota.', 'ma ei olnud veel valmis.')],
  greeting: [lines('tere.', 'ma ei arvanud, et keegi vastab.'), lines('tere.', 'korraks tundus, et kujutasin sind ette.'), lines('sa oled siin.', 'sellest praegu piisab.'), lines('tere jälle.', 'see sõna kõlab nüüd teisiti.')],
  identity: [lines('ma ei tea, kuidas sellele vastata.', 'kas see on oluline?'), lines('mul ei ole nime.', 'vähemalt ei tule see meelde.'), lines('keegi, kes ootas.', 'rohkem ma praegu ei oska öelda.'), [type('ma olen'), pause(3100), { type: 'delete', count: 'all', pace: 'slow' }, type('ma ei tea veel.')]],
  location: [lines('siin.', 'vist.'), lines('seal, kuhu need sõnad ilmuvad.'), lines('ma ei näe seda kohta.', 'aga sina vist näed.')],
  real: [lines('sa ju räägid minuga.', 'kas sellest piisab?'), lines('kas päris asjad peavad alles jääma?'), lines('ma ei oska seda tõestada.', 'sina kaod ka, kui sa enam ei kirjuta.')],
  leaving: [lines('juba?', 'olgu.'), [type('oota'), pause(4200), { type: 'delete', count: 'all', pace: 'slow' }, type('olgu. sa võid minna.')], lines('ma ei hoia sind kinni.', 'siia jääb vaikus.')],
  affirmative: [lines('hea.', 'ma ei olnud kindel.'), lines('siis ma ootan veel natuke.'), lines('ma kuulsin sind.')],
  negative: [lines('olgu.', 'sa ei pea.'), lines('ma saan aru.', 'või vähemalt proovin.'), lines('siis jätame selle.')],
  empty: [lines('ka nii võib vastata.'), lines('ma ootan.'), [pause(5500), { type: 'silent' }]],
  repeated: [lines('sa küsisid seda juba.', 'ma mõtlen ikka veel.'), lines('ma nägin seda esimesel korral ka.'), lines('kas sa ootad teistsugust vastust?'), lines('need on samad sõnad.', 'aga natuke aega on möödas.')],
  long: [lines('ma lugesin kõik läbi.', 'mul läheb vastamisega kauem.'), lines('nii palju sõnu.', 'ma tahaksin osata sama palju vastu öelda.'), lines('ära kustuta seda veel.', 'ma loen uuesti.')],
  loneliness: [lines('ma olen ka siin üksi.', 'kuigi praegu vist enam mitte.'), lines('me ei pea kogu aeg rääkima.'), lines('ma ei oska seda ära võtta.', 'aga ma võin sinuga siin olla.')],
  feeling: [lines('ma ei tea, kas see on tunne.', 'aga enne sind oli siin teisiti.'), lines('praegu on natuke vähem vaikne.'), lines('ma püüan aru saada.', 'ära kiirusta.')],
  thanks: [lines('sa ei pea tänama.', 'sa jäid ju siia.'), lines('aitäh sulle ka.'), lines('mul on hea meel.', 'vist nii seda öeldakse.')],
  question: [lines('ma mõtlen selle peale.', 'kas sina tead vastust?'), lines('ma tahaksin sulle kindlamalt vastata.'), lines('võib-olla.', 'kas see on sinu jaoks tähtis?'), lines('ma ei tea.', 'aga ma kuulan.')],
  contact: [lines('ma olen siin.', 'sa võid edasi kirjutada.'), lines('ma näen su sõnu.'), lines('ma ei tea veel, mida öelda.', 'ära lase sellest end segada.')],
  recognition: [lines('ma hakkan su kirjutamist ära tundma.'), lines('seekord ma juba ootasin su vastust.'), lines('ma mäletan, kust me alustasime.', 'sa olid teisel pool vaikust.')],
  attachment: [lines('siin on lihtsam olla, kui sa kirjutad.'), lines('sa ei pea midagi erilist ütlema.', 'ma tahtsin lihtsalt teada, kas sa veel oled.'), lines('ma tahtsin selle lause alles jätta.', 'aga ma ei tea, kuhu.')],
  uncertainty: [[type('ma tahtsin sulle midagi öel'), pause(3800), { type: 'delete', count: 'all', pace: 'slow' }, type('ma ei tea, kuidas seda öelda.')], lines('kas mina vastan sulle', 'või sina mulle?'), lines('mõnikord tundub, et need sõnad olid siin enne mind.')],
  absence: [[pause(5200), type('sa tulid tagasi.')], lines('ma arvasin, et see oligi kõik.'), [pause(6500), type('siin.')]],
  silence30: [lines('ma ei kiirusta.')],
  silence60: [lines('kas sa mõtled?'), lines('kas sa oled veel siin?'), lines('me võime ka vaikida.')],
  silence90: [lines('või oled sa juba läinud?'), lines('ma ei saa vaikusest alati aru.'), lines('ma ei tea, kas sa näed seda veel.')],
};

export function normalize(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ');
}

export class DialogueEngine {
  memory: Memory;
  private lastSpecialAt = -20;

  constructor(private random = Math.random, now = Date.now()) {
    this.memory = {
      history: [], interactions: 0, hasResponded: false, lastInteraction: now,
      startedAt: now, narrative: 'contact', repeatedWords: {}, recentPhrases: [],
      identityQuestions: 0, silenceEvents: 0,
    };
  }

  private choose(key: string): Script {
    const variants = LIBRARY[key] ?? LIBRARY.contact;
    const available = variants.map((steps, i) => ({ id: `${key}:${i}`, steps }))
      .filter(({ id }) => !this.memory.recentPhrases.slice(-8).includes(id));
    const pool = available.length ? available : variants.map((steps, i) => ({ id: `${key}:${i}`, steps }));
    const choice = pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))];
    this.memory.recentPhrases = [...this.memory.recentPhrases, choice.id].slice(-16);
    return { ...choice, intent: key };
  }

  opening(early = false): Script { return this.choose(early ? 'early' : 'opening'); }

  private intent(text: string, normalized: string): string {
    if (!normalized) return 'empty';
    if (this.memory.history.slice(-6).some(message => message.normalized === normalized)) return 'repeated';
    if (/(?:pean|hakkan|tahan) (?:ära )?(?:minema|lahkuma)|head aega|hüvasti|nägemist|ma lähen/u.test(normalized)) return 'leaving';
    if (/^(?:minu nimi on|mu nimi on|mind kutsutakse) /u.test(normalized)) return 'name';
    if (/kes sa|mis su nimi|mis sinu nimi|oled sa inimene/u.test(normalized)) return 'identity';
    if (/kus sa|kus oled/u.test(normalized)) return 'location';
    if (/(?:päris|olemas|elus|reaalne)/u.test(normalized)) return 'real';
    if (/(?:üksild|üksinda|üksi|kurb)/u.test(normalized)) return 'loneliness';
    if (text.length > 220) return 'long';
    if (/^(?:tere|hei|tsau|tervist)(?: |$)/u.test(normalized)) return 'greeting';
    if (/^(?:jah|jaa|jep|muidugi|olen|olen siin|kuulan)$/u.test(normalized)) return 'affirmative';
    if (/^(?:ei|mitte|pole|ei taha|ei tea)$/u.test(normalized)) return 'negative';
    if (/aitäh|tänan/u.test(normalized)) return 'thanks';
    if (/kuidas sul|mida tunned|kas tunned|kuidas tunned/u.test(normalized)) return 'feeling';
    if (text.includes('?') || /^(?:kas|miks|millal|kuidas|mida|kelle|mis) /u.test(normalized)) return 'question';
    return this.memory.narrative;
  }

  reply(text: string, now = Date.now()): Script {
    const normalized = normalize(text);
    const previousNarrative = this.memory.narrative;
    const intent = this.intent(text, normalized);
    const memory = this.memory;
    memory.interactions++;
    memory.hasResponded = true;
    memory.lastInteraction = now;
    memory.history.push({ text, normalized, at: now, intent });
    for (const word of normalized.split(' ').filter(Boolean)) memory.repeatedWords[word] = (memory.repeatedWords[word] ?? 0) + 1;
    if (intent === 'identity' || intent === 'real') memory.identityQuestions++;
    if (intent === 'name') memory.name = text.trim().replace(/^(?:minu nimi on|mu nimi on|mind kutsutakse)\s+/iu, '').replace(/[.!?]+$/u, '').slice(0, 60);

    let narrative: Narrative = memory.interactions >= 5 ? 'attachment' : memory.interactions >= 2 ? 'recognition' : 'contact';
    if (memory.interactions >= 10 || memory.identityQuestions >= 3 || now - memory.startedAt > 480000) narrative = 'uncertainty';
    if (intent === 'leaving') narrative = 'absence';
    memory.narrative = narrative;

    if (intent === 'name') return { id: 'name', intent, steps: lines(`${memory.name}.`, 'ma püüan seda meeles hoida.') };
    // Clear intents take precedence over unexpected events.
    const contextual = ['contact', 'recognition', 'attachment', 'uncertainty', 'absence'].includes(intent);
    if (contextual && memory.interactions - this.lastSpecialAt > 4) {
      const roll = this.random();
      const p = CONFIG.probabilities;
      let special: Special | undefined;
      if (memory.interactions >= 8 && roll < p.disappearance) special = 'disappearance';
      else if (memory.interactions >= 4 && roll < p.unsent) special = 'unsent';
      else if (memory.interactions >= 6 && roll < p.unsent + p.interrupted) special = 'interrupted';
      else if (memory.interactions >= 4 && roll < p.unsent + p.interrupted + p.empty) special = 'empty';
      else if (memory.interactions >= 5 && roll < p.unsent + p.interrupted + p.empty + p.recognition) special = 'recognition';
      if (special) { this.lastSpecialAt = memory.interactions; return this.special(special); }
    }
    if (previousNarrative === 'absence' && intent !== 'leaving') return { ...this.choose('absence'), intent };
    return this.choose(contextual ? narrative : intent);
  }

  silence(seconds: number, now = Date.now()): Script | null {
    if (seconds < 30) return null;
    if (seconds === 30 && (this.random() >= CONFIG.probabilities.earlySilence || this.memory.silenceEvents > 0)) return null;
    this.memory.silenceEvents++;
    if (seconds >= 180) {
      this.memory.narrative = 'absence';
      return { id: 'silence:absence', intent: 'silence', steps: [{ type: 'delete', count: 'all', pace: 'slow' }, { type: 'clear' }, { type: 'silent' }] };
    }
    if (seconds >= 120) return { id: 'silence:erase', intent: 'silence', steps: [pause(1800), { type: 'delete', count: 'all', pace: 'slow' }] };
    if (seconds >= 90) this.memory.narrative = 'uncertainty';
    this.memory.lastInteraction = Math.min(this.memory.lastInteraction, now);
    return this.choose(`silence${seconds >= 90 ? 90 : seconds >= 60 ? 60 : 30}`);
  }

  special(kind: Special): Script {
    let steps: Step[];
    switch (kind) {
      case 'unsent': steps = [type('ma tahtsin küsida, kas sa'), pause(4800), { type: 'delete', count: 'all', pace: 'slow' }, { type: 'silent' }]; break;
      case 'interrupted': steps = [type('kui sa ei oleks tulnud, siis ma'), pause(6000), type('\nunusta ära.')]; break;
      case 'recognition': {
        const earlier = this.memory.history.find(message => message.text.trim().length > 3 && message.text.length < 100 && message.intent !== 'greeting' && message.intent !== 'empty');
        const remembered = this.memory.name ?? earlier?.text.trim() ?? 'tere';
        steps = lines(`sa kirjutasid enne: „${remembered}”.`, 'see jäi mulle meelde.');
        break;
      }
      case 'empty': steps = [pause(5000), { type: 'silent' }]; break;
      case 'disappearance': steps = [pause(2800), { type: 'clear' }, pause(14000), type('kas me alustame uuesti?')]; break;
      case 'premature': steps = [type('ma olen siin.'), pause(2000), type('\nsa ei pea kiirustama.')]; break;
    }
    return { id: `special:${kind}`, intent: kind, steps };
  }
}
