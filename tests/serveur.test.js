// Tests d'intégration : plusieurs clients simulés sur un vrai serveur (rapport de conception, section 6).
// Création, arrivée en cours de lecture, diffusion, isolation de deux salons, salon vide fermé.
// Exigences : SAL-01 à SAL-05, VID-01, VID-02, VID-04. Module : Emilien.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connecter } from 'socket.io-client';
import { creerServeur } from '../server/index.js';
import { EVENTS } from '../shared/events.js';

const GRACE_MS = 150;
let serveur;
let adresse;
const clients = [];

before(async () => {
  serveur = creerServeur({ graceMs: GRACE_MS, maxParticipants: 3 });
  await new Promise((ok) => serveur.serveurHttp.listen(0, ok));
  adresse = `http://localhost:${serveur.serveurHttp.address().port}`;
});

after(async () => {
  for (const c of clients) c.disconnect();
  await new Promise((ok) => serveur.io.close(ok));
});

async function client() {
  const socket = connecter(adresse, { transports: ['websocket'], reconnection: false, forceNew: true });
  clients.push(socket);
  await new Promise((ok, ko) => {
    socket.once('connect', ok);
    socket.once('connect_error', ko);
  });
  return socket;
}

function attendre(socket, evenement, delaiMs = 2000) {
  return new Promise((ok, ko) => {
    const minuteur = setTimeout(() => ko(new Error(`${evenement} non reçu`)), delaiMs);
    socket.once(evenement, (donnees) => {
      clearTimeout(minuteur);
      ok(donnees);
    });
  });
}

// Vérifie qu'un événement n'arrive PAS pendant delaiMs.
function rienRecu(socket, evenement, delaiMs = 200) {
  return new Promise((ok, ko) => {
    const surEvenement = () => ko(new Error(`${evenement} reçu alors qu'il ne devait pas l'être`));
    socket.once(evenement, surEvenement);
    setTimeout(() => {
      socket.off(evenement, surEvenement);
      ok();
    }, delaiMs);
  });
}

async function creer(pseudo) {
  const socket = await client();
  const reponse = attendre(socket, EVENTS.SALON_CREE);
  socket.emit(EVENTS.SALON_CREER, { pseudo });
  return { socket, ...(await reponse) };
}

async function rejoindre(code, pseudo) {
  const socket = await client();
  const etat = attendre(socket, EVENTS.SALON_ETAT);
  socket.emit(EVENTS.SALON_REJOINDRE, { code, pseudo });
  return { socket, etat: await etat };
}

const URL_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

