// État de lecture d'un salon : vidéo, statut, position horodatée, position courante (RG6).
// Exigences : VID-01 (charger une vidéo), VID-02 (lecture, pause, déplacement), PLAY-03 (fin de vidéo).
// Module : Emilien. Relecteur : Youness.
//
// Ce module ne connaît pas Socket.IO : il reçoit des données et renvoie un résultat,
// ce qui permet de le tester sans réseau (rapport de conception, section 3).
// Les heures sont en millisecondes (Date.now() du serveur), les positions en secondes.

import { ACTIONS_VIDEO } from '../shared/events.js';

export const STATUTS = { LECTURE: 'lecture', PAUSE: 'pause' };

// EtatLecture du modèle de données (analyse, section 4).
// finSignalee : vrai dès qu'un participant a signalé la fin de la vidéo active.
export function creerEtatLecture(maintenant = Date.now()) {
  return {
    videoId: null,
    statut: STATUTS.PAUSE,
    position: 0,
    majLe: maintenant,
    finSignalee: false,
  };
}

// RG6 : position courante = position + (heure du serveur - majLe) si lecture, sinon position.
export function positionCourante(etat, maintenant = Date.now()) {
  if (etat.statut !== STATUTS.LECTURE) return etat.position;
  return etat.position + Math.max(0, maintenant - etat.majLe) / 1000;
}

// VID-01 : la vidéo chargée devient active, en pause à 0 s.
// videoId doit déjà être validé (extraireIdVideo, RG8).
export function chargerVideo(etat, videoId, maintenant = Date.now()) {
  etat.videoId = videoId;
  etat.statut = STATUTS.PAUSE;
  etat.position = 0;
  etat.majLe = maintenant;
  etat.finSignalee = false;
  return etat;
}

function positionValide(valeur) {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0;
}

// VID-02 : applique une action de lecture. Renvoie { ok: true } ou { ok: false, raison }.
// - lecture et pause : la position envoyée par le client est retenue ; sans position,
//   on garde la position courante calculée par le serveur.
// - deplacer : la position est obligatoire, le statut ne change pas.
export function appliquerAction(etat, donnees, maintenant = Date.now()) {
  const { action, position } = donnees ?? {};
  if (!ACTIONS_VIDEO.includes(action)) {
    return { ok: false, raison: 'Action de lecture inconnue.' };
  }
  if (etat.videoId === null) {
    return { ok: false, raison: 'Aucune vidéo n\'est chargée dans ce salon.' };
  }
  if (position !== undefined && !positionValide(position)) {
    return { ok: false, raison: 'Position de lecture invalide.' };
  }
  if (action === 'deplacer' && position === undefined) {
    return { ok: false, raison: 'Position de lecture manquante.' };
  }

  const nouvellePosition = position ?? positionCourante(etat, maintenant);
  if (action === 'lecture') etat.statut = STATUTS.LECTURE;
  if (action === 'pause') etat.statut = STATUTS.PAUSE;
  etat.position = nouvellePosition;
  etat.majLe = maintenant;
  return { ok: true };
}

// PLAY-03 : chaque client signale la fin de la vidéo ; seul le premier signalement
// pour la vidéo active compte (rapport de conception, section 5). Renvoie vrai une seule fois.
export function signalerFin(etat, videoId) {
  if (etat.videoId === null || videoId !== etat.videoId || etat.finSignalee) return false;
  etat.finSignalee = true;
  return true;
}

// Données de l'événement video:etat { videoId, statut, position, majLe, heureServeur }.
// Le client applique lui-même RG6 avec heureServeur corrigée de son décalage d'horloge.
export function versMessageEtat(etat, maintenant = Date.now()) {
  return {
    videoId: etat.videoId,
    statut: etat.statut,
    position: etat.position,
    majLe: etat.majLe,
    heureServeur: maintenant,
  };
}
