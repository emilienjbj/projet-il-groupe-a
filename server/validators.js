// server/validators.js
import { LIMITS } from '../shared/limits.js';

/**
 * Valide le pseudonyme d'un utilisateur (RG2 : 2 à 20 caractères).
 * @param {string} texte 
 * @returns {{ ok: boolean, pseudo?: string, message?: string }}
 */
export function validerPseudo(texte) {
  if (typeof texte !== 'string') {
    return { ok: false, message: 'Le pseudo doit être une chaîne de caractères.' };
  }

  const pseudo = texte.trim();

  if (pseudo.length < 2 || pseudo.length > 20) {
    return { ok: false, message: 'Le pseudo doit contenir entre 2 et 20 caractères.' };
  }

  return { ok: true, pseudo };
}

/**
 * Valide un message de chat (1 à 300 caractères).
 * @param {string} texte 
 * @returns {{ ok: boolean, messageValide?: string, messageErreur?: string }}
 */
export function validerMessage(texte) {
  if (typeof texte !== 'string') {
    return { ok: false, messageErreur: 'Le message doit être une chaîne de caractères.' };
  }

  const messageValide = texte.trim();

  if (messageValide.length < 1 || messageValide.length > 300) {
    return { ok: false, messageErreur: 'Le message doit contenir entre 1 et 300 caractères.' };
  }

  return { ok: true, messageValide };
}