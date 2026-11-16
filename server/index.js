// Serveur : Express sert les pages du client, Socket.IO gère le temps réel.
// Exigences : SAL-01 à SAL-05, VID-04 (isolation par salon). Module : Emilien. Relecteur : Youness.
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as validateurs from './validators.js';
import { creerRegistreSalons, brancherSalons, validationPseudoProvisoire } from './rooms.js';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Crée le serveur sans le démarrer : utilisé par npm start et par les tests d'intégration.
// Les options permettent aux tests de raccourcir le délai de grâce ou de réduire les limites.
export function creerServeur(optionsRegistre = {}) {
  const app = express();
  const serveurHttp = createServer(app);
  const io = new Server(serveurHttp);

  app.use(express.static(path.join(racine, 'client')));
  app.use('/shared', express.static(path.join(racine, 'shared')));

  // Validation des pseudonymes : celle de server/validators.js (Hatim) dès qu'elle est exportée,
  // sinon la validation provisoire de rooms.js.
  const validerPseudo = validateurs.validerPseudo ?? validationPseudoProvisoire;
  const registre = creerRegistreSalons({ validerPseudo, ...optionsRegistre });
  brancherSalons(io, registre);

  return { app, serveurHttp, io, registre };
}

// Démarrage uniquement quand le fichier est lancé directement (node server/index.js).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { serveurHttp } = creerServeur();
  const PORT = process.env.PORT || 3000;
  serveurHttp.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}
