// RG8 : une URL YouTube est acceptée si on peut en extraire un identifiant
// de 11 caractères (formats watch?v=, youtu.be/, embed/, shorts/).
// Le serveur ne retient que l'identifiant. Module : Youness.

const HOTES_YOUTUBE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const FORMAT_ID = /^[A-Za-z0-9_-]{11}$/;

export function extraireIdVideo(url) {
  if (typeof url !== 'string') return null;
  let adresse;
  try {
    adresse = new URL(url.trim());
  } catch {
    return null;
  }
  if (adresse.protocol !== 'https:' && adresse.protocol !== 'http:') return null;
  const hote = adresse.hostname.toLowerCase();
  if (!HOTES_YOUTUBE.has(hote)) return null;

  let candidat = null;
  if (hote === 'youtu.be' || hote === 'www.youtu.be') {
    candidat = adresse.pathname.split('/')[1];
  } else if (adresse.pathname === '/watch') {
    candidat = adresse.searchParams.get('v');
  } else {
    const morceaux = adresse.pathname.split('/');
    if (morceaux[1] === 'embed' || morceaux[1] === 'shorts') candidat = morceaux[2];
  }
  return candidat && FORMAT_ID.test(candidat) ? candidat : null;
}
