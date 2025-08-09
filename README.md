## AI Spotify – Prompt to Playlist (Preact + TypeScript)

Simple, fast app to connect your Spotify account and generate playlist suggestions from a natural language prompt using Groq's free-tier friendly models. Clean UI with Preact, Vite, and CSS modules.

### Features

- Connect with Spotify (OAuth)
- Enter a vibe/prompt → get suggested songs/artists via AI
- Create a Spotify playlist from suggestions (private by default)

### Tech

- Preact + TypeScript + Vite (frontend)
- Express + TypeScript (backend)
- Groq SDK (AI suggestions)

### 1) Spotify setup

1. Go to Spotify Developer Dashboard and create an app.
2. Add Redirect URI: `http://localhost:3001/api/auth/callback`
3. Copy `Client ID` and `Client Secret`.

### 2) Groq (AI) setup

- Create an account at Groq and generate an API key. They offer a free developer tier suitable for testing.

### 3) Configure env

Create a `.env` in the project root using `.env.example` as a template:

```
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SECRET=change-me

SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/auth/callback

GROQ_API_KEY=your_groq_key
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
