// =========================================================
// POUSITO CAFÉ — Servicio de Chat (Cloud Function Backend)
// =========================================================
//
// Este módulo envía los mensajes del usuario al endpoint de la
// Firebase Cloud Function (Python) que maneja la llamada a Groq.
// NO contiene ninguna API Key de Groq ni llama directamente a
// la API de Groq — esa lógica vive en /functions/main.py.
// =========================================================

import type { BotResponse, ModelId } from '../types/chat';

// URL de la Cloud Function inyectada por Vite desde .env.local / .env
// - Desarrollo:  http://127.0.0.1:5001/poucito-69937/us-central1/chat_pousito
// - Producción:  https://us-central1-poucito-69937.cloudfunctions.net/chat_pousito
const CLOUD_FUNCTION_URL: string =
  import.meta.env.VITE_CLOUD_FUNCTION_URL ||
  'https://us-central1-poucito-69937.cloudfunctions.net/chat_pousito';

/**
 * Payload que se envía a la Cloud Function.
 */
interface ChatPayload {
  mensaje: string;
  sessionId: string;
  modelo?: ModelId;
}

/**
 * Envía el mensaje del usuario a la Cloud Function de Firebase y devuelve
 * la respuesta tipada como BotResponse.
 *
 * @param mensaje   - Texto que escribió el usuario.
 * @param sessionId - ID de la sesión/conversación activa.
 * @param modelo    - Slug del modelo a usar (modelo1 | modelo2 | modelo3).
 */
export async function sendChatMessage(
  mensaje: string,
  sessionId: string,
  modelo: ModelId = 'modelo1'
): Promise<BotResponse> {
  const payload: ChatPayload = { mensaje, sessionId, modelo };

  let response: Response;
  try {
    response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (networkError: unknown) {
    console.error('[chatApi] Error de red al llamar la Cloud Function:', networkError);
    return {
      reply: 'Lo siento, tuve un problema al conectarme. Verifica tu conexión e intenta de nuevo.',
      status: 'error',
    };
  }

  // Intentar parsear siempre; la CF siempre devuelve JSON
  let data: BotResponse;
  try {
    data = (await response.json()) as BotResponse;
  } catch {
    console.error('[chatApi] La respuesta de la Cloud Function no es JSON válido.');
    return {
      reply: 'Recibí una respuesta inesperada del servidor. Por favor intenta de nuevo.',
      status: 'error',
    };
  }

  if (!response.ok) {
    // La Cloud Function devuelve {reply, status:"error"} con 4xx / 5xx
    console.error(`[chatApi] Cloud Function respondió con HTTP ${response.status}:`, data);
    return {
      reply: data.reply || 'Lo siento, tuve un problema al conectarme. Por favor intenta de nuevo.',
      status: 'error',
    };
  }

  return data;
}
