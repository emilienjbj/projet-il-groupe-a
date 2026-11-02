// Contrat d'événements Socket.IO entre le client et le serveur.
// Source : Spécifications d'analyse, section 5. Tenu par Emilien, relu par tous.
// Toute modification est décidée en réunion d'équipe puis reportée dans l'analyse.

export const EVENTS = {
  SALON_CREER: 'salon:creer',             // C→S { pseudo }
  SALON_CREE: 'salon:cree',               // S→C { code, lien, moi, etat }
  SALON_REJOINDRE: 'salon:rejoindre',     // C→S { code, pseudo }
  SALON_ETAT: 'salon:etat',               // S→C état complet du salon
  PARTICIPANTS_MAJ: 'participants:maj',   // S→C { participants[] }
  VIDEO_CHARGER: 'video:charger',         // C→S { url }
  VIDEO_ACTION: 'video:action',           // C→S { action, position }
  VIDEO_ETAT: 'video:etat',               // S→C { videoId, statut, position, majLe, heureServeur }
  VIDEO_FIN: 'video:fin',                 // C→S { videoId }
  CHAT_ENVOYER: 'chat:envoyer',           // C→S { texte }
  CHAT_MESSAGE: 'chat:message',           // S→C { pseudo, texte, heure }
  PLAYLIST_AJOUTER: 'playlist:ajouter',   // C→S { url }
  PLAYLIST_SUIVANTE: 'playlist:suivante', // C→S {}
  PLAYLIST_SUPPRIMER: 'playlist:supprimer', // C→S { id } (IMP)
  PLAYLIST_MAJ: 'playlist:maj',           // S→C { playlist[] }
  SALON_REGLES: 'salon:regles',           // C↔S { controleHote } (IMP)
  ERREUR: 'erreur',                       // S→C { code, message }
};

export const ACTIONS_VIDEO = ['lecture', 'pause', 'deplacer'];

export const CODES_ERREUR = {
  PSEUDO_INVALIDE: 'PSEUDO_INVALIDE',
  PSEUDO_PRIS: 'PSEUDO_PRIS',
  SALON_INCONNU: 'SALON_INCONNU',
  SALON_PLEIN: 'SALON_PLEIN',
  URL_INVALIDE: 'URL_INVALIDE',
  MESSAGE_INVALIDE: 'MESSAGE_INVALIDE',
  TROP_RAPIDE: 'TROP_RAPIDE',
  ACTION_REFUSEE: 'ACTION_REFUSEE',
  NON_DANS_SALON: 'NON_DANS_SALON',
};
