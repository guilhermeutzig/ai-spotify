import { useEffect, useMemo, useState } from "preact/hooks";
import styles from "./styles/App.module.css";
import button from "./styles/Button.module.css";
import { api } from "./lib/api";

type User = { display_name: string; image_url?: string };
type SuggestedTrack = { title: string; artist: string };

export function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState(
    "Chill indie vibes for a rainy afternoon"
  );
  const [suggestions, setSuggestions] = useState<SuggestedTrack[]>([]);
  const [creating, setCreating] = useState(false);
  const [playlistName, setPlaylistName] = useState("AI Picks");
  const isAuthed = useMemo(() => !!user, [user]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/session");
        if (res.authenticated) {
          setUser(res.user);
        }
      } catch (_) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  const handleLogout = async () => {
    await api.post("/api/auth/logout", {});
    setUser(null);
    setSuggestions([]);
  };

  const handleSuggest = async () => {
    setSuggestions([]);
    const res = await api.post("/api/ai/suggest", { prompt });
    setSuggestions(res.tracks || []);
  };

  const handleCreatePlaylist = async () => {
    setCreating(true);
    try {
      const res = await api.post("/api/spotify/create-playlist", {
        name: playlistName,
        tracks: suggestions,
      });
      alert("Playlist created! Open in Spotify: " + res.url);
    } catch (e: any) {
      alert("Failed to create playlist: " + (e?.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div class={styles.container}>
        <div class={styles.card}>Loading…</div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div class={styles.container}>
        <div class={styles.card}>
          <h1 class={styles.title}>AI Spotify</h1>
          <p class={styles.subtitle}>
            Connect Spotify and generate playlists from a simple prompt.
          </p>
          <button
            class={`${button.primary} ${button.block}`}
            onClick={handleLogin}
          >
            Connect with Spotify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class={styles.container}>
      <header class={styles.header}>
        <div class={styles.user}>
          {user?.image_url && (
            <img
              class={styles.avatar}
              src={user.image_url}
              alt={user.display_name}
            />
          )}
          <span>Hi, {user?.display_name}</span>
        </div>
        <button class={button.ghost} onClick={handleLogout}>
          Logout
        </button>
      </header>

      <div class={styles.grid}>
        <section class={styles.card}>
          <h2 class={styles.sectionTitle}>Describe your vibe</h2>
          <textarea
            class={styles.textarea}
            rows={4}
            value={prompt}
            onInput={(e: any) => setPrompt(e.currentTarget.value)}
            placeholder="e.g., upbeat pop for a morning run"
          />
          <button class={button.primary} onClick={handleSuggest}>
            Generate suggestions
          </button>
        </section>

        <section class={styles.card}>
          <h2 class={styles.sectionTitle}>Suggestions</h2>
          {suggestions.length === 0 && (
            <p class={styles.muted}>No suggestions yet. Try generating some.</p>
          )}
          {suggestions.length > 0 && (
            <>
              <ul class={styles.list}>
                {suggestions.map((s, i) => (
                  <li
                    key={`${s.artist}-${s.title}-${i}`}
                    class={styles.listItem}
                  >
                    <span class={styles.trackTitle}>{s.title}</span>
                    <span class={styles.trackArtist}>{s.artist}</span>
                  </li>
                ))}
              </ul>
              <div class={styles.row}>
                <input
                  class={styles.input}
                  value={playlistName}
                  onInput={(e: any) => setPlaylistName(e.currentTarget.value)}
                />
                <button
                  disabled={creating}
                  class={button.success}
                  onClick={handleCreatePlaylist}
                >
                  {creating ? "Creating…" : "Create Playlist"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
