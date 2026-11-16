// Salons : création, entrée, départ, hôte, reconnexion, isolation par salon.
// Exigences : SAL-01 à SAL-05, VID-04 ; IMP : rôle d'hôte (RG4, UC7), reconnexion (RG5, UC8).
// Module : Emilien. Relecteur : Youness.
//
// Deux parties :
// 1. creerRegistreSalons() : la logique des salons, sans Socket.IO (testable sans réseau).
// 2. brancherSalons(io, registre) : reçoit les événements Socket.IO de shared/events.js,
//    applique la logique et renvoie les réponses, en ne diffusant que dans la room du salon (RG7).

import { randomInt } from 'node:crypto';
import { LIMITS } from '../shared/limits.js';
import { EVENTS, CODES_ERREUR } from '../shared/events.js';
import { extraireIdVideo } from '../shared/youtube.js';
import {
  creerEtatLecture,
  chargerVideo,
  appliquerAction,
  signalerFin,
  versMessageEtat,
} from './playback.js';

// Erreur métier : son code fait partie de CODES_ERREUR, son message est affiché à l'utilisateur.
export class ErreurSalon extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// RG1 : 6 caractères tirés de l'alphabet sans 0, O, 1, I, uniques parmi les salons existants.
export function genererCode(existeDeja, tirer = randomInt) {
  const { CODE_ALPHABET, CODE_LONGUEUR } = LIMITS;
  for (let essai = 0; essai < 1000; essai += 1) {
    let code = '';
    for (let i = 0; i < CODE_LONGUEUR; i += 1) code += CODE_ALPHABET[tirer(CODE_ALPHABET.length)];
    if (!existeDeja(code)) return code;
  }
  throw new Error('Impossible de générer un code de salon unique.');
}

// Validation provisoire du format du pseudonyme (RG2 : 2 à 20 caractères sans les espaces autour).
// La validation officielle est écrite par Hatim dans server/validators.js et est passée à
// creerRegistreSalons({ validerPseudo }) par server/index.js dès qu'elle existe.
// Contrat attendu : validerPseudo(texte) -> { ok: true, pseudo } ou { ok: false, message }.
export function validationPseudoProvisoire(texte) {
  if (typeof texte !== 'string') return { ok: false, message: 'Pseudonyme manquant.' };
  const pseudo = texte.trim();
  if (pseudo.length < LIMITS.PSEUDO_MIN || pseudo.length > LIMITS.PSEUDO_MAX) {
    return {
      ok: false,
      message: `Le pseudonyme doit compter de ${LIMITS.PSEUDO_MIN} à ${LIMITS.PSEUDO_MAX} caractères.`,
    };
  }
  return { ok: true, pseudo };
}

function cleDePseudo(pseudo) {
  return pseudo.toLocaleLowerCase('fr');
}