test('scénario 4.1 : créer un salon puis le rejoindre par le code', async () => {
  const alice = await creer('Alice');
  assert.match(alice.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.ok(alice.lien.endsWith(`/salon.html?code=${alice.code}`));
  assert.equal(alice.moi.estHote, true);
  assert.equal(alice.etat.video.videoId, null);

  const majAlice = attendre(alice.socket, EVENTS.PARTICIPANTS_MAJ);
  const bob = await rejoindre(alice.code, 'Bob');
  assert.equal(bob.etat.code, alice.code);
  assert.equal(bob.etat.moi.estHote, false);
  const { participants } = await majAlice;
  assert.deepEqual(participants.map((p) => p.pseudo), ['Alice', 'Bob']);
});

test('SAL-03 : les erreurs ne sont envoyées qu\'à l\'émetteur', async () => {
  const alice = await creer('Alice');
  const intrus = await client();

  const erreur1 = attendre(intrus, EVENTS.ERREUR);
  intrus.emit(EVENTS.SALON_REJOINDRE, { code: 'ZZZZZZ', pseudo: 'Bob' });
  assert.equal((await erreur1).code, 'SALON_INCONNU');

  const erreur2 = attendre(intrus, EVENTS.ERREUR);
  const silenceAlice = rienRecu(alice.socket, EVENTS.ERREUR);
  intrus.emit(EVENTS.SALON_REJOINDRE, { code: alice.code, pseudo: 'alice' });
  const recue = await erreur2;
  assert.equal(recue.code, 'PSEUDO_PRIS');
  assert.equal(typeof recue.message, 'string');
  await silenceAlice;

  const erreur3 = attendre(intrus, EVENTS.ERREUR);
  intrus.emit(EVENTS.VIDEO_ACTION, { action: 'lecture', position: 0 });
  assert.equal((await erreur3).code, 'NON_DANS_SALON');
});

test('SAL-03 : un salon plein refuse un participant de plus', async () => {
  const alice = await creer('Alice');
  await rejoindre(alice.code, 'Bob');
  await rejoindre(alice.code, 'Chloé');
  const david = await client();
  const erreur = attendre(david, EVENTS.ERREUR);
  david.emit(EVENTS.SALON_REJOINDRE, { code: alice.code, pseudo: 'David' });
  assert.equal((await erreur).code, 'SALON_PLEIN');
});

test('scénario 4.2 : charger une vidéo et la lire, tout le salon reçoit l\'état', async () => {
  const alice = await creer('Alice');
  const bob = await rejoindre(alice.code, 'Bob');

  const etatBob = attendre(bob.socket, EVENTS.VIDEO_ETAT);
  alice.socket.emit(EVENTS.VIDEO_CHARGER, { url: URL_VIDEO });
  assert.deepEqual(
    (({ videoId, statut, position }) => ({ videoId, statut, position }))(await etatBob),
    { videoId: 'dQw4w9WgXcQ', statut: 'pause', position: 0 },
  );

  const lectureAlice = attendre(alice.socket, EVENTS.VIDEO_ETAT);
  const lectureBob = attendre(bob.socket, EVENTS.VIDEO_ETAT);
  bob.socket.emit(EVENTS.VIDEO_ACTION, { action: 'lecture', position: 12 });
  for (const etat of await Promise.all([lectureAlice, lectureBob])) {
    assert.equal(etat.statut, 'lecture');
    assert.equal(etat.position, 12);
    assert.equal(typeof etat.majLe, 'number');
    assert.equal(typeof etat.heureServeur, 'number');
  }

  const erreur = attendre(alice.socket, EVENTS.ERREUR);
  alice.socket.emit(EVENTS.VIDEO_CHARGER, { url: 'https://exemple.com' });
  assert.equal((await erreur).code, 'URL_INVALIDE');
});

test('scénario 4.3 : un nouvel arrivant reçoit la vidéo en cours de lecture', async () => {
  const alice = await creer('Alice');
  const chargee = attendre(alice.socket, EVENTS.VIDEO_ETAT);
  alice.socket.emit(EVENTS.VIDEO_CHARGER, { url: URL_VIDEO });
  await chargee;
  const lecture = attendre(alice.socket, EVENTS.VIDEO_ETAT);
  alice.socket.emit(EVENTS.VIDEO_ACTION, { action: 'lecture', position: 30 });
  const reference = await lecture;

  const bob = await rejoindre(alice.code, 'Bob');
  assert.equal(bob.etat.video.videoId, 'dQw4w9WgXcQ');
  assert.equal(bob.etat.video.statut, 'lecture');
  assert.equal(bob.etat.video.majLe, reference.majLe);
  assert.ok(bob.etat.heureServeur >= reference.majLe);
});

test('VID-04 / RG7 : deux salons sont isolés', async () => {
  const alice = await creer('Alice');
  const bob = await creer('Bob');
  const silenceBob = rienRecu(bob.socket, EVENTS.VIDEO_ETAT, 300);
  const recuAlice = attendre(alice.socket, EVENTS.VIDEO_ETAT);
  alice.socket.emit(EVENTS.VIDEO_CHARGER, { url: URL_VIDEO });
  await recuAlice;
  await silenceBob;
  assert.notEqual(alice.code, bob.code);
});

test('SAL-05 / RG4 : l\'hôte part, Bob devient hôte ; le dernier part, le salon est fermé', async () => {
  const alice = await creer('Alice');
  const bob = await rejoindre(alice.code, 'Bob');

  const maj = attendre(bob.socket, EVENTS.PARTICIPANTS_MAJ, GRACE_MS + 1000);
  alice.socket.disconnect();
  const { participants } = await maj;
  assert.deepEqual(participants.map((p) => [p.pseudo, p.estHote]), [['Bob', true]]);

  bob.socket.disconnect();
  await new Promise((ok) => setTimeout(ok, GRACE_MS + 100));
  assert.equal(serveur.registre.obtenir(alice.code), undefined);
});

test('UC8 : un participant qui se reconnecte dans le délai retrouve sa place', async () => {
  const alice = await creer('Alice');
  const bob = await rejoindre(alice.code, 'Bob');
  alice.socket.disconnect();

  const retour = await rejoindre(alice.code, 'Alice');
  assert.equal(retour.etat.moi.estHote, true);
  assert.equal(bob.socket.connected, true);
  // Une fois le délai de grâce écoulé, Alice est toujours là.
  await new Promise((ok) => setTimeout(ok, GRACE_MS + 100));
  assert.deepEqual(
    serveur.registre.listeParticipants(serveur.registre.obtenir(alice.code)).map((p) => p.pseudo),
    ['Alice', 'Bob'],
  );
});

test('UC7 : avec le contrôle réservé, les actions des autres sont refusées', async () => {
  const alice = await creer('Alice');
  const bob = await rejoindre(alice.code, 'Bob');
  const chargee = attendre(bob.socket, EVENTS.VIDEO_ETAT);
  alice.socket.emit(EVENTS.VIDEO_CHARGER, { url: URL_VIDEO });
  await chargee;

  const refus = attendre(bob.socket, EVENTS.ERREUR);
  bob.socket.emit(EVENTS.SALON_REGLES, { controleHote: true });
  assert.equal((await refus).code, 'ACTION_REFUSEE');

  const regleBob = attendre(bob.socket, EVENTS.SALON_REGLES);
  alice.socket.emit(EVENTS.SALON_REGLES, { controleHote: true });
  assert.deepEqual(await regleBob, { controleHote: true });

  const refusAction = attendre(bob.socket, EVENTS.ERREUR);
  bob.socket.emit(EVENTS.VIDEO_ACTION, { action: 'lecture', position: 0 });
  assert.equal((await refusAction).code, 'ACTION_REFUSEE');

  // Un nouvel arrivant est informé de la règle en cours.
  const chloe = await client();
  const regleChloe = attendre(chloe, EVENTS.SALON_REGLES);
  chloe.emit(EVENTS.SALON_REJOINDRE, { code: alice.code, pseudo: 'Chloé' });
  assert.deepEqual(await regleChloe, { controleHote: true });
});

test('des données mal formées ne font pas tomber le serveur', async () => {
  const s = await client();
  const erreur = attendre(s, EVENTS.ERREUR);
  s.emit(EVENTS.SALON_CREER);
  assert.equal((await erreur).code, 'PSEUDO_INVALIDE');
  const erreur2 = attendre(s, EVENTS.ERREUR);
  s.emit(EVENTS.SALON_REJOINDRE, 'n\'importe quoi');
  assert.equal((await erreur2).code, 'SALON_INCONNU');
});
