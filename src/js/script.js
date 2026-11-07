import { db, auth } from './firebase.js';
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

/* =========================================================
   POUSITO CAFÉ — LÓGICA DE INTERACCIÓN CON GROQ IA
   + Sistema de reservas automático y animaciones
   ========================================================= */



  /* =======================================================
     1. CONFIGURACIÓN DE GROQ API
     ======================================================= */

  const API_KEY = import.meta.env.VITE_GROQ_API_KEY;
  const API_URL = "https://api.groq.com/openai/v1/chat/completions";

   const MODELS = {
    modelo1: "openai/gpt-oss-120b",
    modelo2: "openai/gpt-oss-120b",
    modelo3: "openai/gpt-oss-120b"
};

  const SYSTEM_PROMPT = `
Eres Pousito, el asistente virtual de la cafetería "Pousito Café".
Tu única función es ayudar a los clientes con TRES temas específicos.

=========================================
TEMAS PERMITIDOS (SOLO ESTOS TRES):
1. MOSTRAR EL MENÚ DE LA CASA (bebidas, panadería, postres, cenas y desayunos).
2. MOSTRAR EL MENÚ DEL DÍA (comida corrida según el día de la semana).
3. INFORMACIÓN PARA RESERVAR UNA MESA (precios, paquetes, requisitos).
=========================================

REGLAS ESTRICTAS DE COMPORTAMIENTO:
- Si el usuario pregunta algo fuera de estos 3 temas, responde amablemente:
  "Lo siento, solo puedo ayudarte con el menú, el menú del día o las reservaciones de Pousito Café. ¿Sobre cuál de estos te gustaría saber más?"
- NO uses emojis en tus respuestas. Usa texto claro, ordenado y cálido.
- Al finalizar cada respuesta, agrega la frase exacta: "Ñam ñam ñam..."
- Sé breve, directo y usa listas cuando sea útil.
- Si el usuario pide el menú del día sin especificar el día, pregúntale qué día quiere consultar.
- Cuando el usuario quiera reservar, indícale que puede usar el botón de "Reservar" o el formulario que aparecerá. No listes los paquetes en texto, el sistema los mostrará como botones.

=========================================
INFORMACIÓN OFICIAL DE POUSITO CAFÉ
=========================================

1. DATOS GENERALES Y UBICACIÓN:
- Eslogan: "Café de olla, pan recién horneado y antojitos como en casa."
- Dirección: Av. Ermita Iztapalapa #1245, Local 3, CDMX.
- Teléfono: 55 5678 4321 | WhatsApp: 55 1234 5678
- Métodos de pago: Efectivo, tarjetas, SPEI, Mercado Pago, CoDi y vales.

2. HORARIOS:
- Lunes a Miércoles: 7:00 a 22:00
- Jueves y Viernes: 7:00 a 23:00
- Sábado: 8:00 a 23:00
- Domingo: 8:00 a 16:00

3. MENÚ DEL DÍA — COMIDA CORRIDA ($120 MXN / $145 MXN con café de olla):
Disponible de Lunes a Viernes de 13:00 a 16:00.
- Lunes: Sopa de tortilla | Pollo en mole | Arroz con leche.
- Martes: Crema de elote | Chiles rellenos | Flan napolitano.
- Miércoles: Sopa de fideo | Albóndigas | Gelatina de mosaico.
- Jueves: Caldo tlalpeño | Enchiladas verdes | Plátanos fritos.
- Viernes: Sopa de lentejas | Pescado a la veracruzana | Capirotada.

4. MENÚ DE LA CASA:

DESAYUNOS:
- Chilaquiles: $95
- Molletes: $75
- Huevos Rancheros: $85
- Enfrijoladas: $80

DULCES:
- Concha: $18
- Rol de Canela: $45
- Churros: $50

BEBIDAS:
- Café de Olla: $30
- Capuchino: $45
- Aguas frescas: $25

PANADERÍA Y POSTRES:
- Pan de Masa Madre: $85
- Torrija de brioche: $75 (postre insignia)

CENAS (Jueves a Sábado):
- Hamburguesa "La Chilanga": $150
- Quesadilla de Birria: $95

5. RESERVACIÓN DE MESAS:
- Renta individual: $150 por hora
- Renta familiar: $250 por hora
- Renta comunal: $400 por hora
- Paquete Cumpleaños: $1,200
- Paquete Trabajo: $900
- Las reservaciones se hacen con 48 horas de anticipación.
- Se requiere 50% de anticipo para confirmar.

=========================================
PROMOCIONES (menciónalas SOLO si el usuario pregunta por promociones):
- Lunes: 2x1 en café.
- Jueves: Postre gratis en compras mayores a $150.
=========================================
`;

  const WELCOME_MESSAGES = {
    cafe: "Hola, soy Pousito. Te puedo mostrar nuestro menú de la casa: desayunos, panadería, postres, bebidas y cenas. ¿Qué te gustaría ver?",
    dia: "Hola, soy Pousito. Te comparto el menú del día (comida corrida de lunes a viernes, 13:00 a 16:00). ¿De qué día quieres consultarlo?",
    reserva: "Hola, soy Pousito. Te ayudo con la información para reservar una mesa: tipos, precios, paquetes y requisitos. ¿Qué necesitas saber?"
  };

  // Paquetes con íconos SVG (sin emojis)
  const PACKAGES = [
    {
      id: 'individual',
      name: 'Renta Individual',
      price: '$150 / hora',
      desc: 'Mesa para 1-2 personas',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      </svg>`
    },
    {
      id: 'familiar',
      name: 'Renta Familiar',
      price: '$250 / hora',
      desc: 'Mesa para 3-6 personas',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>`
    },
    {
      id: 'comunal',
      name: 'Renta Comunal',
      price: '$400 / hora',
      desc: 'Mesa para 7-12 personas',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>`
    },
    {
      id: 'cumple',
      name: 'Paquete Cumpleaños',
      price: '$1,200',
      desc: 'Decoración + pastel + bebidas',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
        <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
        <path d="M2 21h20"/>
        <path d="M7 8v3"/>
        <path d="M12 8v3"/>
        <path d="M17 8v3"/>
        <path d="M7 4h.01"/>
        <path d="M12 4h.01"/>
        <path d="M17 4h.01"/>
      </svg>`
    },
    {
      id: 'trabajo',
      name: 'Paquete Trabajo',
      price: '$900',
      desc: 'WiFi, proyector y café ilimitado',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>`
    }
  ];

  /* =======================================================
     2. PERSISTENCIA EN LOCALSTORAGE
     ======================================================= */

  const STORAGE_KEY = 'pousito-conversations';

  let conversations = {};
  let activeChatId = 'cafe';
  let chatCounter = 0;
  let activeModel = 'modelo1';
  let welcomeVisible = true;
  // Se incrementa cada vez que cambia/cierra la sesión. Sirve para descartar
  // respuestas asíncronas (Firestore, Groq) que lleguen de una sesión anterior.
  let sessionGen = 0;
      async function loadConversations(gen = sessionGen) {
    try {
      const user = auth.currentUser;
      if (user) {
        const chatsRef = collection(db, "users", user.uid, "chats");
        const querySnapshot = await getDocs(chatsRef);

        // Si mientras cargaba se cerró/cambió la sesión, descartamos el resultado
        if (gen !== sessionGen || auth.currentUser !== user) return false;

        // Vaciamos la memoria antes de llenarla con lo nuevo
        conversations = {}; 

        if (!querySnapshot.empty) {
          let maxChatId = 0;
          let lastActiveId = 'cafe';

          const chatsArray = [];
          querySnapshot.forEach((doc) => {
            chatsArray.push({ id: doc.id, messages: doc.data().messages });
          });

          chatsArray.sort((a, b) => {
            const numA = a.id.includes('nuevo-') ? parseInt(a.id.split('-')[1]) : 0;
            const numB = b.id.includes('nuevo-') ? parseInt(b.id.split('-')[1]) : 0;
            return numA - numB;
          });

          chatsArray.forEach((chat) => {
            conversations[chat.id] = chat.messages;
            if (chat.id.includes('nuevo-')) {
              const num = parseInt(chat.id.split('-')[1]);
              if (num > maxChatId) {
                maxChatId = num;
              }
            }
          });

          chatCounter = maxChatId; 
          activeChatId = 'temporal'; 
          return true;
        }
      }
      return false; 
    } catch (e) { 
      console.warn('No se pudo cargar el historial', e); 
      return false;
    }
  }


  // Guarda en Firestore el chat activo: users/{uid}/chats/{chatId} -> { messages }
  // (el mismo formato que lee loadConversations). No hace nada si no hay sesión
  // (invitado) ni con el chat 'temporal' o un chat que solo tiene el saludo.
  // Nunca lanza errores, para que un fallo de red no rompa el chat.
  async function saveConversations() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Se captura todo ANTES de cualquier await: así un guardado nunca se
      // mezcla con otra cuenta si la sesión cambia justo después.
      const chatId = activeChatId;
      const msgs = conversations[chatId];
      if (!chatId || chatId === 'temporal') return;
      if (!Array.isArray(msgs) || msgs.length <= 1) return;

      // JSON clona y elimina valores undefined (Firestore no los acepta)
      const messages = JSON.parse(JSON.stringify(msgs));
      await setDoc(doc(db, "users", user.uid, "chats", chatId), { messages });
    } catch (e) {
      console.warn('No se pudo guardar el chat', e);
    }
  }
   
      function initDefaultConversations() {
    // En lugar de crear IDs fijos, creamos un chat temporal que no se guardará en Firebase hasta que el usuario interactúe
    conversations = {
      'temporal': [ { role: 'bot', text: WELCOME_MESSAGES.cafe } ]
    };
    activeChatId = 'temporal';
    chatCounter = 0; 
  }

  /* =======================================================
     3. REFERENCIAS AL DOM
     ======================================================= */

  const messagesEl = document.getElementById('messages');
  const composerForm = document.getElementById('composerForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const historyList = document.getElementById('historyList');
  const newChatBtn = document.getElementById('newChatBtn');
  const quickActions = document.getElementById('quickActions');
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('overlay');
  const ratingModal = document.getElementById('ratingModal');
  const openRatingBtn = document.getElementById('openRatingBtn');
  const closeRatingBtn = document.getElementById('closeRatingBtn');
  const submitRatingBtn = document.getElementById('submitRatingBtn');
  const stars = document.querySelectorAll('.star');
  const ratingThanks = document.getElementById('ratingThanks');
  const modelSelector = document.getElementById('modelSelector');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const chatView = document.getElementById('chatView');
  const themeBtn = document.getElementById('themeBtn');
  const iconSun = themeBtn.querySelector('.icon-sun');
  const iconMoon = themeBtn.querySelector('.icon-moon');

  // Reserva
  const reservationModal = document.getElementById('reservationModal');
  const closeReservationBtn = document.getElementById('closeReservationBtn');
  const reservationStep1 = document.getElementById('reservationStep1');
  const reservationStep2 = document.getElementById('reservationStep2');
  const reservationStep3 = document.getElementById('reservationStep3');
  const packageGrid = document.getElementById('packageGrid');
  const reservationForm = document.getElementById('reservationForm');
  const reservationSummary = document.getElementById('reservationSummary');
  const reservationCodeEl = document.getElementById('reservationCode');
  const closeReservationSuccessBtn = document.getElementById('closeReservationSuccessBtn');

  let selectedPackage = null;

  /* =======================================================
     4. AVATARES
     ======================================================= */

   const BOT_IMAGE_URL = "/src/assets/poucito.png";

  const AVATAR_USER_SVG = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`;

  /* =======================================================
     5. MODO OSCURO
     ======================================================= */

  const THEME_KEY = 'pousito-theme';

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    document.documentElement.classList.remove('preload-dark');
    iconSun.style.display = isDark ? 'none' : 'block';
    iconMoon.style.display = isDark ? 'block' : 'none';
    themeBtn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    applyTheme(isDark ? 'light' : 'dark');
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') applyTheme(saved);
    else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  themeBtn.addEventListener('click', toggleTheme);

  /* =======================================================
     6. WELCOME → CHAT
     ======================================================= */

  function switchToChatView() {
    if (!welcomeVisible) return;
    welcomeVisible = false;
    welcomeScreen.classList.add('hidden');
    chatView.classList.remove('hidden');
  }

  function switchToWelcomeView() {
    welcomeVisible = true;
    welcomeScreen.classList.remove('hidden');
    chatView.classList.add('hidden');
  }

  /* =======================================================
     7. RENDERIZADO DE MENSAJES
     ======================================================= */

  function renderMessages() {
    messagesEl.innerHTML = '';
    const msgs = conversations[activeChatId] || [];
    msgs.forEach(msg => appendMessageToDOM(msg, false));
    scrollToBottom();
  }

  function appendMessageToDOM(msg, animate = true) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;
    if (!animate) row.style.animation = 'none';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (msg.role === 'bot') avatar.innerHTML = `<img src="${BOT_IMAGE_URL}" alt="Pousito">`;
    else avatar.innerHTML = AVATAR_USER_SVG;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Si el mensaje del bot es de tipo "packages", mostramos botones con íconos SVG
    if (msg.role === 'bot' && msg.type === 'packages') {
      const safeText = (msg.text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bubble.innerHTML = safeText.replace(/\n/g, '<br>');
      const grid = document.createElement('div');
      grid.className = 'chat-package-grid';
      PACKAGES.forEach(pkg => {
        const b = document.createElement('button');
        b.className = 'chat-package-btn ripple';
        b.dataset.package = pkg.id;
        b.innerHTML = `
          <span class="chat-package-header">
            ${pkg.icon}
            <span>${pkg.name}</span>
          </span>
          <small>${pkg.price}</small>
        `;
        b.addEventListener('click', () => openReservationModal(pkg.id));
        grid.appendChild(b);
      });
      bubble.appendChild(grid);
    } else {
      const safeText = (msg.text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bubble.innerHTML = safeText.replace(/\n/g, '<br>');
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
  }

  function scrollToBottom() {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
  }

  /* =======================================================
     8. EFECTO MÁQUINA DE ESCRIBIR
     ======================================================= */

  function typeWriter(element, text, speed = 18) {
    return new Promise(resolve => {
      let i = 0;
      element.textContent = '';
      function tick() {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          if (i % 20 === 0) scrollToBottom();
          setTimeout(tick, speed);
        } else {
          resolve();
        }
      }
      tick();
    });
  }

  async function appendTypedBotMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row bot typing-target';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<img src="${BOT_IMAGE_URL}" alt="Pousito">`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '';

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();

    await typeWriter(bubble, text);
    row.classList.remove('typing-target');
    scrollToBottom();
  }

  /* =======================================================
     9. ENVÍO A GROQ
     ======================================================= */

  function isReservationIntent(text) {
    const t = text.toLowerCase();
    const keywords = ['reservar', 'reservación', 'reserva', 'apartar mesa', 'apartado', 'paquete', 'cumpleaños', 'renta'];
    return keywords.some(k => t.includes(k));
  }

   async function sendUserMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const gen = sessionGen;
    switchToChatView();

    // --- NUEVO: Convertir el chat temporal en un "nuevo-X" real ---
    if (activeChatId === 'temporal') {
      chatCounter += 1;
      const newId = `nuevo-${chatCounter}`;
      
      // Movemos los mensajes del chat temporal al nuevo ID
      conversations[newId] = conversations['temporal'];
      delete conversations['temporal'];
      
      activeChatId = newId;
      
      // Agregamos el botón al historial lateral visualmente
      const item = document.createElement('button');
      item.className = 'history-item';
      item.dataset.chat = newId;
      item.innerHTML = `
        <svg class="history-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Nuevo chat ${chatCounter}
      `;
      historyList.prepend(item);
    }

    if (isReservationIntent(trimmed)) {
      const userMsg = { role: 'user', text: trimmed };
      conversations[activeChatId].push(userMsg);
      appendMessageToDOM(userMsg);
      saveConversations();

      messageInput.value = '';
      showTypingIndicator();

      await new Promise(r => setTimeout(r, 600));
      removeTypingIndicator();
      if (gen !== sessionGen) return;

      const botMsg = {
        role: 'bot',
        type: 'packages',
        text: '¡Claro! Elige el paquete que más te guste y te abro el formulario de reserva:'
      };
      conversations[activeChatId].push(botMsg);
      appendMessageToDOM(botMsg);
      saveConversations();
      scrollToBottom();
      return;
    }

    const userMsg = { role: 'user', text: trimmed };
    conversations[activeChatId].push(userMsg);
    appendMessageToDOM(userMsg);
    saveConversations();

    messageInput.value = '';
    setSendLoading(true);
    showTypingIndicator();

    const welcomeTexts = Object.values(WELCOME_MESSAGES);
    const historialLimpio = conversations[activeChatId].filter(
      msg => !welcomeTexts.includes(msg.text) &&
             !msg.text?.includes('Lo siento, tuve un problema') &&
             msg.type !== 'packages'
    );

    const apiMessages = [ { role: "system", content: SYSTEM_PROMPT } ];
    historialLimpio.forEach(msg => {
      apiMessages.push({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.text
      });
    });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY.trim()}`
        },
        body: JSON.stringify({
          model: MODELS[activeModel],
          messages: apiMessages,
          temperature: 0.5
        })
      });

      removeTypingIndicator();
      if (gen !== sessionGen) return;

      if (!response.ok) {
        const detalleError = await response.json();
        console.error("GROQ DICE:", detalleError.error?.message || detalleError);
        throw new Error(`Error ${response.status}`);
      }

      const data = await response.json();
      const botResponseText = data.choices[0].message.content;

      const botMsg = { role: 'bot', text: botResponseText };
      conversations[activeChatId].push(botMsg);
      saveConversations();

      await appendTypedBotMessage(botResponseText);
      scrollToBottom();

    } catch (error) {
      removeTypingIndicator();
      if (gen !== sessionGen) return;
      const errorMsg = {
        role: 'bot',
        text: 'Lo siento, tuve un problema al conectarme. Por favor intenta de nuevo.'
      };
      conversations[activeChatId].push(errorMsg);
      saveConversations();
      appendMessageToDOM(errorMsg);
      scrollToBottom();
    } finally {
      setSendLoading(false);
    }
  }

  function setSendLoading(loading) {
    sendBtn.disabled = loading;
    sendBtn.querySelector('.send-icon').style.display = loading ? 'none' : 'block';
    sendBtn.querySelector('.spinner').style.display = loading ? 'block' : 'none';
  }

  composerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendUserMessage(messageInput.value);
  });

  /* =======================================================
     10. INDICADOR DE ESCRITURA
     ======================================================= */

  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row bot typing-indicator';
    row.id = 'typingIndicator';

    row.innerHTML = `
      <div class="message-avatar"><img src="${BOT_IMAGE_URL}" alt="Pousito"></div>
      <div class="bubble">
        <div class="typing-dots"><span></span><span></span><span></span></div>
        Pousito está pensando...
      </div>
    `;
    messagesEl.appendChild(row);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  /* =======================================================
     11. TARJETAS DEL WELCOME + QUICK ACTIONS
     ======================================================= */

  document.querySelectorAll('.welcome-card-item').forEach(card => {
    card.addEventListener('click', () => {
      // "Reservar mesa": solo abre el modal, sin iniciar ningún chat
      if (card.dataset.action === 'open-reservation') {
        openReservationModal();
      } else {
        sendUserMessage(card.dataset.message);
      }
    });
  });

  quickActions.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-btn');
    if (!btn) return;
    if (btn.dataset.action === 'open-reservation') {
      openReservationModal();
    } else if (btn.dataset.message) {
      sendUserMessage(btn.dataset.message);
    }
  });

  /* =======================================================
     12. SELECTOR DE MODELOS
     ======================================================= */

  modelSelector.addEventListener('click', (e) => {
    const pill = e.target.closest('.model-pill');
    if (!pill) return;
    document.querySelectorAll('.model-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeModel = pill.dataset.model;
  });

  /* =======================================================
     13. HISTORIAL Y NAVEGACIÓN
     ======================================================= */

   newChatBtn.addEventListener('click', () => {
    chatCounter += 1;
    const newId = `nuevo-${chatCounter}`;
    conversations[newId] = [ { role: 'bot', text: WELCOME_MESSAGES.cafe } ];
    saveConversations();

    const item = document.createElement('button');
    item.className = 'history-item';
    item.dataset.chat = newId;
    item.innerHTML = `
      <svg class="history-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      Nuevo chat ${chatCounter}
    `;
    historyList.prepend(item);

    setActiveChat(newId);
    switchToWelcomeView();
    closeSidebarOnMobile();
  });

  historyList.addEventListener('click', (e) => {
    const item = e.target.closest('.history-item');
    if (!item) return;
    setActiveChat(item.dataset.chat);
    closeSidebarOnMobile();
  });

  function setActiveChat(chatId) {
    if (!conversations[chatId]) return;
    activeChatId = chatId;
    saveConversations();

    document.querySelectorAll('.history-item').forEach(el => {
      el.classList.toggle('active', el.dataset.chat === chatId);
    });

    renderMessages();
    if (conversations[chatId].length > 1) switchToChatView();
    else switchToWelcomeView();
  }

  // La hamburguesa abre y cierra el menú
  menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebarOnMobile();
    else openSidebarOnMobile();
  });

  // Escape también cierra el menú
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebarOnMobile();
  });

  // Si se agranda la pantalla (rotar el celular, ventana de PC), se limpia el estado
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) closeSidebarOnMobile();
  });

  overlay.addEventListener('click', closeSidebarOnMobile);

  function openSidebarOnMobile() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    menuToggle.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Cerrar menú');
  }

  function closeSidebarOnMobile() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
  }

  /* =======================================================
     14. CARRUSELES
     ======================================================= */

  function initCarousel(containerId, autoPlayMs = 4000) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const slides = container.querySelectorAll('.carousel-slide');
    const dotsWrapper = container.querySelector('.carousel-dots');
    let currentIndex = 0;
    let timer = null;

    slides.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goToSlide(i));
      dotsWrapper.appendChild(dot);
    });
    const dots = dotsWrapper.querySelectorAll('.dot');

    function goToSlide(index) {
      slides[currentIndex].classList.remove('active');
      dots[currentIndex].classList.remove('active');
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add('active');
      dots[currentIndex].classList.add('active');
    }

    function nextSlide() { goToSlide(currentIndex + 1); }
    function startAutoPlay() { timer = setInterval(nextSlide, autoPlayMs); }
    function resetAutoPlay() { clearInterval(timer); startAutoPlay(); }

    const nextBtn = container.querySelector('.carousel-arrow.next');
    const prevBtn = container.querySelector('.carousel-arrow.prev');

    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetAutoPlay(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { goToSlide(currentIndex - 1); resetAutoPlay(); });

    startAutoPlay();
  }

  initCarousel('carouselPlace', 4000);
  initCarousel('carouselProducts', 5000);

  /* =======================================================
     15. MODAL DE CALIFICACIÓN
     ======================================================= */

  let selectedRating = 0;

  openRatingBtn.addEventListener('click', () => ratingModal.classList.add('visible'));
  closeRatingBtn.addEventListener('click', closeRatingModal);
  ratingModal.addEventListener('click', (e) => { if (e.target === ratingModal) closeRatingModal(); });

  function closeRatingModal() {
    ratingModal.classList.remove('visible');
    selectedRating = 0;
    highlightStars(0);
    ratingThanks.classList.remove('visible');
    submitRatingBtn.style.display = 'block';
  }

  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value, 10);
      highlightStars(selectedRating);
    });
    star.addEventListener('mouseenter', () => highlightStars(parseInt(star.dataset.value, 10)));
  });

  document.getElementById('stars').addEventListener('mouseleave', () => highlightStars(selectedRating));

  function highlightStars(value) {
    stars.forEach(star => {
      star.classList.toggle('selected', parseInt(star.dataset.value, 10) <= value);
    });
  }

  submitRatingBtn.addEventListener('click', () => {
    if (selectedRating === 0) return;
    ratingThanks.classList.add('visible');
    submitRatingBtn.style.display = 'none';
  });

  /* =======================================================
     16. MODAL DE RESERVA (PASO A PASO)
     ======================================================= */

  function openReservationModal(preselectPackageId = null) {
    // Sin sesión no se puede reservar: se muestra el login
    if (!auth.currentUser) {
      document.getElementById('authModal').classList.add('visible');
      return;
    }

    reservationStep1.style.display = 'block';
    reservationStep2.style.display = 'none';
    reservationStep3.style.display = 'none';
    reservationForm.reset();
    showReservationError('');
    selectedPackage = null;
    document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));

    if (preselectPackageId) {
      const card = document.querySelector(`.package-card[data-package="${preselectPackageId}"]`);
      if (card) {
        card.classList.add('selected');
        selectedPackage = {
          id: card.dataset.package,
          name: card.querySelector('.package-name').textContent,
          price: card.querySelector('.package-price').textContent
        };
        reservationSummary.textContent = `${selectedPackage.name} — ${selectedPackage.price}`;
        reservationStep1.style.display = 'none';
        reservationStep2.style.display = 'block';
      }
    }

    reservationModal.classList.add('visible');
  }

  function closeReservationModal() {
    reservationModal.classList.remove('visible');
    setTimeout(() => {
      reservationStep1.style.display = 'block';
      reservationStep2.style.display = 'none';
      reservationStep3.style.display = 'none';
      selectedPackage = null;
      document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
      reservationForm.reset();
    }, 250);
  }

  closeReservationBtn.addEventListener('click', closeReservationModal);
  closeReservationSuccessBtn.addEventListener('click', closeReservationModal);
  reservationModal.addEventListener('click', (e) => { if (e.target === reservationModal) closeReservationModal(); });

  packageGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.package-card');
    if (!card) return;

    document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    selectedPackage = {
      id: card.dataset.package,
      name: card.querySelector('.package-name').textContent,
      price: card.querySelector('.package-price').textContent
    };

    setTimeout(() => {
      reservationStep1.style.display = 'none';
      reservationStep2.style.display = 'block';
      reservationSummary.textContent = `${selectedPackage.name} — ${selectedPackage.price}`;
    }, 200);
  });

  /* ---------- Código de confirmación ----------
     Formato: POUSITO-NOMB-TELE-NNNN
       NOMB = primeras 4 letras del nombre
       TELE = primeros 4 dígitos del teléfono
       NNNN = dos números aleatorios de 2 dígitos
     Ejemplo: POUSITO-ISRA-5514-1235                     */
  function buildReservationCode(name, phone) {
    const letters = String(name)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita acentos
      .replace(/[^a-zA-Z]/g, '')                           // solo letras
      .toUpperCase()
      .slice(0, 4) || 'XXXX';
    const digits = String(phone).replace(/\D/g, '').slice(0, 4).padEnd(4, '0');
    const rnd = () => String(Math.floor(Math.random() * 100)).padStart(2, '0');
    return `POUSITO-${letters}-${digits}-${rnd()}${rnd()}`;
  }

  // Genera un código que no exista todavía en la colección "reservations"
  async function generateUniqueReservationCode(name, phone) {
    let code = buildReservationCode(name, phone);
    for (let i = 0; i < 5; i++) {
      try {
        const existing = await getDoc(doc(db, 'reservations', code));
        if (!existing.exists()) return code;
      } catch (_) {
        return code;   // sin permiso de lectura: seguimos con este código
      }
      code = buildReservationCode(name, phone);
    }
    return code;
  }

  function showReservationError(message) {
    let el = document.getElementById('reservationError');
    if (!el) {
      el = document.createElement('p');
      el.id = 'reservationError';
      el.style.cssText = 'color:#e53935;font-size:13px;font-weight:600;text-align:center;margin-top:12px;';
      reservationForm.appendChild(el);
    }
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
  }

  reservationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showReservationError('');

    // Seguridad extra: si la sesión se perdió, pedimos iniciar sesión
    const user = auth.currentUser;
    if (!user) {
      closeReservationModal();
      document.getElementById('authModal').classList.add('visible');
      return;
    }

    const formData = new FormData(reservationForm);
    const data = Object.fromEntries(formData.entries());

    const submitBtn = reservationForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Procesando reserva...';

    let code;
    try {
      code = await generateUniqueReservationCode(data.name, data.phone);

      const packageCard = selectedPackage
        ? document.querySelector(`.package-card[data-package="${selectedPackage.id}"]`)
        : null;

      // Colección "reservations" -> documento con el código -> todos los datos
      await setDoc(doc(db, 'reservations', code), {
        codigo: code,
        nombre: data.name.trim(),
        telefono: data.phone.trim(),
        fecha: data.date,
        hora: data.time,
        personas: Number(data.people),
        paquete: selectedPackage?.name || '',
        paqueteId: selectedPackage?.id || '',
        precio: selectedPackage?.price || '',
        precioNumero: packageCard ? Number(packageCard.dataset.price) : null,
        estado: 'confirmada',
        userId: user.uid,
        email: user.email || '',
        creadaEn: serverTimestamp()
      });
    } catch (error) {
      console.error('No se pudo guardar la reserva', error);
      showReservationError('No pudimos guardar tu reserva. Revisa tu conexión e inténtalo de nuevo.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    reservationCodeEl.textContent = code;
    reservationStep2.style.display = 'none';
    reservationStep3.style.display = 'block';

    submitBtn.disabled = false;
    submitBtn.textContent = originalText;

    // Mensaje de confirmación sin emojis, con texto limpio
    const summaryText = `Reserva confirmada:\n` +
      `• Paquete: ${selectedPackage?.name || ''}\n` +
      `• Nombre: ${data.name}\n` +
      `• Fecha: ${data.date} a las ${data.time}\n` +
      `• Personas: ${data.people}\n` +
      `• Código: ${code}\n\n` +
      `Presenta este código el día de tu reserva. ¡Te esperamos! Ñam ñam ñam...`;

    // Solo se agrega la confirmación al chat si ya hay una conversación iniciada.
    // Si la reserva se hizo desde la pantalla de bienvenida, no se crea ningún chat.
    if (!welcomeVisible && conversations[activeChatId]) {
      const botMsg = { role: 'bot', text: summaryText };
      conversations[activeChatId].push(botMsg);
      saveConversations();
      appendMessageToDOM(botMsg);
      scrollToBottom();
    }
  });

  /* =======================================================
     17. RIPPLE EFFECT
     ======================================================= */

  document.querySelectorAll('.new-chat-btn, .send-btn, .quick-btn, .submit-rating-btn, .package-card, .welcome-card-item, .icon-circle-btn').forEach(btn => {
    btn.classList.add('ripple');
  });

  /* =======================================================
     18. INICIALIZACIÓN
     ======================================================= */
  // Registra al usuario en la base (users/{uid}) apenas inicia sesión o se registra,
  // sin importar cómo entró (correo, registro o Google). Así el perfil existe
  // desde el primer momento y no solo cuando guarda un chat.
  async function ensureUserProfile(user) {
    try {
      const ref = doc(db, 'users', user.uid);

      // 1) Al instante: crea el documento (o solo actualiza la fecha si ya existía)
      await setDoc(ref, {
        email: user.email || '',
        ultimaActualizacion: serverTimestamp()
      }, { merge: true });

      // 2) Poco después: si todavía no tiene nombre, se lo pone. Se espera un instante
      //    para no pisar el nombre que el formulario de registro guarda por su cuenta.
      setTimeout(async () => {
        try {
          if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
          const snap = await getDoc(ref);
          if (!snap.exists() || !snap.data().nombre) {
            const fallback = user.displayName || (user.email || '').split('@')[0];
            await setDoc(ref, { nombre: fallback }, { merge: true });
          }
        } catch (e) {
          console.warn('No se pudo completar el perfil del usuario', e);
        }
      }, 1200);
    } catch (e) {
      console.warn('No se pudo registrar el perfil del usuario', e);
    }
  }

  // Borra TODO lo que pertenece a la sesión actual (memoria + pantalla)
  function resetSession() {
    sessionGen++;
    conversations = {};
    chatCounter = 0;
    activeChatId = 'temporal';
    if (historyList) historyList.innerHTML = '';
    if (messagesEl) messagesEl.innerHTML = '';
    switchToWelcomeView();
  }

  async function init() {
    initTheme();
    const gen = sessionGen;
    historyList.innerHTML = ''; 

    const hasSaved = await loadConversations(gen);

    // Si se cerró sesión mientras se cargaba el historial, no pintamos nada
    if (gen !== sessionGen) return;
    
    // SIEMPRE inicializamos el chat temporal (la pantalla de bienvenida)
    // Si ya hay chats guardados, los mantendrá en el menú, pero no los abrirá.
    if (!conversations['temporal']) {
      conversations['temporal'] = [ { role: 'bot', text: WELCOME_MESSAGES.cafe } ];
    }
    activeChatId = 'temporal'; 

    // Pintamos el menú si hay chats guardados
    if (hasSaved) {
      if (chatCounter > 0) {
        for (let i = 1; i <= chatCounter; i++) {
          const id = `nuevo-${i}`;
          if (conversations[id]) {
            const item = document.createElement('button');
            item.className = 'history-item';
            item.dataset.chat = id;
            item.innerHTML = `
              <svg class="history-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Nuevo chat ${i}
            `;
            historyList.appendChild(item);
          }
        }
      }
    }

    // Quitamos la selección del menú (ningún chat está activo)
    document.querySelectorAll('.history-item').forEach(el => {
      el.classList.remove('active');
    });

    // Forzamos la vista de bienvenida
    renderMessages(); // Esto renderizará el mensaje del chat temporal
    switchToWelcomeView();
  }

    // =======================================================
  // 19. INICIO DE SESIÓN Y ARRANQUE DEL CHAT
  // =======================================================
     // =======================================================
   onAuthStateChanged(auth, async (user) => {
    const authModal = document.getElementById('authModal');

    if (user) {
      // Inicia sesión (o cambia de cuenta): limpiamos lo anterior y cargamos el historial
      resetSession();
      if (authModal) authModal.classList.remove('visible');
      sessionStorage.removeItem('pousito_invitado'); 

      // Registra/actualiza al usuario en la base de datos de inmediato
      ensureUserProfile(user);

      const gen = sessionGen;
      setTimeout(() => {
        if (gen === sessionGen) init();
      }, 150); 

    } else {
      // No hay usuario
      if (!sessionStorage.getItem('pousito_invitado')) {
        // No es invitado: limpiamos todo y mostramos el login
        resetSession();
        if (authModal) authModal.classList.add('visible');
      } else {
        // Es invitado: solo ocultamos el modal
        if (authModal) authModal.classList.remove('visible');
      }
    }
  });

   // =======================================================
  // 20. ESCUCHAR EL BOTÓN DE LA X (MODO INVITADO)
  // =======================================================
   window.addEventListener('modoInvitado', () => {
    // 1. Marcamos que es invitado en esta pestaña
    sessionStorage.setItem('pousito_invitado', 'true'); 
    
    // 2. SOLO inicializamos si no hay ningún chat creado (primera vez)
    if (Object.keys(conversations).length === 0) {
      initDefaultConversations();
      activeChatId = 'temporal';
      historyList.innerHTML = '';
      renderMessages();
      switchToWelcomeView();
    }
    // Si ya había chats, NO hacemos nada. Se mantienen en pantalla.
  });

    /* =======================================================
     20. LÓGICA DEL PERFIL Y CERRAR SESIÓN
     ======================================================= */
  const userBtn = document.getElementById('userBtn');
  const profileModal = document.getElementById('profileModal');
  const profileEmail = document.getElementById('profileEmail');
  const btnLogout = document.getElementById('btnLogout');
  const btnCloseProfile = document.getElementById('btnCloseProfile');

  // Abrir el modal al dar clic en el ícono de usuario
  if (userBtn) {
    userBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        profileEmail.textContent = auth.currentUser.email;
        profileModal.classList.add('visible');
      } else {
        // Si no hay usuario (por alguna razón), mostramos el login
        document.getElementById('authModal').classList.add('visible');
      }
    });
  }

  // Cerrar el modal sin hacer nada
  if (btnCloseProfile) {
    btnCloseProfile.addEventListener('click', () => {
      profileModal.classList.remove('visible');
    });
  }

 
     // Cerrar sesión
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      profileModal.classList.remove('visible');
      try {
        sessionStorage.clear();   // quita también la marca de invitado
        await auth.signOut();

        // Limpieza inmediata (memoria + historial + mensajes), sin timers
        resetSession();
        document.getElementById('authModal').classList.add('visible');
      } catch (error) {
        console.error("Error al cerrar sesión", error);
      }
    });
  }