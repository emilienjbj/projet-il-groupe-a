// Tests unitaires de la logique des salons (server/rooms.js), sans réseau.
// Exigences : SAL-01 à SAL-05, RG1 à RG5, UC7, UC8. Module : Emilien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerRegistreSalons, genererCode, ErreurSalon } from '../server/rooms.js';
import { LIMITS } from '../shared/limits.js';

// Horloge et minuteurs simulés : on avance le temps à la main.
function environnementSimule() {
  let heure = 1_000_000;
  const minuteurs = new Set();
  return {
    maintenant: () => heure,
    planifier: (fn, ms) => {
      const m = { fn, echeance: heure + ms };
      minuteurs.add(m);
      return m;
    },
    annuler: (m) => minuteurs.delete(m),
    avancer(ms) {
      heure += ms;
      for (const m of [...minuteurs]) {
        if (m.echeance <= heure) {
          minuteurs.delete(m);
          m.fn();
        }
      }
    },
  };
}

function nouveauRegistre(options = {}) {
  const env = environnementSimule();
  const registre = creerRegistreSalons({ ...env, ...options });
  return { env, registre };
}

function attendreErreur(fn, code) {
  assert.throws(fn, (e) => e instanceof ErreurSalon && e.code === code);
}

test('RG1 : code de 6 caractères, sans 0, O, 1, I, unique parmi les salons', () => {
  const codes = new Set();
  for (let i = 0; i < 300; i += 1) {
    const code = genererCode((c) => codes.has(c));
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(codes.has(code), false);
    codes.add(code);
  }
  // Un tirage qui retombe sur un code existant est refait.
  const tirages = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  const code = genererCode((c) => c === 'AAAAAA', () => tirages.shift());
  assert.equal(code, 'BBBBBB');
});

test('SAL-01 : créer un salon rend le créateur hôte', () => {
  const { registre } = nouveauRegistre();
  const { salon, participant } = registre.creerSalon('s1', '  Alice  ');
  assert.equal(participant.pseudo, 'Alice');
  assert.equal(salon.hoteId, 's1');
  assert.equal(registre.obtenir(salon.code), salon);
  const etat = registre.etatComplet(salon, participant);
  assert.equal(etat.moi.estHote, true);
  assert.deepEqual(etat.playlist, []);
  assert.deepEqual(etat.messages, []);
  assert.equal(etat.video.videoId, null);
});

test('SAL-01 / RG2 : un pseudonyme invalide ne crée aucun salon', () => {
  const { registre } = nouveauRegistre();
  for (const pseudo of ['', ' a ', 'x'.repeat(LIMITS.PSEUDO_MAX + 1), undefined, 42]) {
    attendreErreur(() => registre.creerSalon('s1', pseudo), 'PSEUDO_INVALIDE');
  }
  assert.equal(registre.nombreSalons(), 0);
});

test('SAL-01 : la validation de pseudonyme passée en option est utilisée', () => {
  const { registre } = nouveauRegistre({
    validerPseudo: (t) => (t === 'ok' ? { ok: true, pseudo: 'OK' } : { ok: false, message: 'Refusé' }),
  });
  assert.equal(registre.creerSalon('s1', 'ok').participant.pseudo, 'OK');
  assert.throws(() => registre.creerSalon('s2', 'Alice'), { code: 'PSEUDO_INVALIDE', message: 'Refusé' });
});

test('SAL-02 : rejoindre par le code, même en minuscules', () => {
  const { registre, env } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  env.avancer(10);
  const { participant, reconnexion } = registre.rejoindreSalon('s2', ` ${salon.code.toLowerCase()} `, 'Bob');
  assert.equal(reconnexion, false);
  assert.equal(participant.pseudo, 'Bob');
  assert.deepEqual(registre.listeParticipants(salon).map((p) => [p.pseudo, p.estHote]), [
    ['Alice', true],
    ['Bob', false],
  ]);
});

test('SAL-03 : code inconnu, pseudonyme pris ou invalide, salon plein', () => {
  const { registre } = nouveauRegistre({ maxParticipants: 2 });
  const { salon } = registre.creerSalon('s1', 'Alice');
  attendreErreur(() => registre.rejoindreSalon('s2', 'ZZZZZZ', 'Bob'), 'SALON_INCONNU');
  attendreErreur(() => registre.rejoindreSalon('s2', undefined, 'Bob'), 'SALON_INCONNU');
  attendreErreur(() => registre.rejoindreSalon('s2', salon.code, 'ALICE'), 'PSEUDO_PRIS');
  attendreErreur(() => registre.rejoindreSalon('s2', salon.code, 'B'), 'PSEUDO_INVALIDE');
  registre.rejoindreSalon('s2', salon.code, 'Bob');
  attendreErreur(() => registre.rejoindreSalon('s3', salon.code, 'Chloé'), 'SALON_PLEIN');
  assert.equal(salon.participants.size, 2);
});

test('un participant ne peut pas être dans deux salons à la fois', () => {
  const { registre } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  attendreErreur(() => registre.creerSalon('s1', 'Alice'), 'ACTION_REFUSEE');
  attendreErreur(() => registre.rejoindreSalon('s1', salon.code, 'Alice2'), 'ACTION_REFUSEE');
});