// Registre en mémoire : une Map<code, Salon> (rapport de conception, section 4 « Stockage »).
export function creerRegistreSalons({
  maintenant = () => Date.now(),
  validerPseudo = validationPseudoProvisoire,
  graceMs = LIMITS.GRACE_RECONNEXION_MS,
  maxParticipants = LIMITS.MAX_PARTICIPANTS,
  planifier = setTimeout,
  annuler = clearTimeout,
} = {}) {
  const salons = new Map(); // code -> Salon
  const salonParSocket = new Map(); // id de socket -> code du salon

  function verifierPseudo(texte) {
    const resultat = validerPseudo(texte);
    if (!resultat || !resultat.ok) {
      throw new ErreurSalon(
        CODES_ERREUR.PSEUDO_INVALIDE,
        resultat?.message ?? 'Pseudonyme invalide.',
      );
    }
    return resultat.pseudo;
  }

  // Participant du modèle de données : id (socket), pseudo, estHote, connecteLe.
  function versParticipantPublic(salon, participant) {
    return {
      id: participant.id,
      pseudo: participant.pseudo,
      estHote: participant.id === salon.hoteId,
      connecteLe: participant.connecteLe,
    };
  }

  function listeParticipants(salon) {
    return [...salon.participants.values()]
      .sort((a, b) => a.connecteLe - b.connecteLe)
      .map((p) => versParticipantPublic(salon, p));
  }

  // Contenu de salon:etat (SAL-04) : tout ce qu'il faut à un nouvel arrivant en un seul message.
  function etatComplet(salon, participant) {
    const heure = maintenant();
    return {
      code: salon.code,
      moi: versParticipantPublic(salon, participant),
      participants: listeParticipants(salon),
      video: versMessageEtat(salon.lecture, heure),
      playlist: salon.playlist,
      messages: salon.messages,
      heureServeur: heure,
    };
  }

  function salonDe(idSocket) {
    const code = salonParSocket.get(idSocket);
    return code ? salons.get(code) : undefined;
  }

  function participantDe(idSocket) {
    const salon = salonDe(idSocket);
    if (!salon) {
      throw new ErreurSalon(CODES_ERREUR.NON_DANS_SALON, 'Vous n\'êtes dans aucun salon.');
    }
    return { salon, participant: salon.participants.get(idSocket) };
  }

  function verifierPasDejaDansUnSalon(idSocket) {
    if (salonParSocket.has(idSocket)) {
      throw new ErreurSalon(CODES_ERREUR.ACTION_REFUSEE, 'Vous êtes déjà dans un salon.');
    }
  }

  // SAL-01 / UC1 : le créateur devient hôte (RG4).
  function creerSalon(idSocket, pseudoBrut) {
    verifierPasDejaDansUnSalon(idSocket);
    const pseudo = verifierPseudo(pseudoBrut);
    const heure = maintenant();
    const code = genererCode((c) => salons.has(c));
    const participant = { id: idSocket, pseudo, connecteLe: heure, connecte: true, minuteur: null };
    const salon = {
      code,
      hoteId: idSocket,
      controleHote: false,
      creeLe: heure,
      participants: new Map([[idSocket, participant]]),
      lecture: creerEtatLecture(heure),
      playlist: [], // file tenue par server/playlist.js (Hatim)
      messages: [], // derniers messages tenus par server/chat.js (Hatim)
    };
    salons.set(code, salon);
    salonParSocket.set(idSocket, code);
    return { salon, participant };
  }

  // SAL-02, SAL-03 / UC2 ; UC8 si le pseudonyme est celui d'un participant en attente de reconnexion.
  function rejoindreSalon(idSocket, codeBrut, pseudoBrut) {
    verifierPasDejaDansUnSalon(idSocket);
    const code = typeof codeBrut === 'string' ? codeBrut.trim().toUpperCase() : '';
    const salon = salons.get(code);
    if (!salon) {
      throw new ErreurSalon(CODES_ERREUR.SALON_INCONNU, 'Ce salon n\'existe pas ou a été fermé.');
    }
    const pseudo = verifierPseudo(pseudoBrut);
    const existant = [...salon.participants.values()].find(
      (p) => cleDePseudo(p.pseudo) === cleDePseudo(pseudo),
    );

    if (existant && !existant.connecte) {
      // Reconnexion dans le délai de grâce : on rend sa place au participant (RG5).
      annuler(existant.minuteur);
      salon.participants.delete(existant.id);
      if (salon.hoteId === existant.id) salon.hoteId = idSocket;
      existant.id = idSocket;
      existant.connecte = true;
      existant.minuteur = null;
      salon.participants.set(idSocket, existant);
      salonParSocket.set(idSocket, code);
      return { salon, participant: existant, reconnexion: true };
    }
    if (existant) {
      throw new ErreurSalon(CODES_ERREUR.PSEUDO_PRIS, 'Ce pseudonyme est déjà utilisé dans ce salon.');
    }
    if (salon.participants.size >= maxParticipants) {
      throw new ErreurSalon(CODES_ERREUR.SALON_PLEIN, `Ce salon est plein (${maxParticipants} participants au maximum).`);
    }

    const participant = { id: idSocket, pseudo, connecteLe: maintenant(), connecte: true, minuteur: null };
    salon.participants.set(idSocket, participant);
    salonParSocket.set(idSocket, code);
    return { salon, participant, reconnexion: false };
  }

  // SAL-05 / RG4 / RG5 : retire un participant ; transmet le rôle d'hôte au plus ancien ;
  // supprime le salon (et donc sa playlist et ses messages) quand il est vide.
  function retirer(salon, idParticipant) {
    const participant = salon.participants.get(idParticipant);
    if (!participant) return { salonSupprime: false, nouvelHote: null };
    annuler(participant.minuteur);
    salon.participants.delete(idParticipant);
    salonParSocket.delete(idParticipant);

    if (salon.participants.size === 0) {
      salons.delete(salon.code);
      return { salonSupprime: true, nouvelHote: null };
    }
    let nouvelHote = null;
    if (salon.hoteId === idParticipant) {
      const plusAncien = [...salon.participants.values()].sort((a, b) => a.connecteLe - b.connecteLe)[0];
      salon.hoteId = plusAncien.id;
      nouvelHote = plusAncien.id;
    }
    return { salonSupprime: false, nouvelHote };
  }

  // Coupure de connexion : la place est gardée graceMs (10 s), puis le participant est retiré.
  // surRetrait(salon, resultat) est appelé au retrait effectif, pour prévenir les autres.
  function deconnecter(idSocket, surRetrait = () => {}) {
    const salon = salonDe(idSocket);
    if (!salon) return false;
    const participant = salon.participants.get(idSocket);
    salonParSocket.delete(idSocket);
    participant.connecte = false;
    participant.minuteur = planifier(() => {
      // Le participant a pu se reconnecter sous un autre id entre-temps.
      if (participant.connecte || salons.get(salon.code) !== salon) return;
      const resultat = retirer(salon, participant.id);
      surRetrait(salon, resultat);
    }, graceMs);
    return true;
  }

  // UC7 (IMP) : seul l'hôte peut réserver le contrôle de la lecture.
  function definirControleHote(idSocket, valeur) {
    const { salon } = participantDe(idSocket);
    if (salon.hoteId !== idSocket) {
      throw new ErreurSalon(CODES_ERREUR.ACTION_REFUSEE, 'Seul l\'hôte peut modifier cette règle.');
    }
    if (typeof valeur !== 'boolean') {
      throw new ErreurSalon(CODES_ERREUR.ACTION_REFUSEE, 'Valeur de règle invalide.');
    }
    salon.controleHote = valeur;
    return salon;
  }

  function verifierDroitLecture(salon, idSocket) {
    if (salon.controleHote && salon.hoteId !== idSocket) {
      throw new ErreurSalon(CODES_ERREUR.ACTION_REFUSEE, 'Le contrôle de la lecture est réservé à l\'hôte.');
    }
  }

  // VID-01 / RG8 : seul l'identifiant de 11 caractères est retenu.
  function chargerVideoDuSalon(idSocket, url) {
    const { salon } = participantDe(idSocket);
    const videoId = extraireIdVideo(url);
    if (!videoId) {
      throw new ErreurSalon(CODES_ERREUR.URL_INVALIDE, 'Lien YouTube non reconnu.');
    }
    chargerVideo(salon.lecture, videoId, maintenant());
    return salon;
  }

  // VID-02 : lecture, pause, déplacement.
  function actionLecture(idSocket, donnees) {
    const { salon } = participantDe(idSocket);
    verifierDroitLecture(salon, idSocket);
    const resultat = appliquerAction(salon.lecture, donnees, maintenant());
    if (!resultat.ok) throw new ErreurSalon(CODES_ERREUR.ACTION_REFUSEE, resultat.raison);
    return salon;
  }

  // PLAY-03 : renvoie le salon si ce signalement est le premier pour la vidéo active, sinon null.
  function finVideo(idSocket, videoId) {
    const { salon } = participantDe(idSocket);
    return signalerFin(salon.lecture, videoId) ? salon : null;
  }

  return {
    creerSalon,
    rejoindreSalon,
    deconnecter,
    retirer,
    definirControleHote,
    chargerVideoDuSalon,
    actionLecture,
    finVideo,
    etatComplet,
    listeParticipants,
    salonDe,
    obtenir: (code) => salons.get(code),
    nombreSalons: () => salons.size,
  };
}

