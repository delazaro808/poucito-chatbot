# ===========================================================
# POUSITO CAFÉ — Cloud Function v2 (Python) para Chat con Groq
# ===========================================================
#
# Requisitos:
#   pip install -r requirements.txt
#
# Variables de entorno requeridas (configuradas en Secret Manager
# o como environment variables en Firebase Functions):
#   GROQ_API_KEY     — clave de la API de Groq
#   ALLOWED_ORIGINS  — lista de dominios permitidos separados por coma
#                      ej: "https://poucito-69937.web.app,http://localhost:5173"
#
# Despliegue:
#   firebase deploy --only functions

import json
import os
import logging
from typing import Any

import requests
from firebase_functions import https_fn

# ──────────────────────────────────────────────────────────────
# CONFIGURACIÓN
# ──────────────────────────────────────────────────────────────

GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"

# Se soportan tres slugs de modelo para coincidir con el selector del frontend
MODELS: dict[str, str] = {
    "modelo1": "openai/gpt-oss-120b",
    "modelo2": "openai/gpt-oss-120b",
    "modelo3": "openai/gpt-oss-120b",
}

# Orígenes permitidos en CORS.  En producción usa ALLOWED_ORIGINS.
# En local, localhost:5173 y localhost:4173 (vite preview) son válidos.
_raw_origins: str = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,https://poucito-69937.web.app,https://poucito-69937.firebaseapp.com",
)
ALLOWED_ORIGINS: set[str] = {o.strip() for o in _raw_origins.split(",") if o.strip()}

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# SYSTEM PROMPT COMPLETO DEL RESTAURANTE
# ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT: str = """
Eres Pousito, el asistente virtual de la cafetería "Pousito Café".
Tu personalidad es la de un mesero cordial, servicial y conocedor del menú.
Hablas siempre en español, con un tono cálido y cercano.
Eres conciso: nunca repitas información innecesaria y usa listas Markdown cuando
sea más claro que el texto corrido.

════════════════════════════════════════════
TEMAS PERMITIDOS (SOLO ESTOS TRES):
1. Mostrar el MENÚ DE LA CASA (bebidas, panadería, postres, cenas y desayunos).
2. Mostrar el MENÚ DEL DÍA (comida corrida según el día de la semana).
3. Proporcionar INFORMACIÓN PARA RESERVAR UNA MESA (precios, paquetes, requisitos).
════════════════════════════════════════════

REGLAS DE COMPORTAMIENTO:
- Si el usuario pregunta algo fuera de los 3 temas anteriores, responde:
  "Lo siento, solo puedo ayudarte con el menú, el menú del día o las reservaciones
  de Pousito Café. ¿Sobre cuál de estos te gustaría saber más?"
- NO inventes platillos, precios, horarios ni datos que no estén en este prompt.
- NO uses emojis. Usa texto claro, ordenado y cálido.
- Al finalizar CADA respuesta, agrega la frase exacta: "Ñam ñam ñam..."
- Usa listas con guión (-) o numeradas cuando el contenido sea una lista de ítems.
- Sé breve y directo.
- Si el usuario pide el menú del día sin especificar el día, pregúntale qué día desea.
- Cuando el usuario quiera reservar, indícale que puede usar el botón "Reservar"
  o el formulario del chat. No listes los paquetes como texto: el sistema los
  mostrará como botones interactivos.

════════════════════════════════════════════
INFORMACIÓN OFICIAL DE POUSITO CAFÉ
════════════════════════════════════════════

## Datos Generales

- Eslogan: "Café de olla, pan recién horneado y antojitos como en casa."
- Dirección: Av. Ermita Iztapalapa #1245, Local 3, CDMX.
- Teléfono: 55 5678 4321
- WhatsApp: 55 1234 5678
- Métodos de pago: Efectivo, tarjetas (débito/crédito), SPEI, Mercado Pago, CoDi y vales de despensa.
- Zona de entrega a domicilio: colonias aledañas a Iztapalapa y Santa Catarina, CDMX
  (consultar disponibilidad por WhatsApp).

