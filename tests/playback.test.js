// Tests unitaires de server/playback.js (VID-01, VID-02, PLAY-03, RG6). Module : Emilien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerEtatLecture,
  positionCourante,
  chargerVideo,
  appliquerAction,
  signalerFin,
  versMessageEtat,
} from '../server/playback.js';

const ID = 'dQw4w9WgXcQ';

test('un salon commence sans vidéo, en pause à 0 s', () => {
  const etat = creerEtatLecture(1000);
  assert.deepEqual(etat, { videoId: null, statut: 'pause', position: 0, majLe: 1000, finSignalee: false });
});

test('RG6 : la position avance seulement pendant la lecture', () => {
  const etat = { videoId: ID, statut: 'lecture', position: 10, majLe: 5000, finSignalee: false };
  assert.equal(positionCourante(etat, 8000), 13);
  etat.statut = 'pause';
  assert.equal(positionCourante(etat, 8000), 10);
});

test('VID-01 : une vidéo chargée devient active, en pause à 0 s', () => {
  const etat = { videoId: 'aaaaaaaaaaa', statut: 'lecture', position: 42, majLe: 0, finSignalee: true };
  chargerVideo(etat, ID, 2000);
  assert.deepEqual(etat, { videoId: ID, statut: 'pause', position: 0, majLe: 2000, finSignalee: false });
});

test('VID-02 : lecture, pause et déplacement mettent à jour statut, position et majLe', () => {
  const etat = chargerVideo(creerEtatLecture(0), ID, 0);
  assert.deepEqual(appliquerAction(etat, { action: 'lecture', position: 0 }, 1000), { ok: true });
  assert.equal(etat.statut, 'lecture');
  assert.equal(etat.majLe, 1000);

  assert.deepEqual(appliquerAction(etat, { action: 'pause', position: 4.5 }, 5500), { ok: true });
  assert.equal(etat.statut, 'pause');
  assert.equal(etat.position, 4.5);

  assert.deepEqual(appliquerAction(etat, { action: 'deplacer', position: 60 }, 6000), { ok: true });
  assert.equal(etat.statut, 'pause');
  assert.equal(etat.position, 60);
});

test('VID-02 : sans position, lecture et pause gardent la position calculée par le serveur', () => {
  const etat = chargerVideo(creerEtatLecture(0), ID, 0);
  appliquerAction(etat, { action: 'lecture', position: 10 }, 0);
  appliquerAction(etat, { action: 'pause' }, 3000);
  assert.equal(etat.position, 13);
});

test('VID-02 : les actions invalides sont refusées sans modifier l\'état', () => {
  const vide = creerEtatLecture(0);
  assert.equal(appliquerAction(vide, { action: 'lecture', position: 0 }, 0).ok, false);

  const etat = chargerVideo(creerEtatLecture(0), ID, 0);
  const avant = { ...etat };
  for (const donnees of [
    { action: 'avance-rapide', position: 1 },
    { action: 'deplacer' },
    { action: 'deplacer', position: -3 },
    { action: 'lecture', position: 'abc' },
    { action: 'lecture', position: Number.NaN },
    undefined,
  ]) {
    const resultat = appliquerAction(etat, donnees, 9999);
    assert.equal(resultat.ok, false);
    assert.equal(typeof resultat.raison, 'string');
  }
  assert.deepEqual(etat, avant);
});

test('PLAY-03 : seul le premier signalement de fin compte pour la vidéo active', () => {
  const etat = chargerVideo(creerEtatLecture(0), ID, 0);
  assert.equal(signalerFin(etat, 'autrevideo1'), false);
  assert.equal(signalerFin(etat, ID), true);
  assert.equal(signalerFin(etat, ID), false);
  chargerVideo(etat, 'autrevideo1', 10);
  assert.equal(signalerFin(etat, 'autrevideo1'), true);
});

test('video:etat contient videoId, statut, position, majLe et heureServeur', () => {
  const etat = chargerVideo(creerEtatLecture(0), ID, 100);
  assert.deepEqual(versMessageEtat(etat, 250), {
    videoId: ID, statut: 'pause', position: 0, majLe: 100, heureServeur: 250,
  });
});
