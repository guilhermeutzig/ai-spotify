## AI Spotify – Prompt to Playlist (Preact + TypeScript)

Simple, fast app to connect your Spotify account and generate playlist suggestions from a natural language prompt. Uses a local Ollama model by default. Clean UI with Preact, Vite, and CSS modules.

### Features

- Connect with Spotify (OAuth)
- Enter a vibe/prompt → get suggested songs/artists via AI
- Create a Spotify playlist from suggestions (private by default)

### Tech

- Preact + TypeScript + Vite (frontend)
- Express + TypeScript (backend)
- Ollama local LLM (AI suggestions)

### 1) Spotify setup

1. Go to Spotify Developer Dashboard and create an app.
2. Add Redirect URI: `http://localhost:3001/api/auth/callback`
3. Copy `Client ID` and `Client Secret`.

### 2) Ollama (AI) setup

- Install Ollama (`brew install ollama`), then start the server: `ollama serve`
- Pull a model (recommended): `ollama pull llama3.1:8b`

### 3) Configure env

Create a `.env` in the project root using `.env.example` as a template:

```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SECRET=change-me

SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/auth/callback

CLIENT_ORIGIN=http://127.0.0.1:5173

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

### 4) Install and run

Using pnpm (recommended):

```
pnpm install
pnpm dev
```

Then open `http://localhost:5173` in your browser.

Alternatively with npm:

```
npm install
npm run dev
```

### Notes

- For simplicity, access tokens are stored in a transient in-memory session. Do not use as-is in production.
- The app requests `playlist-modify-private`, `playlist-modify-public`, and `user-read-email` scopes.
