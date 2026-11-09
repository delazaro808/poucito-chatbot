// =========================================================
// POUSITO CAFÉ — CONTROLADOR PRINCIPAL DEL CHATBOT
// TypeScript Refactoring con Tipado Estricto
// =========================================================

import { db, auth } from '../services/firebase';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import type {
  ChatMessage,
  ChatSession,
  BotResponse,
  PackageItem,
  ReservationData,
  ModelId,
  ThemeMode
} from '../types/chat';
import { sendChatMessage } from '../services/chatApi';

/* =========================================================
   1. CONSTANTES Y CONFIGURACIONES
   ========================================================= */

const BOT_IMAGE_URL: string = "/src/assets/poucito.png";

const AVATAR_USER_SVG: string = `
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>`;

const WELCOME_MESSAGES: Record<string, string> = {
  cafe: "Hola, soy Pousito. Te puedo mostrar nuestro menú de la casa: desayunos, panadería, postres, bebidas y cenas. ¿Qué te gustaría ver?",
  dia: "Hola, soy Pousito. Te comparto el menú del día (comida corrida de lunes a viernes, 13:00 a 16:00). ¿De qué día quieres consultarlo?",
  reserva: "Hola, soy Pousito. Te ayudo con la información para reservar una mesa: tipos, precios, paquetes y requisitos. ¿Qué necesitas saber?"
};

