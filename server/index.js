// Squelette du serveur : Express sert le client, Socket.IO gère le temps réel.
// Module : Emilien (salons et serveur).
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const serveurHttp = createServer(app);
const io = new Server(serveurHttp);

app.use(express.static(path.join(racine, 'client')));
app.use('/shared', express.static(path.join(racine, 'shared')));

io.on('connection', (socket) => {
  // TODO (Emilien) : brancher ici les événements de shared/events.js
  // vers server/rooms.js (salons), playback.js, chat.js et playlist.js.
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
serveurHttp.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
