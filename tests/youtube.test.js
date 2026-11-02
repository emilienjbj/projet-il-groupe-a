import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraireIdVideo } from '../shared/youtube.js';

const ID = 'dQw4w9WgXcQ';

test('accepte les formats d\'URL YouTube courants (RG8)', () => {
  assert.equal(extraireIdVideo(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(extraireIdVideo(`https://youtu.be/${ID}`), ID);
  assert.equal(extraireIdVideo(`https://www.youtube.com/embed/${ID}`), ID);
  assert.equal(extraireIdVideo(`https://www.youtube.com/shorts/${ID}`), ID);
  assert.equal(extraireIdVideo(`  https://youtu.be/${ID}?t=30  `), ID);
});

test('refuse les URL invalides (VID-01, PLAY-04)', () => {
  assert.equal(extraireIdVideo(''), null);
  assert.equal(extraireIdVideo(undefined), null);
  assert.equal(extraireIdVideo('pas une url'), null);
  assert.equal(extraireIdVideo('https://exemple.com/watch?v=' + ID), null);
  assert.equal(extraireIdVideo('https://www.youtube.com/watch?v=trop-court'), null);
  assert.equal(extraireIdVideo('javascript:alert(1)'), null);
});
