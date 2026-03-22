import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const SAVED_KEY = "splitsecond:saved";
const ADMIN_TOKEN_KEY = "splitsecond:admin-token";

function readSavedIds() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIds(ids) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
}

function readAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function persistAdminToken(token) {
  if (!token) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function App() {
  const [videos, setVideos] = useState([]);
  const [savedIds, setSavedIds] = useState(() => readSavedIds());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("feed");
  const [showOnlySaved, setShowOnlySaved] = useState(false);

  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState(() => readAdminToken());
  const [adminStatus, setAdminStatus] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const videoElementsRef = useRef(new Map());

  async function loadVideos() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/videos");
      if (!res.ok) {
        throw new Error("Impossibile caricare i video");
      }
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (err) {
      setError(err.message || "Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function validateToken() {
      if (!adminToken) {
        setAdminStatus("");
        return;
      }

      try {
        const res = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        });

        if (!res.ok) {
          throw new Error("Sessione admin scaduta");
        }

        if (!cancelled) {
          setAdminStatus("Autenticato come admin");
        }
      } catch {
        if (!cancelled) {
          setAdminToken("");
          persistAdminToken("");
          setAdminStatus("Sessione scaduta, effettua di nuovo login");
        }
      }
    }

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  const feedVideos = useMemo(() => {
    if (!showOnlySaved) {
      return videos;
    }
    return videos.filter((video) => savedIds.includes(video.id));
  }, [showOnlySaved, videos, savedIds]);

  useEffect(() => {
    const videoElements = Array.from(videoElementsRef.current.values()).filter(Boolean);
    if (videoElements.length === 0) {
      return undefined;
    }

    function pauseAllExcept(activeElement) {
      for (const element of videoElements) {
        if (element !== activeElement) {
          element.pause();
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }

        if (!best) {
          return;
        }

        const activeVideo = best.target;
        pauseAllExcept(activeVideo);
        activeVideo
          .play()
          .catch(() => {
            /* autoplay can be blocked by browser policies */
          });
      },
      {
        threshold: [0.25, 0.5, 0.75, 0.9]
      }
    );

    for (const element of videoElements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [feedVideos]);

  function registerVideoElement(id, element) {
    if (!element) {
      videoElementsRef.current.delete(id);
      return;
    }
    videoElementsRef.current.set(id, element);
  }

  function toggleSave(videoId) {
    const next = savedIds.includes(videoId)
      ? savedIds.filter((id) => id !== videoId)
      : [...savedIds, videoId];

    setSavedIds(next);
    saveIds(next);
  }

  async function handleAdminLogin(event) {
    event.preventDefault();

    try {
      setAdminStatus("Login admin in corso...");
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login fallito");
      }

      setAdminToken(data.token);
      persistAdminToken(data.token);
      setAdminPassword("");
      setAdminStatus("Login admin effettuato");
    } catch (err) {
      setAdminStatus(err.message || "Errore login");
    }
  }

  function handleLogout() {
    setAdminToken("");
    persistAdminToken("");
    setAdminStatus("Logout completato");
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!adminToken) {
      setUploadStatus("Prima fai login admin");
      return;
    }

    if (!file) {
      setUploadStatus("Seleziona un video");
      return;
    }

    const formData = new FormData();
    formData.append("title", title || "Video motivazionale");
    formData.append("description", description || "Selezionato dall'admin");
    formData.append("video", file);

    try {
      setUploadStatus("Caricamento in corso...");
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload fallito");
      }

      setUploadStatus("Upload completato");
      setTitle("");
      setDescription("");
      setFile(null);
      await loadVideos();
    } catch (err) {
      setUploadStatus(err.message || "Errore upload");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>SplitSecond</h1>
          <p>Solo video motivazionali selezionati da te</p>
        </div>
        <div className="tabs">
          <button className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}>
            Feed
          </button>
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            Admin
          </button>
        </div>
      </header>

      {tab === "feed" ? (
        <main>
          <div className="feed-controls">
            <button
              className={showOnlySaved ? "active" : ""}
              onClick={() => setShowOnlySaved((value) => !value)}
            >
              {showOnlySaved ? "Mostra tutti" : "Mostra salvati"}
            </button>
            <span>Salvati: {savedIds.length}</span>
          </div>

          {loading ? <p className="status">Caricamento feed...</p> : null}
          {error ? <p className="status error">{error}</p> : null}

          {!loading && feedVideos.length === 0 ? (
            <p className="status">Nessun video disponibile. Caricalo dalla tab Admin.</p>
          ) : null}

          <section className="video-feed">
            {feedVideos.map((video) => {
              const isSaved = savedIds.includes(video.id);
              return (
                <article className="video-card" key={video.id}>
                  <video
                    ref={(element) => registerVideoElement(video.id, element)}
                    src={video.url}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    controls={false}
                  />
                  <div className="overlay">
                    <h2>{video.title}</h2>
                    <p>{video.description}</p>
                    <button className={isSaved ? "saved" : ""} onClick={() => toggleSave(video.id)}>
                      {isSaved ? "Salvato" : "Salva"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        </main>
      ) : (
        <main className="admin-panel">
          <h2>Area admin</h2>
          <p>Solo l'admin autenticato puo caricare video.</p>

          {!adminToken ? (
            <form onSubmit={handleAdminLogin}>
              <label>
                Username admin
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  placeholder="admin"
                />
              </label>

              <label>
                Password admin
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Inserisci password"
                />
              </label>

              <button type="submit">Login admin</button>
              {adminStatus ? <p className="status">{adminStatus}</p> : null}
            </form>
          ) : (
            <>
              <div className="admin-actions">
                <p className="status">{adminStatus || "Autenticato come admin"}</p>
                <button onClick={handleLogout}>Logout</button>
              </div>

              <form onSubmit={handleUpload}>
                <label>
                  Titolo
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Disciplina e costanza"
                  />
                </label>

                <label>
                  Descrizione
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Messaggio del video"
                  />
                </label>

                <label>
                  File video (mp4, mov, webm)
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>

                <button type="submit">Carica video</button>
                {uploadStatus ? <p className="status">{uploadStatus}</p> : null}
              </form>
            </>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
