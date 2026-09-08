"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

type Video = {
  id: number;
  title: string;
  subtitle?: string | null;
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
  const [form, setForm] = useState({ title: "", subtitle: "", url: "", tags: "", category: "" });
  const [error, setError] = useState("");

  async function loadVideos() {
    try {
      const res = await fetch("/api/videos", { cache: "no-store" });
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
      const subtitleMatch = (v.subtitle || "").toLowerCase().includes(q);
      const tagMatch = (v.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchesSearch = !q || titleMatch || subtitleMatch || tagMatch;
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
        // Instantly prepend new video to list
        setVideos((prev) => [data, ...prev]);
        setForm({ title: "", subtitle: "", url: "", tags: "", category: "" });
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

    // Optimistically remove from UI immediately
    setVideos((prev) => prev.filter((v) => v.id !== id));
    if (activeModalVideo?.id === id) {
      setActiveModalVideo(null);
    }

    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Could not delete video.");
        await loadVideos();
      }
    } catch {
      await loadVideos();
    }
  }

  async function toggleWatched(video: Video) {
    const nextWatched = !video.watched;
    // Optimistic instant toggle
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, watched: nextWatched } : v))
    );

    try {
      await fetch("/api/watched", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, watched: nextWatched })
      });
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
              placeholder="Video Title (e.g. Introduction to Derivatives)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Subtitle / Description (e.g. Calculus Part 1 • Basics & Rules)"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            />
            <input
              className="input full-width"
              placeholder="YouTube Video URL (e.g. https://www.youtube.com/watch?v=...)"
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
              placeholder="Category (optional, e.g. Mathematics)"
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
          placeholder="Search by title, subtitle, or tag..."
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
              {/* Thumbnail - Click to pop screen video */}
              <div
                className="thumb-wrapper"
                onClick={() => setActiveModalVideo(video)}
                title="Click to play video"
              >
                <img
                  className="thumb"
                  src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                  alt={video.title}
                  loading="lazy"
                  decoding="async"
                  width="320"
                  height="180"
                />
                <div className="play-overlay">
                  <div className="play-icon">▶</div>
                </div>
                {video.watched && (
                  <span className="watched-badge">Watched ✓</span>
                )}
              </div>

              <div className="card-body">
                {/* Title - Click to pop screen video */}
                <div
                  className="card-title clickable-title"
                  onClick={() => setActiveModalVideo(video)}
                  title="Click to play video"
                  style={{ cursor: "pointer" }}
                >
                  {video.title}
                </div>

                {/* Subtitle - Click to pop screen video */}
                {video.subtitle && (
                  <div
                    className="card-subtitle clickable-subtitle"
                    onClick={() => setActiveModalVideo(video)}
                    title="Click to play video"
                    style={{
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      color: "var(--text-muted)",
                      marginBottom: "8px",
                      lineHeight: "1.4"
                    }}
                  >
                    {video.subtitle}
                  </div>
                )}

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
                    ▶ Watch Video
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

      {/* Video Pop Screen Modal */}
      {activeModalVideo && (
        <div
          className="modal-backdrop"
          onClick={() => setActiveModalVideo(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{activeModalVideo.title}</div>
                {activeModalVideo.subtitle && (
                  <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "3px" }}>
                    {activeModalVideo.subtitle}
                  </div>
                )}
              </div>
              <button
                className="btn"
                onClick={() => setActiveModalVideo(null)}
                style={{ marginLeft: "12px" }}
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