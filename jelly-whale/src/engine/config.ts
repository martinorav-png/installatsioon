export const CONFIG = {
  cursorDelay: 1500,
  openingDelay: [8000, 12000] as const,
  responseDelay: [1700, 3600] as const,
  typingDelay: [70, 140] as const,
  punctuationPause: [350, 800] as const,
  thoughtPause: [650, 1600] as const,
  deletionDelay: { slow: 105, rapid: 32 },
  silenceThresholds: [15, 30, 60, 90, 120, 180] as const,
  fadeAfter: 42000,
  fadeDuration: 2800,
  maxVisibleMessages: 3,
  maxInputLength: 4000,
  prematureAfter: 9000,
  probabilities: {
    midSentencePause: 0.025,
    correction: 0.012,
    unsent: 0.045,
    interrupted: 0.035,
    recognition: 0.12,
    empty: 0.035,
    disappearance: 0.035,
    premature: 0.025,
    sharedDeletion: 0.025,
    earlySilence: 0.15,
  },
};

export const between = (range: readonly [number, number], random = Math.random) =>
  range[0] + (range[1] - range[0]) * random();