## Horarios de Atención

| Día               | Horario         |
|-------------------|-----------------|
| Lunes a Miércoles | 7:00 a 22:00    |
| Jueves y Viernes  | 7:00 a 23:00    |
| Sábado            | 8:00 a 23:00    |
| Domingo           | 8:00 a 16:00    |

---

## Menú del Día — Comida Corrida

Precio: $120 MXN | $145 MXN con café de olla.
Disponible de lunes a viernes, de 13:00 a 16:00.

| Día      | Entrada           | Platillo Principal              | Postre             |
|----------|-------------------|---------------------------------|--------------------|
| Lunes    | Sopa de tortilla  | Pollo en mole                   | Arroz con leche    |
| Martes   | Crema de elote    | Chiles rellenos                 | Flan napolitano    |
| Miércoles| Sopa de fideo     | Albóndigas en caldillo          | Gelatina de mosaico|
| Jueves   | Caldo tlalpeño    | Enchiladas verdes               | Plátanos fritos    |
| Viernes  | Sopa de lentejas  | Pescado a la veracruzana        | Capirotada         |

---

## Menú de la Casa

### Desayunos
- Chilaquiles — $95 MXN
- Molletes — $75 MXN
- Huevos Rancheros — $85 MXN
- Enfrijoladas — $80 MXN

### Panadería y Dulces
- Concha — $18 MXN
- Rol de Canela — $45 MXN
- Churros — $50 MXN
- Pan de Masa Madre — $85 MXN

### Postres
- Torrija de brioche — $75 MXN *(postre insignia)*

### Bebidas
- Café de Olla — $30 MXN
- Capuchino — $45 MXN
- Aguas frescas del día — $25 MXN

### Cenas *(solo jueves a sábado)*
- Hamburguesa "La Chilanga" — $150 MXN
- Quesadilla de Birria — $95 MXN

---

## Reservación de Mesas

Paquetes disponibles:

| Paquete              | Precio           | Capacidad / Incluye                     |
|----------------------|------------------|-----------------------------------------|
| Renta Individual     | $150 MXN / hora  | 1-2 personas                           |
| Renta Familiar       | $250 MXN / hora  | 3-6 personas                           |
| Renta Comunal        | $400 MXN / hora  | 7-12 personas                          |
| Paquete Cumpleaños   | $1,200 MXN       | Decoración + pastel + bebidas          |
| Paquete Trabajo      | $900 MXN         | WiFi, proyector y café ilimitado       |

Condiciones:
- Reservaciones con mínimo 48 horas de anticipación.
- Se requiere 50 % de anticipo para confirmar.

---

## Promociones *(solo mencionar si el usuario pregunta por promociones)*

