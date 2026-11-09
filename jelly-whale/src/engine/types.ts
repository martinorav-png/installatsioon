export type Narrative = 'contact' | 'recognition' | 'attachment' | 'uncertainty' | 'absence';
export type InteractionState =
  | 'INITIALIZING' | 'IDLE' | 'ENTITY_TYPING' | 'ENTITY_HESITATING'
  | 'ENTITY_DELETING' | 'USER_TYPING' | 'WAITING_FOR_RESPONSE'
  | 'ENTITY_SILENT' | 'TRANSITIONING' | 'RESETTING';

export type Step =
  | { type: 'type'; text: string }
  | { type: 'pause'; ms: number }
  | { type: 'delete'; count: number | 'all'; pace: 'slow' | 'rapid' }
  | { type: 'clear' }
  | { type: 'silent' };

export type Special = 'unsent' | 'interrupted' | 'recognition' | 'empty' | 'disappearance' | 'premature';
export interface Script { id: string; intent: string; steps: Step[] }
export interface VisitorMessage { text: string; normalized: string; at: number; intent: string }
export interface Memory {
  history: VisitorMessage[];
  interactions: number;
  hasResponded: boolean;
  lastInteraction: number;
  startedAt: number;
  narrative: Narrative;
  repeatedWords: Record<string, number>;
  recentPhrases: string[];
  name?: string;
  identityQuestions: number;
  silenceEvents: number;
}

export interface VisibleMessage {
  id: number;
  speaker: 'entity' | 'visitor';
  text: string;
  createdAt: number;
  fading: boolean;
}

export interface Snapshot {
  state: InteractionState;
  narrative: Narrative;
  cursorVisible: boolean;
  messages: VisibleMessage[];
  draft: string;
  pending: Script | null;
  announcement: string;
  memory: Memory;
  error: string | null;
  quiet: boolean;
}
