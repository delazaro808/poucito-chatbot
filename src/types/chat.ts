// =========================================================
// POUSITO CAFÉ — INTERFACES Y TIPOS DEL CHATBOT
// =========================================================

/**
 * Representa un mensaje individual dentro del chat.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'packages';
}

/**
 * Representa una sesión o conversación completa de chat.
 */
export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  title?: string;
  createdAt?: number;
}

/**
 * Respuesta estructurada devuelta por la API del bot / LLM.
 */
export interface BotResponse {
  reply: string;
  status: 'success' | 'error';
}

/**
 * Paquete de reservación de mesa.
 */
export interface PackageItem {
  id: string;
  name: string;
  price: string;
  desc: string;
  icon: string;
  priceNumber?: number;
}

/**
 * Datos del formulario de reservación.
 */
export interface ReservationData {
  name: string;
  phone: string;
  date: string;
  time: string;
  people: number;
}

/**
 * Estructura de mensaje enviada a endpoints compatibles con OpenAI / Groq.
 */
export interface ApiRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ThemeMode = 'light' | 'dark';

export type ModelId = 'modelo1' | 'modelo2' | 'modelo3';