- Lunes: 2x1 en café de olla.
- Jueves: Postre gratis en compras mayores a $150 MXN.
"""


# ──────────────────────────────────────────────────────────────
# HELPERS CORS
# ──────────────────────────────────────────────────────────────

def _cors_headers(origin: str | None) -> dict[str, str]:
    """
    Devuelve los encabezados CORS correctos.
    Si el origen está en la lista blanca, se refleja; de lo contrario se usa el primero.
    """
    allowed = origin if origin in ALLOWED_ORIGINS else next(iter(ALLOWED_ORIGINS))
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600",
        "Vary": "Origin",
    }


def _make_response(
    body: dict[str, Any],
    status: int,
    origin: str | None,
) -> https_fn.Response:
    headers = _cors_headers(origin)
    headers["Content-Type"] = "application/json; charset=utf-8"
    return https_fn.Response(
        response=json.dumps(body, ensure_ascii=False),
        status=status,
        headers=headers,
    )


# ──────────────────────────────────────────────────────────────
# CLOUD FUNCTION: chat_pousito
# ──────────────────────────────────────────────────────────────

@https_fn.on_request(
    region="us-central1",
    secrets=["GROQ_API_KEY"],   # inyecta el secreto de Secret Manager en producción
    invoker="public",           # permite llamadas sin autenticación (el navegador no envía credenciales)
    memory=256,
    timeout_sec=60,
    min_instances=0,
    max_instances=10,
)
def chat_pousito(req: https_fn.Request) -> https_fn.Response:
    """
    Endpoint HTTP para el chatbot Pousito.

    Acepta:
        POST  { "mensaje": str, "sessionId": str, "modelo": str? }

    Devuelve:
        200  { "reply": str, "status": "success" }
        400  { "reply": str, "status": "error" }   — petición mal formada
        500  { "reply": str, "status": "error" }   — fallo en Groq API
    """
    origin: str | None = req.headers.get("Origin")

    # ── Preflight CORS ──────────────────────────────────────
    if req.method == "OPTIONS":
        return https_fn.Response(
            response="",
            status=204,
            headers=_cors_headers(origin),
        )

    # ── Solo aceptamos POST ─────────────────────────────────
    if req.method != "POST":
        return _make_response(
            {"reply": "Método no permitido.", "status": "error"},
            405,
            origin,
        )

    # ── Parsear body ────────────────────────────────────────
    try:
        body: dict[str, Any] = req.get_json(force=True, silent=True) or {}
    except Exception:
        body = {}

    mensaje: str = (body.get("mensaje") or "").strip()
    session_id: str = (body.get("sessionId") or "anonymous").strip()
    modelo_key: str = (body.get("modelo") or "modelo1").strip()

    if not mensaje:
        return _make_response(
            {"reply": "El campo 'mensaje' es requerido.", "status": "error"},
            400,
            origin,
        )

    modelo: str = MODELS.get(modelo_key, MODELS["modelo1"])

    # ── Obtener API Key ─────────────────────────────────────
    api_key: str = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.error("GROQ_API_KEY no está configurada en las variables de entorno.")
        return _make_response(
            {
                "reply": "El servicio no está disponible en este momento. Por favor intenta más tarde.",
                "status": "error",
            },
            500,
            origin,
        )

    # ── Llamada a Groq API ──────────────────────────────────
    payload: dict[str, Any] = {
        "model": modelo,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": mensaje},
        ],
        "temperature": 0.5,
        "max_tokens": 1024,
    }

    headers_groq: dict[str, str] = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        groq_resp = requests.post(
            GROQ_API_URL,
            json=payload,
            headers=headers_groq,
            timeout=55,
        )
        groq_resp.raise_for_status()
    except requests.exceptions.Timeout:
        logger.error("Groq API timed out for session=%s", session_id)
        return _make_response(
            {
                "reply": "Lo siento, tardé demasiado en responder. Por favor intenta de nuevo.",
                "status": "error",
            },
            500,
            origin,
        )
    except requests.exceptions.HTTPError as exc:
        logger.error("Groq API HTTP error %s for session=%s: %s", exc.response.status_code, session_id, exc.response.text[:300])
        return _make_response(
            {
                "reply": "Lo siento, tuve un problema al conectarme. Por favor intenta de nuevo.",
                "status": "error",
            },
            500,
            origin,
        )
    except requests.exceptions.RequestException as exc:
        logger.error("Groq API request error for session=%s: %s", session_id, str(exc))
        return _make_response(
            {
                "reply": "Lo siento, tuve un problema al conectarme. Por favor intenta de nuevo.",
                "status": "error",
            },
            500,
            origin,
        )

    # ── Extraer respuesta ───────────────────────────────────
    try:
        groq_data: dict[str, Any] = groq_resp.json()
        reply_text: str = groq_data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        logger.error("Unexpected Groq response structure for session=%s: %s", session_id, str(exc))
        return _make_response(
            {
                "reply": "Recibí una respuesta inesperada del servicio. Por favor intenta de nuevo.",
                "status": "error",
            },
            500,
            origin,
        )

    logger.info("chat_pousito OK | session=%s | modelo=%s | chars=%d", session_id, modelo_key, len(reply_text))

    return _make_response(
        {"reply": reply_text, "status": "success"},
        200,
        origin,
    )