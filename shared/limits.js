// Limites et constantes du produit (modifiables).
// Source : Spécifications d'analyse (règles de gestion RG1 à RG8) et rapport de conception.

export const LIMITS = {
  // RG1 : code de salon
  CODE_LONGUEUR: 6,
  CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // sans 0, O, 1, I

  // RG2 : pseudonyme
  PSEUDO_MIN: 2,
  PSEUDO_MAX: 20,

  // RG3 : limites par salon
  MAX_PARTICIPANTS: 10,
  MAX_MESSAGES_GARDES: 50,
  MAX_PLAYLIST: 50,

  // Chat (CHAT-02)
  MESSAGE_MIN: 1,
  MESSAGE_MAX: 300,
  CADENCE_MAX_MESSAGES: 5,
  CADENCE_FENETRE_MS: 3000,

  // RG5 : reconnexion (IMP)
  GRACE_RECONNEXION_MS: 10000,

  // Synchronisation (rapport de conception, section 5)
  RECALAGE_PERIODE_MS: 5000,
  RECALAGE_ECART_S: 2,
  SURVEILLANCE_DEPLACEMENT_MS: 500,
  SAUT_MIN_S: 1.5,
  LECTURE_BLOQUEE_MS: 1500,
};