export const PACKAGES: PackageItem[] = [
  {
    id: 'individual',
    name: 'Renta Individual',
    price: '$150 / hora',
    desc: 'Mesa para 1-2 personas',
    priceNumber: 150,
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
    priceNumber: 250,
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
    priceNumber: 400,
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
    priceNumber: 1200,
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
    priceNumber: 900,
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>`
  }
];

/* =========================================================
   2. ESTADO GLOBAL DE LA APLICACIÓN
   ========================================================= */

let sessions: Record<string, ChatSession> = {};
let activeChatId: string = 'cafe';
let chatCounter: number = 0;
let activeModel: ModelId = 'modelo1';
let welcomeVisible: boolean = true;
let sessionGen: number = 0;
let selectedPackage: PackageItem | null = null;
let selectedRating: number = 0;

/**
 * Genera un ID único para mensajes
 */
function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normaliza mensajes antiguos (ej. de Firestore o LocalStorage) a la interfaz ChatMessage estricta
 */
function normalizeMessage(raw: any): ChatMessage {
  const role: 'user' | 'assistant' =
    raw.role === 'user' ? 'user' : 'assistant';
  const content: string =
    typeof raw.content === 'string'
      ? raw.content
      : typeof raw.text === 'string'
        ? raw.text
        : '';
  const timestamp: number =
    typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();
  const id: string =
    typeof raw.id === 'string' && raw.id ? raw.id : createMessageId();

  return {
    id,
    role,
    content,
    timestamp,
    type: raw.type === 'packages' ? 'packages' : 'text'
  };
}

/* =========================================================
   3. PERSISTENCIA EN FIRESTORE Y SESIONES
   ========================================================= */

/**
 * Carga las conversaciones del usuario autenticado desde Firestore
 */
async function loadConversations(gen: number = sessionGen): Promise<boolean> {
  try {
    const user: User | null = auth.currentUser;
    if (user) {
      const chatsRef = collection(db, "users", user.uid, "chats");
      const querySnapshot = await getDocs(chatsRef);

      if (gen !== sessionGen || auth.currentUser !== user) {
        return false;
      }

      sessions = {};

      if (!querySnapshot.empty) {
        let maxChatId = 0;
        const chatsArray: Array<{ id: string; rawMessages: any[] }> = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          chatsArray.push({
            id: docSnap.id,
            rawMessages: Array.isArray(data.messages) ? data.messages : []
          });
        });

        chatsArray.sort((a, b) => {
          const numA = a.id.includes('nuevo-') ? parseInt(a.id.split('-')[1], 10) : 0;
          const numB = b.id.includes('nuevo-') ? parseInt(b.id.split('-')[1], 10) : 0;
          return numA - numB;
        });

        chatsArray.forEach((chat) => {
          const parsedMessages: ChatMessage[] = chat.rawMessages.map(normalizeMessage);
          sessions[chat.id] = {
            sessionId: chat.id,
            messages: parsedMessages
          };

          if (chat.id.includes('nuevo-')) {
            const num = parseInt(chat.id.split('-')[1], 10);
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
  } catch (e: unknown) {
    console.warn('No se pudo cargar el historial', e);
    return false;
  }
}

/**
 * Guarda en Firestore la conversación activa del usuario
 */
async function saveConversations(): Promise<void> {
  try {
    const user: User | null = auth.currentUser;
    if (!user) return;

    const chatId = activeChatId;
    const session = sessions[chatId];
    if (!chatId || chatId === 'temporal' || !session) return;
    if (!Array.isArray(session.messages) || session.messages.length <= 1) return;

    // Convertimos a JSON plano para evitar campos undefined no aceptados por Firestore
    const messages = JSON.parse(JSON.stringify(session.messages));
    await setDoc(doc(db, "users", user.uid, "chats", chatId), { messages });
  } catch (e: unknown) {
    console.warn('No se pudo guardar el chat', e);
  }
}

function initDefaultConversations(): void {
  sessions = {
    'temporal': {
      sessionId: 'temporal',
      messages: [
        {
          id: createMessageId(),
          role: 'assistant',
          content: WELCOME_MESSAGES.cafe,
          timestamp: Date.now(),
          type: 'text'
        }
      ]
    }
  };
  activeChatId = 'temporal';
  chatCounter = 0;
}

/* =========================================================
   4. MANIPULACIÓN DEL DOM Y ELEMENTOS
   ========================================================= */

const messagesEl = document.getElementById('messages') as HTMLDivElement | null;
const composerForm = document.getElementById('composerForm') as HTMLFormElement | null;
const messageInput = document.getElementById('messageInput') as HTMLInputElement | null;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null;
const historyList = document.getElementById('historyList') as HTMLElement | null;
const newChatBtn = document.getElementById('newChatBtn') as HTMLButtonElement | null;
const quickActions = document.getElementById('quickActions') as HTMLElement | null;
const sidebar = document.getElementById('sidebar') as HTMLElement | null;
const menuToggle = document.getElementById('menuToggle') as HTMLButtonElement | null;
const overlay = document.getElementById('overlay') as HTMLDivElement | null;
const ratingModal = document.getElementById('ratingModal') as HTMLDivElement | null;
const openRatingBtn = document.getElementById('openRatingBtn') as HTMLButtonElement | null;
const closeRatingBtn = document.getElementById('closeRatingBtn') as HTMLButtonElement | null;
const submitRatingBtn = document.getElementById('submitRatingBtn') as HTMLButtonElement | null;
const stars = document.querySelectorAll<HTMLSpanElement>('.star');
const ratingThanks = document.getElementById('ratingThanks') as HTMLParagraphElement | null;
const modelSelector = document.getElementById('modelSelector') as HTMLElement | null;
const welcomeScreen = document.getElementById('welcomeScreen') as HTMLElement | null;
const chatView = document.getElementById('chatView') as HTMLElement | null;
const themeBtn = document.getElementById('themeBtn') as HTMLButtonElement | null;
const iconSun = themeBtn?.querySelector('.icon-sun') as SVGElement | null;
const iconMoon = themeBtn?.querySelector('.icon-moon') as SVGElement | null;

// Modal de Reserva
const reservationModal = document.getElementById('reservationModal') as HTMLDivElement | null;
const closeReservationBtn = document.getElementById('closeReservationBtn') as HTMLButtonElement | null;
const reservationStep1 = document.getElementById('reservationStep1') as HTMLDivElement | null;
const reservationStep2 = document.getElementById('reservationStep2') as HTMLDivElement | null;
const reservationStep3 = document.getElementById('reservationStep3') as HTMLDivElement | null;
const packageGrid = document.getElementById('packageGrid') as HTMLDivElement | null;
const reservationForm = document.getElementById('reservationForm') as HTMLFormElement | null;
const reservationSummary = document.getElementById('reservationSummary') as HTMLElement | null;
const reservationCodeEl = document.getElementById('reservationCode') as HTMLElement | null;
const closeReservationSuccessBtn = document.getElementById('closeReservationSuccessBtn') as HTMLButtonElement | null;

// Modal de Perfil
const userBtn = document.getElementById('userBtn') as HTMLButtonElement | null;
const profileModal = document.getElementById('profileModal') as HTMLDivElement | null;
const profileEmail = document.getElementById('profileEmail') as HTMLParagraphElement | null;
const btnLogout = document.getElementById('btnLogout') as HTMLButtonElement | null;
const btnCloseProfile = document.getElementById('btnCloseProfile') as HTMLButtonElement | null;

/* =========================================================
   5. GESTIÓN DEL TEMA (MODO OSCURO / CLARO)
   ========================================================= */

const THEME_KEY: string = 'pousito-theme';

export function applyTheme(theme: ThemeMode): void {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  document.documentElement.classList.remove('preload-dark');
  if (iconSun) iconSun.style.display = isDark ? 'none' : 'block';
  if (iconMoon) iconMoon.style.display = isDark ? 'block' : 'none';
  if (themeBtn) {
    themeBtn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
  localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme(): void {
  const isDark = document.body.classList.contains('dark-mode');
  applyTheme(isDark ? 'light' : 'dark');
}

export function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

themeBtn?.addEventListener('click', toggleTheme);

/* =========================================================
   6. CAMBIO DE VISTAS (WELCOME <-> CHAT)
   ========================================================= */

export function switchToChatView(): void {
  if (!welcomeVisible) return;
  welcomeVisible = false;
  welcomeScreen?.classList.add('hidden');
  chatView?.classList.remove('hidden');
}

export function switchToWelcomeView(): void {
  welcomeVisible = true;
  welcomeScreen?.classList.remove('hidden');
  chatView?.classList.add('hidden');
}

/* =========================================================
   7. RENDERIZADO DE MENSAJES Y SCROLL
   ========================================================= */

export function scrollToBottom(): void {
  if (messagesEl) {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
  }
}

export function appendMessageToDOM(msg: ChatMessage, animate: boolean = true): void {
  if (!messagesEl) return;

  const row = document.createElement('div');
  const roleClass = msg.role === 'assistant' ? 'bot assistant' : 'user';
  row.className = `message-row ${roleClass}`;
  if (!animate) row.style.animation = 'none';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  if (msg.role === 'assistant') {
    avatar.innerHTML = `<img src="${BOT_IMAGE_URL}" alt="Pousito">`;
  } else {
    avatar.innerHTML = AVATAR_USER_SVG;
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble message-bubble';

  const safeText = (msg.content || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  if (msg.role === 'assistant' && msg.type === 'packages') {
    bubble.innerHTML = safeText;
    const grid = document.createElement('div');
    grid.className = 'chat-package-grid';

    PACKAGES.forEach((pkg: PackageItem) => {
      const btn = document.createElement('button');
      btn.className = 'chat-package-btn ripple';
      btn.dataset.package = pkg.id;
      btn.innerHTML = `
        <span class="chat-package-header">
          ${pkg.icon}
          <span>${pkg.name}</span>
        </span>
        <small>${pkg.price}</small>
      `;
      btn.addEventListener('click', () => openReservationModal(pkg.id));
      grid.appendChild(btn);
    });

    bubble.appendChild(grid);
  } else {
    bubble.innerHTML = safeText;
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
}

export function renderMessages(): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = '';
  const currentSession = sessions[activeChatId];
  const msgs = currentSession ? currentSession.messages : [];
  msgs.forEach((msg: ChatMessage) => appendMessageToDOM(msg, false));
  scrollToBottom();
}

/* =========================================================
   8. INDICADOR DE ESCRITURA Y EFECTO MÁQUINA DE ESCRIBIR
   ========================================================= */

export function showTypingIndicator(): void {
  if (!messagesEl) return;
  if (document.getElementById('typingIndicator')) return;

  const row = document.createElement('div');
  row.className = 'message-row bot assistant typing-indicator';
  row.id = 'typingIndicator';

  row.innerHTML = `
    <div class="message-avatar"><img src="${BOT_IMAGE_URL}" alt="Pousito"></div>
    <div class="bubble message-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
      Pousito está pensando...
    </div>
  `;
  messagesEl.appendChild(row);
  scrollToBottom();
}

export function removeTypingIndicator(): void {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

export function typeWriter(element: HTMLElement, text: string, speed: number = 18): Promise<void> {
  return new Promise<void>((resolve) => {
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

export async function appendTypedBotMessage(text: string): Promise<void> {
  if (!messagesEl) return;

  const row = document.createElement('div');
  row.className = 'message-row bot assistant typing-target';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = `<img src="${BOT_IMAGE_URL}" alt="Pousito">`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble message-bubble';
  bubble.textContent = '';

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();

  await typeWriter(bubble, text);
  row.classList.remove('typing-target');
  scrollToBottom();
}

function setSendLoading(loading: boolean): void {
  if (!sendBtn) return;
  sendBtn.disabled = loading;
  const icon = sendBtn.querySelector<SVGElement>('.send-icon');
  const spinner = sendBtn.querySelector<HTMLSpanElement>('.spinner');
  if (icon) icon.style.display = loading ? 'none' : 'block';
  if (spinner) spinner.style.display = loading ? 'block' : 'none';
}

/* =========================================================
   9. ENVÍO DE MENSAJES Y COMUNICACIÓN ASÍNCRONA (FETCH API)
   ========================================================= */

function isReservationIntent(text: string): boolean {
  const t = text.toLowerCase();
  const keywords = ['reservar', 'reservación', 'reserva', 'apartar mesa', 'apartado', 'paquete', 'cumpleaños', 'renta'];
  return keywords.some(k => t.includes(k));
}

/**
 * Procesa y envía un mensaje de usuario utilizando async/await.
 * Conecta con el endpoint REST y procesa la respuesta tipada.
 */
export async function sendUserMessage(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const gen = sessionGen;
  switchToChatView();

  // Convertir el chat temporal en un nuevo-X real si es necesario
  if (activeChatId === 'temporal') {
    chatCounter += 1;
    const newId = `nuevo-${chatCounter}`;

    const tempSession = sessions['temporal'];
    sessions[newId] = {
      sessionId: newId,
      messages: tempSession ? tempSession.messages : []
    };
    delete sessions['temporal'];
    activeChatId = newId;

    if (historyList) {
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
  }

  const currentSession = sessions[activeChatId];
  if (!currentSession) {
    sessions[activeChatId] = { sessionId: activeChatId, messages: [] };
  }

  // Verificar intención de reservación directa
  if (isReservationIntent(trimmed)) {
    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      type: 'text'
    };
    sessions[activeChatId].messages.push(userMsg);
    appendMessageToDOM(userMsg);
    await saveConversations();

    if (messageInput) messageInput.value = '';
    showTypingIndicator();

    await new Promise<void>((r) => setTimeout(r, 600));
    removeTypingIndicator();
    if (gen !== sessionGen) return;

    const botMsg: ChatMessage = {
      id: createMessageId(),
      role: 'assistant',
      content: '¡Claro! Elige el paquete que más te guste y te abro el formulario de reserva:',
      timestamp: Date.now(),
      type: 'packages'
    };
    sessions[activeChatId].messages.push(botMsg);
    appendMessageToDOM(botMsg);
    await saveConversations();
    scrollToBottom();
    return;
  }

  // Mensaje de usuario normal
  const userMsg: ChatMessage = {
    id: createMessageId(),
    role: 'user',
    content: trimmed,
    timestamp: Date.now(),
    type: 'text'
  };
  sessions[activeChatId].messages.push(userMsg);
  appendMessageToDOM(userMsg);
  await saveConversations();

  if (messageInput) messageInput.value = '';
  setSendLoading(true);
  showTypingIndicator();

  try {
    // POST al endpoint de la Cloud Function (Firebase Functions v2 / Python).
    // El System Prompt y la llamada a Groq se gestionan en el backend.
    // El typing indicator permanece activo hasta recibir la respuesta.
    const botResponse: BotResponse = await sendChatMessage(trimmed, activeChatId, activeModel);

    removeTypingIndicator();
    if (gen !== sessionGen) return;

    const botMsg: ChatMessage = {
      id: createMessageId(),
      role: 'assistant',
      content: botResponse.reply,
      timestamp: Date.now(),
      type: 'text'
    };
    sessions[activeChatId].messages.push(botMsg);
    await saveConversations();

    if (botResponse.status === 'success') {
      await appendTypedBotMessage(botResponse.reply);
    } else {
      appendMessageToDOM(botMsg);
    }
    scrollToBottom();

  } catch (error: unknown) {
    console.error("Error al procesar el mensaje:", error);
    removeTypingIndicator();
    if (gen !== sessionGen) return;

    const errorMsg: ChatMessage = {
      id: createMessageId(),
      role: 'assistant',
      content: 'Lo siento, tuve un problema al conectarme. Por favor intenta de nuevo.',
      timestamp: Date.now(),
      type: 'text'
    };
    sessions[activeChatId].messages.push(errorMsg);
    await saveConversations();
    appendMessageToDOM(errorMsg);
    scrollToBottom();
  } finally {
    setSendLoading(false);
  }
}

composerForm?.addEventListener('submit', (e: SubmitEvent) => {
  e.preventDefault();
  if (messageInput) {
    sendUserMessage(messageInput.value);
  }
});

/* =========================================================
   10. TARJETAS DE BIENVENIDA Y ACCIONES RÁPIDAS
   ========================================================= */

document.querySelectorAll<HTMLButtonElement>('.welcome-card-item').forEach((card) => {
  card.addEventListener('click', () => {
    if (card.dataset.action === 'open-reservation') {
      openReservationModal();
    } else if (card.dataset.message) {
      sendUserMessage(card.dataset.message);
    }
  });
});

quickActions?.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  const btn = target?.closest<HTMLButtonElement>('.quick-btn');
  if (!btn) return;

  if (btn.dataset.action === 'open-reservation') {
    openReservationModal();
  } else if (btn.dataset.message) {
    sendUserMessage(btn.dataset.message);
  }
});

/* =========================================================
   11. SELECTOR DE MODELOS
   ========================================================= */

modelSelector?.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  const pill = target?.closest<HTMLButtonElement>('.model-pill');
  if (!pill) return;

  document.querySelectorAll('.model-pill').forEach((p) => p.classList.remove('active'));
  pill.classList.add('active');
  activeModel = (pill.dataset.model || 'modelo1') as ModelId;
});

/* =========================================================
   12. HISTORIAL DE CHAT Y NAVEGACIÓN
   ========================================================= */

export function setActiveChat(chatId: string): void {
  if (!sessions[chatId]) return;
  activeChatId = chatId;
  saveConversations();

  document.querySelectorAll<HTMLButtonElement>('.history-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.chat === chatId);
  });

  renderMessages();
  if (sessions[chatId].messages.length > 1) {
    switchToChatView();
  } else {
    switchToWelcomeView();
  }
}

newChatBtn?.addEventListener('click', () => {
  chatCounter += 1;
  const newId = `nuevo-${chatCounter}`;
  sessions[newId] = {
    sessionId: newId,
    messages: [
      {
        id: createMessageId(),
        role: 'assistant',
        content: WELCOME_MESSAGES.cafe,
        timestamp: Date.now(),
        type: 'text'
      }
    ]
  };
  saveConversations();

  if (historyList) {
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

  setActiveChat(newId);
  switchToWelcomeView();
  closeSidebarOnMobile();
});

historyList?.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  const item = target?.closest<HTMLButtonElement>('.history-item');
  if (!item || !item.dataset.chat) return;
  setActiveChat(item.dataset.chat);
  closeSidebarOnMobile();
});

// Menú Hamburguesa en dispositivos móviles
menuToggle?.addEventListener('click', () => {
  if (sidebar?.classList.contains('open')) {
    closeSidebarOnMobile();
  } else {
    openSidebarOnMobile();
  }
});

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
    closeSidebarOnMobile();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 720) {
    closeSidebarOnMobile();
  }
});

overlay?.addEventListener('click', closeSidebarOnMobile);

function openSidebarOnMobile(): void {
  sidebar?.classList.add('open');
  overlay?.classList.add('visible');
  menuToggle?.classList.add('active');
  menuToggle?.setAttribute('aria-expanded', 'true');
  menuToggle?.setAttribute('aria-label', 'Cerrar menú');
}

function closeSidebarOnMobile(): void {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('visible');
  menuToggle?.classList.remove('active');
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.setAttribute('aria-label', 'Abrir menú');
}

/* =========================================================
   13. CARRUSELES
   ========================================================= */

export function initCarousel(containerId: string, autoPlayMs: number = 4000): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const slides = container.querySelectorAll<HTMLElement>('.carousel-slide');
  const dotsWrapper = container.querySelector<HTMLElement>('.carousel-dots');
  if (!slides.length || !dotsWrapper) return;

  let currentIndex = 0;
  let timer: number | null = null;

  dotsWrapper.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToSlide(i));
    dotsWrapper.appendChild(dot);
  });
  const dots = dotsWrapper.querySelectorAll<HTMLElement>('.dot');

  function goToSlide(index: number): void {
    slides[currentIndex]?.classList.remove('active');
    dots[currentIndex]?.classList.remove('active');
    currentIndex = (index + slides.length) % slides.length;
    slides[currentIndex]?.classList.add('active');
    dots[currentIndex]?.classList.add('active');
  }

  function nextSlide(): void {
    goToSlide(currentIndex + 1);
  }

  function startAutoPlay(): void {
    timer = window.setInterval(nextSlide, autoPlayMs);
  }

  function resetAutoPlay(): void {
    if (timer !== null) window.clearInterval(timer);
    startAutoPlay();
  }

  const nextBtn = container.querySelector<HTMLButtonElement>('.carousel-arrow.next');
  const prevBtn = container.querySelector<HTMLButtonElement>('.carousel-arrow.prev');

  nextBtn?.addEventListener('click', () => { nextSlide(); resetAutoPlay(); });
  prevBtn?.addEventListener('click', () => { goToSlide(currentIndex - 1); resetAutoPlay(); });

  startAutoPlay();
}

/* =========================================================
   14. MODAL DE CALIFICACIÓN
   ========================================================= */

openRatingBtn?.addEventListener('click', () => ratingModal?.classList.add('visible'));
closeRatingBtn?.addEventListener('click', closeRatingModal);
ratingModal?.addEventListener('click', (e: MouseEvent) => {
  if (e.target === ratingModal) closeRatingModal();
});

function closeRatingModal(): void {
  ratingModal?.classList.remove('visible');
  selectedRating = 0;
  highlightStars(0);
  ratingThanks?.classList.remove('visible');
  if (submitRatingBtn) submitRatingBtn.style.display = 'block';
}

function highlightStars(value: number): void {
  stars.forEach((star) => {
    const starVal = parseInt(star.dataset.value || '0', 10);
    star.classList.toggle('selected', starVal <= value);
  });
}

stars.forEach((star) => {
  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.value || '0', 10);
    highlightStars(selectedRating);
  });
  star.addEventListener('mouseenter', () => {
    highlightStars(parseInt(star.dataset.value || '0', 10));
  });
});

document.getElementById('stars')?.addEventListener('mouseleave', () => {
  highlightStars(selectedRating);
});

submitRatingBtn?.addEventListener('click', () => {
  if (selectedRating === 0) return;
  ratingThanks?.classList.add('visible');
  if (submitRatingBtn) submitRatingBtn.style.display = 'none';
});

/* =========================================================
   15. MODAL DE RESERVACIÓN PASO A PASO
   ========================================================= */

export function openReservationModal(preselectPackageId: string | null = null): void {
  if (!auth.currentUser) {
    document.getElementById('authModal')?.classList.add('visible');
    return;
  }

  if (reservationStep1) reservationStep1.style.display = 'block';
  if (reservationStep2) reservationStep2.style.display = 'none';
  if (reservationStep3) reservationStep3.style.display = 'none';
  reservationForm?.reset();
  showReservationError('');
  selectedPackage = null;
  document.querySelectorAll('.package-card').forEach((c) => c.classList.remove('selected'));

  if (preselectPackageId) {
    const card = document.querySelector<HTMLButtonElement>(`.package-card[data-package="${preselectPackageId}"]`);
    if (card) {
      card.classList.add('selected');
      const foundPkg = PACKAGES.find(p => p.id === preselectPackageId);
      selectedPackage = foundPkg || {
        id: card.dataset.package || '',
        name: card.querySelector('.package-name')?.textContent || '',
        price: card.querySelector('.package-price')?.textContent || '',
        desc: '',
        icon: ''
      };
      if (reservationSummary) {
        reservationSummary.textContent = `${selectedPackage.name} — ${selectedPackage.price}`;
      }
      if (reservationStep1) reservationStep1.style.display = 'none';
      if (reservationStep2) reservationStep2.style.display = 'block';
    }
  }

  reservationModal?.classList.add('visible');
}

export function closeReservationModal(): void {
  reservationModal?.classList.remove('visible');
  setTimeout(() => {
    if (reservationStep1) reservationStep1.style.display = 'block';
    if (reservationStep2) reservationStep2.style.display = 'none';
    if (reservationStep3) reservationStep3.style.display = 'none';
    selectedPackage = null;
    document.querySelectorAll('.package-card').forEach((c) => c.classList.remove('selected'));
    reservationForm?.reset();
  }, 250);
}

closeReservationBtn?.addEventListener('click', closeReservationModal);
closeReservationSuccessBtn?.addEventListener('click', closeReservationModal);
reservationModal?.addEventListener('click', (e: MouseEvent) => {
  if (e.target === reservationModal) closeReservationModal();
});

packageGrid?.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  const card = target?.closest<HTMLButtonElement>('.package-card');
  if (!card) return;

  document.querySelectorAll('.package-card').forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');

  const pkgId = card.dataset.package;
  const foundPkg = PACKAGES.find(p => p.id === pkgId);
  selectedPackage = foundPkg || {
    id: pkgId || '',
    name: card.querySelector('.package-name')?.textContent || '',
    price: card.querySelector('.package-price')?.textContent || '',
    desc: '',
    icon: ''
  };

  setTimeout(() => {
    if (reservationStep1) reservationStep1.style.display = 'none';
    if (reservationStep2) reservationStep2.style.display = 'block';
    if (reservationSummary && selectedPackage) {
      reservationSummary.textContent = `${selectedPackage.name} — ${selectedPackage.price}`;
    }
  }, 200);
});

function buildReservationCode(name: string, phone: string): string {
  const letters = String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'XXXX';
  const digits = String(phone).replace(/\D/g, '').slice(0, 4).padEnd(4, '0');
  const rnd = () => String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `POUSITO-${letters}-${digits}-${rnd()}${rnd()}`;
}

async function generateUniqueReservationCode(name: string, phone: string): Promise<string> {
  let code = buildReservationCode(name, phone);
  for (let i = 0; i < 5; i++) {
    try {
      const existing = await getDoc(doc(db, 'reservations', code));
      if (!existing.exists()) return code;
    } catch {
      return code;
    }
    code = buildReservationCode(name, phone);
  }
  return code;
}

function showReservationError(message: string): void {
  let el = document.getElementById('reservationError') as HTMLParagraphElement | null;
  if (!el && reservationForm) {
    el = document.createElement('p');
    el.id = 'reservationError';
    el.style.cssText = 'color:#e53935;font-size:13px;font-weight:600;text-align:center;margin-top:12px;';
    reservationForm.appendChild(el);
  }
  if (el) {
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
  }
}

reservationForm?.addEventListener('submit', async (e: SubmitEvent) => {
  e.preventDefault();
  showReservationError('');

  const user = auth.currentUser;
  if (!user) {
    closeReservationModal();
    document.getElementById('authModal')?.classList.add('visible');
    return;
  }

  if (!reservationForm) return;
  const formData = new FormData(reservationForm);
  const data: ReservationData = {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    date: String(formData.get('date') || ''),
    time: String(formData.get('time') || ''),
    people: Number(formData.get('people')) || 1
  };

  const submitBtn = reservationForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const originalText = submitBtn?.textContent || 'Confirmar reserva';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Procesando reserva...';
  }

  let code: string;
  try {
    code = await generateUniqueReservationCode(data.name, data.phone);

    const packageCard = selectedPackage
      ? document.querySelector<HTMLButtonElement>(`.package-card[data-package="${selectedPackage.id}"]`)
      : null;

    await setDoc(doc(db, 'reservations', code), {
      codigo: code,
      nombre: data.name,
      telefono: data.phone,
      fecha: data.date,
      hora: data.time,
      personas: data.people,
      paquete: selectedPackage?.name || '',
      paqueteId: selectedPackage?.id || '',
      precio: selectedPackage?.price || '',
      precioNumero: packageCard ? Number(packageCard.dataset.price) : (selectedPackage?.priceNumber || null),
      estado: 'confirmada',
      userId: user.uid,
      email: user.email || '',
      creadaEn: serverTimestamp()
    });
  } catch (error: unknown) {
    console.error('No se pudo guardar la reserva', error);
    showReservationError('No pudimos guardar tu reserva. Revisa tu conexión e inténtalo de nuevo.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
    return;
  }

  if (reservationCodeEl) reservationCodeEl.textContent = code;
  if (reservationStep2) reservationStep2.style.display = 'none';
  if (reservationStep3) reservationStep3.style.display = 'block';

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }

  const summaryText = `Reserva confirmada:\n` +
    `• Paquete: ${selectedPackage?.name || ''}\n` +
    `• Nombre: ${data.name}\n` +
    `• Fecha: ${data.date} a las ${data.time}\n` +
    `• Personas: ${data.people}\n` +
    `• Código: ${code}\n\n` +
    `Presenta este código el día de tu reserva. ¡Te esperamos! Ñam ñam ñam...`;

  if (!welcomeVisible && sessions[activeChatId]) {
    const botMsg: ChatMessage = {
      id: createMessageId(),
      role: 'assistant',
      content: summaryText,
      timestamp: Date.now(),
      type: 'text'
    };
    sessions[activeChatId].messages.push(botMsg);
    await saveConversations();
    appendMessageToDOM(botMsg);
    scrollToBottom();
  }
});

/* =========================================================
   16. PERFILES DE USUARIO Y CICLO DE VIDA DE LA SESIÓN
   ========================================================= */

async function ensureUserProfile(user: User): Promise<void> {
  try {
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, {
      email: user.email || '',
      ultimaActualizacion: serverTimestamp()
    }, { merge: true });

    setTimeout(async () => {
      try {
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
        const snap = await getDoc(ref);
        if (!snap.exists() || !snap.data()?.nombre) {
          const fallback = user.displayName || (user.email || '').split('@')[0];
          await setDoc(ref, { nombre: fallback }, { merge: true });
        }
      } catch (e: unknown) {
        console.warn('No se pudo completar el perfil del usuario', e);
      }
    }, 1200);
  } catch (e: unknown) {
    console.warn('No se pudo registrar el perfil del usuario', e);
  }
}

function resetSession(): void {
  sessionGen++;
  sessions = {};
  chatCounter = 0;
  activeChatId = 'temporal';
  if (historyList) historyList.innerHTML = '';
  if (messagesEl) messagesEl.innerHTML = '';
  switchToWelcomeView();
}

export async function initChat(): Promise<void> {
  initTheme();
  initCarousel('carouselPlace', 4000);
  initCarousel('carouselProducts', 5000);

  // Inicializar ripple
  document.querySelectorAll<HTMLElement>(
    '.new-chat-btn, .send-btn, .quick-btn, .submit-rating-btn, .package-card, .welcome-card-item, .icon-circle-btn'
  ).forEach((btn) => btn.classList.add('ripple'));

  const gen = sessionGen;
  if (historyList) historyList.innerHTML = '';

  const hasSaved = await loadConversations(gen);
  if (gen !== sessionGen) return;

  if (!sessions['temporal']) {
    sessions['temporal'] = {
      sessionId: 'temporal',
      messages: [
        {
          id: createMessageId(),
          role: 'assistant',
          content: WELCOME_MESSAGES.cafe,
          timestamp: Date.now(),
          type: 'text'
        }
      ]
    };
  }
  activeChatId = 'temporal';

  if (hasSaved && chatCounter > 0 && historyList) {
    for (let i = 1; i <= chatCounter; i++) {
      const id = `nuevo-${i}`;
      if (sessions[id]) {
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

  document.querySelectorAll<HTMLButtonElement>('.history-item').forEach((el) => {
    el.classList.remove('active');
  });

  renderMessages();
  switchToWelcomeView();
}

/* =========================================================
   17. OBSERVAR ESTADO DE AUTENTICACIÓN
   ========================================================= */

onAuthStateChanged(auth, async (user: User | null) => {
  const authModal = document.getElementById('authModal') as HTMLDivElement | null;
  const registerModal = document.getElementById('registerModal') as HTMLDivElement | null;

  if (user) {
    resetSession();
    authModal?.classList.remove('visible');
    registerModal?.classList.remove('visible');
    sessionStorage.removeItem('pousito_invitado');
    await ensureUserProfile(user);

    const gen = sessionGen;
    setTimeout(() => {
      if (gen === sessionGen) initChat();
    }, 150);
  } else {
    if (!sessionStorage.getItem('pousito_invitado')) {
      resetSession();
      registerModal?.classList.remove('visible');
      authModal?.classList.add('visible');
    } else {
      authModal?.classList.remove('visible');
      registerModal?.classList.remove('visible');
    }
  }
});

// Evento modo invitado
window.addEventListener('modoInvitado', () => {
  sessionStorage.setItem('pousito_invitado', 'true');
  if (Object.keys(sessions).length === 0) {
    initDefaultConversations();
    activeChatId = 'temporal';
    if (historyList) historyList.innerHTML = '';
    renderMessages();
    switchToWelcomeView();
  }
});

/* =========================================================
   18. MODAL DE PERFIL Y CIERRE DE SESIÓN
   ========================================================= */

userBtn?.addEventListener('click', () => {
  if (auth.currentUser) {
    if (profileEmail) profileEmail.textContent = auth.currentUser.email || '';
    document.getElementById('authModal')?.classList.remove('visible');
    document.getElementById('registerModal')?.classList.remove('visible');
    profileModal?.classList.add('visible');
  } else {
    profileModal?.classList.remove('visible');
    document.getElementById('registerModal')?.classList.remove('visible');
    document.getElementById('authModal')?.classList.add('visible');
  }
});

btnCloseProfile?.addEventListener('click', () => {
  profileModal?.classList.remove('visible');
});

btnLogout?.addEventListener('click', async () => {
  profileModal?.classList.remove('visible');
  try {
    sessionStorage.clear();
    await auth.signOut();
    resetSession();
    document.getElementById('registerModal')?.classList.remove('visible');
    document.getElementById('authModal')?.classList.add('visible');
  } catch (error: unknown) {
    console.error("Error al cerrar sesión", error);
  }
});