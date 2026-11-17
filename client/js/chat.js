// client/js/chat.js

/**
 * Échappe le HTML pour éviter les failles XSS (affichage en texte brut).
 * @param {string} texte 
 * @returns {string}
 */
function echapperHTML(texte) {
  const div = document.createElement('div');
  div.textContent = texte;
  return div.innerHTML;
}

/**
 * Formate une date ISO en heure locale (ex: "14:32").
 * @param {string} dateIso 
 * @returns {string}
 */
function formaterHeure(dateIso) {
  try {
    const d = new Date(dateIso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Affiche un message dans la zone du chat.
 * @param {HTMLElement} conteneur 
 * @param {Object} message { pseudo, texte, date }
 */
export function afficherMessageChat(conteneur, { pseudo, texte, date }) {
  if (!conteneur) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';

  const heure = formaterHeure(date);
  
  // Utilisation de textContent / echapperHTML pour garantier le texte brut (sécurité XSS)
  msgDiv.innerHTML = `
    <span class="chat-heure">${echapperHTML(heure)}</span>
    <strong class="chat-pseudo">${echapperHTML(pseudo)}:</strong>
    <span class="chat-texte">${echapperHTML(texte)}</span>
  `;

  conteneur.appendChild(msgDiv);
  conteneur.scrollTop = conteneur.scrollHeight; // Fait défiler automatiquement vers le bas
}

/**
 * Initialise la liste des messages lors de l'arrivée dans le salon.
 * @param {HTMLElement} conteneur 
 * @param {Array} messages 
 */
export function initialiserChat(conteneur, messages = []) {
  if (!conteneur) return;
  conteneur.innerHTML = '';
  messages.forEach((msg) => afficherMessageChat(conteneur, msg));
}