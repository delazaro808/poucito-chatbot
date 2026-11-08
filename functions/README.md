# Pousito Café — Cloud Functions (Python)

Este directorio contiene el backend de **Firebase Cloud Functions v2** en Python.

## Estructura

```
functions/
├── main.py           # Cloud Function principal: chat_pousito
├── requirements.txt  # Dependencias Python
└── .env.local        # Variables de entorno locales (NO subir a git)
```

## Variables de entorno requeridas

| Variable          | Descripción                                                        |
|-------------------|--------------------------------------------------------------------|
| `GROQ_API_KEY`    | Clave de API de Groq                                               |
| `ALLOWED_ORIGINS` | Orígenes CORS separados por coma (ej. `https://poucito-69937.web.app,http://localhost:5173`) |

### Configuración en producción (Secret Manager)

```bash
firebase functions:secrets:set GROQ_API_KEY
# Pegar la API key cuando se solicite
```

### Configuración local

Crea `functions/.env.local`:
```env
GROQ_API_KEY=gsk_tuclaveaqui
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

## Desarrollo local

```bash
# Instalar dependencias
cd functions
pip install -r requirements.txt

# Iniciar emulador de Functions
firebase emulators:start --only functions
```

El emulador expondrá la función en:
`http://127.0.0.1:5001/poucito-69937/us-central1/chat_pousito`

Actualiza `VITE_CLOUD_FUNCTION_URL` en `.env.local` del frontend a esta URL durante el desarrollo.

## Despliegue

```bash
firebase deploy --only functions
```

