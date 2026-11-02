# Plateforme de visionnage vidéo synchronisé

Projet IL 2026-2027, semestre 1, Université d'Avignon (L3 Informatique), groupe A.

Application web qui permet à plusieurs personnes de regarder la même vidéo YouTube de façon
synchronisée, avec un chat en temps réel et une playlist commune. Aucun compte : on choisit un
pseudonyme, on crée un salon et on partage le lien.

## Équipe

| Membre | Responsabilité | Relecteur |
| --- | --- | --- |
| Daniel Court | Pages, interface, styles (`client/index.html`, `client/salon.html`, `client/css/`, `client/js/ui.js`) | Hatim Chmali |
| Emilien Jouberjean | Serveur, salons, état de lecture (`server/index.js`, `server/rooms.js`, `server/playback.js`) | Youness Nizari |
| Youness Nizari | Lecteur YouTube, synchronisation client (`client/js/player.js`, `client/js/sync.js`, `shared/youtube.js`) | Emilien Jouberjean |
| Hatim Chmali | Chat, pseudonymes, playlist (`client/js/chat.js`, `client/js/playlist.js`, `server/validators.js`, `server/chat.js`, `server/playlist.js`) | Daniel Court |

## Stack

JavaScript partout : HTML, CSS et JavaScript côté navigateur, Node.js et Express côté serveur,
Socket.IO pour le temps réel, API YouTube IFrame Player pour la lecture. L'état des salons est
gardé en mémoire du serveur (pas de base de données pour le MVP).

## Lancer le projet

Prérequis : Node.js 20 ou plus.

```bash
npm install
npm start        # serveur sur http://localhost:3000
npm test         # tests unitaires et d'intégration (node:test)
```

## Organisation des dossiers

| Dossier | Contenu |
| --- | --- |
| `client/` | Interface du navigateur (pages, styles, modules JavaScript) |
| `server/` | Serveur Express et Socket.IO (salons, état de lecture, chat, playlist) |
| `shared/` | Code commun : contrat d'événements (`events.js`), limites (`limits.js`), extraction d'URL YouTube (`youtube.js`) |
| `tests/` | Tests `node:test` |
| `docs/` | Cahier des charges, spécifications d'analyse, rapport de conception (PDF) |

## Règles Git

- La branche `main` est protégée : on n'y commit jamais directement.
- Une branche par fonctionnalité, par exemple `chat-01-affichage` ou `salons-sal-01-creation`.
- Un commit correspond à une tâche, avec l'identifiant de l'exigence dans le message,
  par exemple `CHAT-01 : affichage du pseudonyme`.
- Fusion par pull request, après relecture par le relecteur désigné ci-dessus.
- Toute modification du contrat d'événements (`shared/events.js`) est décidée en réunion d'équipe
  et reportée dans les spécifications d'analyse.

## Documents

- [Cahier des charges](docs/Cahier_des_charges_Groupe_A.pdf)
- [Spécifications d'analyse](docs/Specifications_analyse_Groupe_A.pdf)
- [Rapport de conception](docs/Rapport_conception_Groupe_A.pdf)

## Liens de suivi

- Tableau Trello : _à ajouter_
- Feuille d'heures : _à ajouter_
- Comptes rendus de réunion : _à ajouter_
