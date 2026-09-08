"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

type Video = {
  id: number;
  title: string;
  youtube_id: string;
  tags: string[];
  category: string | null;
  added_by: string;
  watched: boolean;
};

export default function Dashboard({
  initialRole,
  isUploaderEligible,
  name,
  email,
  userId
}: {
  initialRole: "uploader" | "viewer";
  isUploaderEligible: boolean;
  name?: string | null;
  email?: string | null;
  userId: string;
}) {
  const [currentMode, setCurrentMode] = useState<"uploader" | "viewer">(
    isUploaderEligible ? initialRole : "viewer"
  );
  const [videos, setVideos] = useState<Video[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [activeModalVideo, setActiveModalVideo] = useState<Video | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", tags: "", category: "" });
  const [error, setError] = useState("");

  async function loadVideos() {
    try {
      const res = await fetch("/api/videos");
      const data = await res.json();
      if (res.ok) {
        setVideos(data);
      } else {
        setError(data.error || "Failed to load videos.");
      }
    } catch {
      setError("Network error while loading videos.");
    }
  }

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModalVideo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => {
      (v.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const q = query.toLowerCase().trim();
      const titleMatch = v.title.toLowerCase().includes(q);
      const tagMatch = (v.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchesSearch = !q || titleMatch || tagMatch;
      const matchesTag = !selectedTag || (v.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [videos, query, selectedTag]);

  async function handleAddVideo(e: React.FormEvent) {
    e.preventDefault();
    if (currentMode !== "uploader") return;

    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add video.");
      } else {
        setForm({ title: "", url: "", tags: "", category: "" });
        await loadVideos();
      }
    } catch {
      setError("Failed to add video. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (currentMode !== "uploader") return;
    if (!confirm("Are you sure you want to delete this video?")) return;

    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
        if (activeModalVideo?.id === id) {
          setActiveModalVideo(null);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Could not delete video.");
      }
    } catch {
      setError("Network error deleting video.");
    }
  }

  async function toggleWatched(video: Video) {
    const nextWatched = !video.watched;
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, watched: nextWatched } : v))
    );

    try {
      const res = await fetch("/api/watched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, watched: nextWatched })
      });
      if (!res.ok) {
        await loadVideos();
      }
    } catch {
      await loadVideos();
    }
  }

  return (
    <main className="container">
      {/* Header */}
      <header className="header">
        <div>
          <div className="brand">Study Video Tracker</div>
          <div className="user-badge">
            <span>{name || email || "User"}</span>
            <span>·</span>
            <span className="role-pill">{currentMode}</span>
          </div>
        </div>

        <div className="header-actions">
          {/* Mode Switcher for abhi.ukande22@gmail.com */}
          {isUploaderEligible ? (
            <div style={{ display: "inline-flex", background: "var(--tag-bg)", borderRadius: "8px", padding: "2px" }}>
              <button
                type="button"
                className="btn"
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: currentMode === "viewer" ? "var(--primary)" : "transparent",
                  color: currentMode === "viewer" ? "#fff" : "var(--text-main)",
                  fontWeight: currentMode === "viewer" ? 600 : 400
                }}
                onClick={() => setCurrentMode("viewer")}
              >
                👁️ Viewer Mode
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: currentMode === "uploader" ? "var(--primary)" : "transparent",
                  color: currentMode === "uploader" ? "#fff" : "var(--text-main)",
                  fontWeight: currentMode === "uploader" ? 600 : 400
                }}
                onClick={() => setCurrentMode("uploader")}
              >
                📤 Uploader Mode
              </button>
            </div>
          ) : null}

          <ThemeToggle />
          <button className="btn" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}

      {/* Uploader Form (Only when in Uploader mode) */}
      {currentMode === "uploader" && (
        <form className="form-card" onSubmit={handleAddVideo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 className="form-title" style={{ margin: 0 }}>Add New Video</h2>
            <span className="role-pill" style={{ background: "var(--primary)", color: "#fff" }}>Uploader Active</span>
          </div>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Video Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="YouTube Video URL"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Tags (comma separated, e.g. Math, Calculus)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
            <input
              className="input"
              placeholder="Category (optional)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <div className="full-width">
              <button
                type="submit"
                className="btn primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Video"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Toolbar / Search */}
      <div className="toolbar">
        <input
          className="input search-input"
          placeholder="Search by title or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          style={{ width: "auto" }}
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
        >
          <option value="">All tags ({allTags.length})</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        {(query || selectedTag) && (
          <button
            className="btn"
            onClick={() => {
              setQuery("");
              setSelectedTag("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Video Grid */}
      <section className="video-grid">
        {filteredVideos.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: 0 }}>No videos found.</p>
            {currentMode === "uploader" && (
              <p style={{ fontSize: "0.875rem", marginTop: "6px" }}>Use the form above to add your first study video!</p>
            )}
          </div>
        ) : (
          filteredVideos.map((video) => (
            <article className="card" key={video.id}>
              <div
                className="thumb-wrapper"
                onClick={() => setActiveModalVideo(video)}
              >
                <img
                  className="thumb"
                  src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                  alt={video.title}
                />
                <div className="play-overlay">
                  <div className="play-icon">▶</div>
                </div>
                {video.watched && (
                  <span className="watched-badge">Watched ✓</span>
                )}
              </div>
              <div className="card-body">
                <div className="card-title">{video.title}</div>
                {video.category && (
                  <div className="category-text">{video.category}</div>
                )}
                {video.tags && video.tags.length > 0 && (
                  <div className="tags">
                    {video.tags.map((t) => (
                      <span className="tag" key={t}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="card-actions">
                  <button
                    className="btn primary"
                    onClick={() => setActiveModalVideo(video)}
                  >
                    Watch
                  </button>
                  <button
                    className="btn"
                    onClick={() => toggleWatched(video)}
                  >
                    {video.watched ? "Watched ✓" : "Mark watched"}
                  </button>
                  {/* Delete button only visible in Uploader mode */}
                  {currentMode === "uploader" && (
                    <button
                      className="btn danger"
                      onClick={() => handleDelete(video.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Video Modal Player */}
      {activeModalVideo && (
        <div
          className="modal-backdrop"
          onClick={() => setActiveModalVideo(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{activeModalVideo.title}</div>
              <button
                className="btn"
                onClick={() => setActiveModalVideo(null)}
              >
                ✕ Close
              </button>
            </div>
            <div className="video-frame-container">
              <iframe
                className="video-frame"
                src={`https://www.youtube.com/embed/${activeModalVideo.youtube_id}?autoplay=1`}
                title={activeModalVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}