// Lien de partage (SAL-01) construit à partir de l'adresse utilisée par le créateur.
function construireLien(socket, code) {
  const { origin, host } = socket.handshake.headers;
  const base = origin ?? (host ? `http://${host}` : '');
  return `${base}/salon.html?code=${code}`;
}

// Réception des événements Socket.IO (rapport de conception, section 3).
// Toute erreur est renvoyée à l'émetteur seul et n'interrompt jamais le salon.
// surFinVideo(salon) : appelé au premier video:fin ; le passage à la vidéo suivante
// (server/playlist.js, Hatim) y sera branché à l'intégration.
export function brancherSalons(io, registre, { surFinVideo = () => {} } = {}) {
  function diffuserParticipants(salon) {
    io.to(salon.code).emit(EVENTS.PARTICIPANTS_MAJ, { participants: registre.listeParticipants(salon) });
  }

  function diffuserVideo(salon) {
    io.to(salon.code).emit(EVENTS.VIDEO_ETAT, versMessageEtat(salon.lecture));
  }

  io.on('connection', (socket) => {
    function surEvenement(nom, traitement) {
      socket.on(nom, (donnees) => {
        try {
          traitement(donnees ?? {});
        } catch (erreur) {
          if (erreur instanceof ErreurSalon) {
            socket.emit(EVENTS.ERREUR, { code: erreur.code, message: erreur.message });
          } else {
            console.error(`Erreur inattendue sur ${nom} :`, erreur);
            socket.emit(EVENTS.ERREUR, {
              code: CODES_ERREUR.ACTION_REFUSEE,
              message: 'Erreur interne du serveur, réessayez.',
            });
          }
        }
      });
    }

    // SAL-01
    surEvenement(EVENTS.SALON_CREER, ({ pseudo }) => {
      const { salon, participant } = registre.creerSalon(socket.id, pseudo);
      socket.join(salon.code);
      socket.emit(EVENTS.SALON_CREE, {
        code: salon.code,
        lien: construireLien(socket, salon.code),
        moi: registre.etatComplet(salon, participant).moi,
        etat: registre.etatComplet(salon, participant),
      });
    });

    // SAL-02, SAL-03, SAL-04 ; UC8 (reconnexion)
    surEvenement(EVENTS.SALON_REJOINDRE, ({ code, pseudo }) => {
      const { salon, participant } = registre.rejoindreSalon(socket.id, code, pseudo);
      socket.join(salon.code);
      socket.emit(EVENTS.SALON_ETAT, registre.etatComplet(salon, participant));
      if (salon.controleHote) socket.emit(EVENTS.SALON_REGLES, { controleHote: true });
      diffuserParticipants(salon);
    });

    // VID-01
    surEvenement(EVENTS.VIDEO_CHARGER, ({ url }) => {
      diffuserVideo(registre.chargerVideoDuSalon(socket.id, url));
    });

    // VID-02
    surEvenement(EVENTS.VIDEO_ACTION, (donnees) => {
      diffuserVideo(registre.actionLecture(socket.id, donnees));
    });

    // PLAY-03 : seul le premier signalement compte.
    surEvenement(EVENTS.VIDEO_FIN, ({ videoId }) => {
      const salon = registre.finVideo(socket.id, videoId);
      if (salon) surFinVideo(salon);
    });

    // UC7 (IMP) : contrôle réservé à l'hôte, diffusé à tout le salon.
    surEvenement(EVENTS.SALON_REGLES, ({ controleHote }) => {
      const salon = registre.definirControleHote(socket.id, controleHote);
      io.to(salon.code).emit(EVENTS.SALON_REGLES, { controleHote: salon.controleHote });
    });

    // Les événements chat:* et playlist:* sont reçus par server/chat.js et server/playlist.js
    // (Hatim) ; ils seront branchés ici à l'intégration, sur le même modèle.

    // SAL-05 / RG5 : place gardée 10 s, puis départ effectif et liste mise à jour.
    socket.on('disconnect', () => {
      registre.deconnecter(socket.id, (salon, { salonSupprime }) => {
        if (!salonSupprime) diffuserParticipants(salon);
      });
    });
  });
}
