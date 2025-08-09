import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "node:path";
import crypto from "node:crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev-secret";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

// In-memory session store for demo purposes
type Session = {
  userId: string;
  displayName: string;
  imageUrl?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
};
const sessions = new Map<string, Session>();

// Utilities
function randomId(): string {
  return crypto.randomBytes(16).toString("hex");
}
function now(): number {
  return Date.now();
}

// Spotify OAuth config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3001/api/auth/callback";
const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
].join(" ");

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("Warning: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
}

// Local LLM via Ollama
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

// Auth routes
app.get("/api/auth/login", (req: Request, res: Response) => {
  const state = randomId();
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax" });
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

app.get("/api/auth/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  const cookieState = req.cookies["oauth_state"];
  if (!code || !state || !cookieState || state !== cookieState) {
    return res.status(400).send("Invalid OAuth state");
  }
  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error("Token exchange failed: " + t);
    }
    const token = (await tokenRes.json()) as any;
    const accessToken: string = token.access_token;
    const refreshToken: string = token.refresh_token;
    const expiresIn: number = token.expires_in; // seconds

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = (await meRes.json()) as any;

    const sid = randomId();
    sessions.set(sid, {
      userId: me.id,
      displayName: me.display_name || me.id,
      imageUrl: me.images?.[0]?.url,
      accessToken,
      refreshToken,
      expiresAt: now() + expiresIn * 1000 - 15_000, // 15s skew
    });
    res.cookie("sid", sid, { httpOnly: true, sameSite: "lax" });
    res.clearCookie("oauth_state");
    res.redirect(CLIENT_ORIGIN);
  } catch (e: any) {
    res.status(500).send("Auth error: " + (e?.message || "unknown"));
  }
});

app.post("/api/auth/logout", (req, res) => {
  const sid = req.cookies["sid"];
  if (sid) sessions.delete(sid);
  res.clearCookie("sid");
  res.json({ ok: true });
});

// Session helper
async function getValidAccessToken(
  req: Request
): Promise<{ token: string; session: Session } | null> {
  const sid = req.cookies["sid"];
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (now() < s.expiresAt) return { token: s.accessToken, session: s };

  // refresh
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: s.refreshToken,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) return null;
  const token = (await tokenRes.json()) as any;
  s.accessToken = token.access_token;
  s.expiresAt = now() + token.expires_in * 1000 - 15_000;
  sessions.set(sid, s);
  return { token: s.accessToken, session: s };
}

// Session endpoint
app.get("/api/session", async (req, res) => {
  const sid = req.cookies["sid"];
  if (!sid) return res.json({ authenticated: false });
  const s = sessions.get(sid);
  if (!s) return res.json({ authenticated: false });
  return res.json({
    authenticated: true,
    user: { display_name: s.displayName, image_url: s.imageUrl },
  });
});

// AI suggestions
app.post("/api/ai/suggest", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  try {
    const system = `You are a music curator. Given a prompt, return a concise JSON with an array called tracks. Each track must have title and artist. Return ONLY JSON.`;
    const user = `Prompt: ${prompt}\nReturn 12 tracks.`;

    const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature: 0.6 },
      }),
    });
    if (!ollamaRes.ok) {
      const t = await ollamaRes.text();
      throw new Error(`Ollama request failed: ${t}`);
    }
    const data = (await ollamaRes.json()) as {
      message?: { content?: string };
    };
    const content = data?.message?.content || "";
    const json = safeExtractJson(content);
    if (!json?.tracks) throw new Error("Invalid AI response");
    res.json({ tracks: json.tracks.slice(0, 20) });
  } catch (e: any) {
    const msg = e?.message || "AI error";
    // Provide a friendlier hint if Ollama server is not reachable
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return res.status(500).json({
        error:
          "Cannot reach Ollama at OLLAMA_BASE_URL. Is Ollama running? Try: `ollama serve` and `ollama pull llama3.1:8b`.",
      });
    }
    res.status(500).json({ error: msg });
  }
});

function safeExtractJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {}
  const match = text.match(/\{[\s\S]*\}$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Create Spotify playlist from suggestions
app.post("/api/spotify/create-playlist", async (req, res) => {
  const auth = await getValidAccessToken(req);
  if (!auth) return res.status(401).json({ error: "Not authenticated" });
  const { token, session } = auth;
  const { name, tracks } = req.body as {
    name?: string;
    tracks?: Array<{ title: string; artist: string }>;
  };
  if (!name || !tracks?.length)
    return res.status(400).json({ error: "Missing name or tracks" });
  try {
    const uris: string[] = [];
    for (const t of tracks) {
      const q = `track:${t.title} artist:${t.artist}`;
      const resSearch = await fetch(
        `https://api.spotify.com/v1/search?${new URLSearchParams({
          q,
          type: "track",
          limit: "1",
        })}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = (await resSearch.json()) as any;
      const uri = data?.tracks?.items?.[0]?.uri;
      if (uri) uris.push(uri);
    }

    const playlistRes = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        public: false,
        description: "Generated by AI Spotify",
      }),
    });
    if (!playlistRes.ok) {
      const t = await playlistRes.text();
      throw new Error("Create playlist failed: " + t);
    }
    const playlist = (await playlistRes.json()) as any;

    if (uris.length > 0) {
      const addRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris }),
        }
      );
      if (!addRes.ok) {
        const t = await addRes.text();
        throw new Error("Add tracks failed: " + t);
      }
    }

    res.json({ id: playlist.id, url: playlist.external_urls?.spotify || "" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Playlist error" });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve client in production
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