test('les actions hors salon sont refusées (NON_DANS_SALON)', () => {
  const { registre } = nouveauRegistre();
  attendreErreur(() => registre.chargerVideoDuSalon('x', 'https://youtu.be/dQw4w9WgXcQ'), 'NON_DANS_SALON');
  attendreErreur(() => registre.actionLecture('x', { action: 'lecture', position: 0 }), 'NON_DANS_SALON');
  attendreErreur(() => registre.definirControleHote('x', true), 'NON_DANS_SALON');
  attendreErreur(() => registre.finVideo('x', 'dQw4w9WgXcQ'), 'NON_DANS_SALON');
});

test('SAL-04 : le nouvel arrivant reçoit la vidéo, la position et le statut en cours', () => {
  const { registre, env } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  registre.chargerVideoDuSalon('s1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  registre.actionLecture('s1', { action: 'lecture', position: 30 });
  const majLe = env.maintenant();
  env.avancer(5000);
  const { participant } = registre.rejoindreSalon('s2', salon.code, 'Bob');
  const etat = registre.etatComplet(salon, participant);
  assert.deepEqual(etat.video, {
    videoId: 'dQw4w9WgXcQ', statut: 'lecture', position: 30, majLe, heureServeur: majLe + 5000,
  });
  assert.equal(etat.heureServeur, majLe + 5000);
  assert.equal(etat.moi.pseudo, 'Bob');
  assert.equal(etat.participants.length, 2);
});

test('SAL-05 / RG5 : la place est gardée 10 s puis le salon vide est supprimé', () => {
  const { registre, env } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  const retraits = [];
  registre.deconnecter('s1', (s, r) => retraits.push(r));
  env.avancer(LIMITS.GRACE_RECONNEXION_MS - 1);
  assert.equal(registre.obtenir(salon.code), salon);
  env.avancer(1);
  assert.equal(registre.obtenir(salon.code), undefined);
  assert.deepEqual(retraits, [{ salonSupprime: true, nouvelHote: null }]);
  attendreErreur(() => registre.rejoindreSalon('s2', salon.code, 'Bob'), 'SALON_INCONNU');
});

test('RG4 : si l\'hôte part, le participant arrivé le plus tôt devient hôte', () => {
  const { registre, env } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  env.avancer(10);
  registre.rejoindreSalon('s2', salon.code, 'Bob');
  env.avancer(10);
  registre.rejoindreSalon('s3', salon.code, 'Chloé');
  const retraits = [];
  registre.deconnecter('s1', (s, r) => retraits.push(r));
  env.avancer(LIMITS.GRACE_RECONNEXION_MS);
  assert.deepEqual(retraits, [{ salonSupprime: false, nouvelHote: 's2' }]);
  assert.deepEqual(registre.listeParticipants(salon).map((p) => [p.pseudo, p.estHote]), [
    ['Bob', true],
    ['Chloé', false],
  ]);
});

test('UC8 : reconnexion dans le délai avec le même pseudonyme, l\'hôte garde son rôle', () => {
  const { registre, env } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  env.avancer(10);
  registre.rejoindreSalon('s2', salon.code, 'Bob');
  const retraits = [];
  registre.deconnecter('s1', (s, r) => retraits.push(r));
  env.avancer(4000);
  const { participant, reconnexion } = registre.rejoindreSalon('s1-bis', salon.code, 'alice');
  assert.equal(reconnexion, true);
  assert.equal(participant.pseudo, 'Alice');
  assert.equal(salon.hoteId, 's1-bis');
  env.avancer(LIMITS.GRACE_RECONNEXION_MS);
  assert.deepEqual(retraits, []);
  assert.equal(salon.participants.size, 2);
  assert.equal(registre.salonDe('s1-bis'), salon);
  assert.equal(registre.salonDe('s1'), undefined);
});

test('UC7 : seul l\'hôte réserve le contrôle ; ensuite seules ses actions passent', () => {
  const { registre } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  registre.rejoindreSalon('s2', salon.code, 'Bob');
  registre.chargerVideoDuSalon('s1', 'https://youtu.be/dQw4w9WgXcQ');
  attendreErreur(() => registre.definirControleHote('s2', true), 'ACTION_REFUSEE');
  attendreErreur(() => registre.definirControleHote('s1', 'oui'), 'ACTION_REFUSEE');

  registre.definirControleHote('s1', true);
  attendreErreur(() => registre.actionLecture('s2', { action: 'lecture', position: 0 }), 'ACTION_REFUSEE');
  registre.actionLecture('s1', { action: 'lecture', position: 0 });
  assert.equal(salon.lecture.statut, 'lecture');

  registre.definirControleHote('s1', false);
  registre.actionLecture('s2', { action: 'pause', position: 2 });
  assert.equal(salon.lecture.statut, 'pause');
});

test('VID-01 : une URL non reconnue est refusée, l\'état reste inchangé', () => {
  const { registre } = nouveauRegistre();
  const { salon } = registre.creerSalon('s1', 'Alice');
  attendreErreur(() => registre.chargerVideoDuSalon('s1', 'https://exemple.com/video'), 'URL_INVALIDE');
  assert.equal(salon.lecture.videoId, null);
});
