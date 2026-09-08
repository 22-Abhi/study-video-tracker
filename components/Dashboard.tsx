"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

type Video = {
  id: number;
  title: string;
  subtitle?: string | null;
  topic: string;
  subtopic: string;
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
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [activeModalVideo, setActiveModalVideo] = useState<Video | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    topic: "",
    subtopic: "",
    url: "",
    tags: ""
  });
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

  // Grouping statistics for Topics
  const topicStats = useMemo(() => {
    const map = new Map<string, { subtopics: Set<string>; videoCount: number; previewThumbs: string[] }>();
    videos.forEach((v) => {
      const t = v.topic || "General";
      const s = v.subtopic || "General Lessons";
      if (!map.has(t)) {
        map.set(t, { subtopics: new Set(), videoCount: 0, previewThumbs: [] });
      }
      const entry = map.get(t)!;
      entry.subtopics.add(s);
      entry.videoCount += 1;
      if (entry.previewThumbs.length < 3) {
        entry.previewThumbs.push(v.youtube_id);
      }
    });

    return Array.from(map.entries()).map(([topic, data]) => ({
      topic,
      subtopicCount: data.subtopics.size,
      videoCount: data.videoCount,
      previewThumbs: data.previewThumbs
    })).sort((a, b) => a.topic.localeCompare(b.topic));
  }, [videos]);

  // Distinct topics & subtopics for autocomplete datalists
  const existingTopics = useMemo(() => {
    return Array.from(new Set(videos.map((v) => v.topic || "General"))).sort();
  }, [videos]);

  const existingSubtopics = useMemo(() => {
    return Array.from(new Set(videos.map((v) => v.subtopic || "General Lessons"))).sort();
  }, [videos]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => {
      (v.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [videos]);

  // Filtered videos for the current view
  const currentTopicVideos = useMemo(() => {
    return videos.filter((v) => {
      if (selectedTopic && v.topic !== selectedTopic) return false;
      if (selectedSubtopic && v.subtopic !== selectedSubtopic) return false;

      const q = query.toLowerCase().trim();
      const titleMatch = v.title.toLowerCase().includes(q);
      const subtitleMatch = (v.subtitle || "").toLowerCase().includes(q);
      const tagMatch = (v.tags || []).some((t) => t.toLowerCase().includes(q));
      const topicMatch = (v.topic || "").toLowerCase().includes(q);
      const subtopicMatch = (v.subtopic || "").toLowerCase().includes(q);

      const matchesSearch = !q || titleMatch || subtitleMatch || tagMatch || topicMatch || subtopicMatch;
      const matchesTag = !selectedTag || (v.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [videos, selectedTopic, selectedSubtopic, query, selectedTag]);

  // Group currentTopicVideos by subtopic
  const subtopicGroups = useMemo(() => {
    const map = new Map<string, Video[]>();
    currentTopicVideos.forEach((v) => {
      const s = v.subtopic || "General Lessons";
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(v);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [currentTopicVideos]);

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
        setVideos((prev) => [data, ...prev]);
        setForm({
          title: "",
          subtitle: "",
          topic: selectedTopic || "",
          subtopic: "",
          url: "",
          tags: ""
        });
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
          <div className="brand" style={{ cursor: "pointer" }} onClick={() => { setSelectedTopic(null); setSelectedSubtopic(""); }}>
            Study Video Tracker
          </div>
          <div className="user-badge">
            <span>{name || email || "User"}</span>
            <span>·</span>
            <span className="role-pill">{currentMode}</span>
          </div>
        </div>

        <div className="header-actions">
          {/* Mode Switcher for abhi.ukande22@gmail.com */}
          {isUploaderEligible && (
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
          )}

          <ThemeToggle />
          <button className="btn" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="alert-error">{error}</div>}

      {/* Uploader Form */}
      {currentMode === "uploader" && (
        <form className="form-card" onSubmit={handleAddVideo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 className="form-title" style={{ margin: 0 }}>Add New Video</h2>
            <span className="role-pill" style={{ background: "var(--primary)", color: "#fff" }}>Uploader Active</span>
          </div>

          <div className="form-grid">
            <div>
              <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Topic / Subject *
              </label>
              <input
                className="input"
                list="topics-list"
                placeholder="e.g. Mathematics, Computer Science"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                required
              />
              <datalist id="topics-list">
                {existingTopics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Subtopic / Chapter *
              </label>
              <input
                className="input"
                list="subtopics-list"
                placeholder="e.g. Calculus, Linear Algebra"
                value={form.subtopic}
                onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                required
              />
              <datalist id="subtopics-list">
                {existingSubtopics.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Video Title *
              </label>
              <input
                className="input"
                placeholder="e.g. Derivatives & Limits"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Subtitle / Description (optional)
              </label>
              <input
                className="input"
                placeholder="e.g. Part 1 • Fundamental theorem"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>

            <div className="full-width">
              <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                YouTube URL *
              </label>
              <input
                className="input"
                placeholder="e.g. https://www.youtube.com/watch?v=..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
              />
            </div>

            <div className="full-width">
              <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Tags (optional, comma-separated)
              </label>
              <input
                className="input"
                placeholder="e.g. Math, Calculus, Basics"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>

            <div className="full-width">
              <button
                type="submit"
                className="btn primary"
                disabled={isSubmitting}
                style={{ width: "100%", padding: "12px", fontSize: "1rem" }}
              >
                {isSubmitting ? "Adding..." : "Add Study Video"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Breadcrumb Navigation when viewing a specific Topic */}
      {selectedTopic && (
        <nav className="breadcrumb-nav">
          <button
            className="breadcrumb-back"
            onClick={() => {
              setSelectedTopic(null);
              setSelectedSubtopic("");
            }}
          >
            ← Back to All Topics
          </button>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span className="breadcrumb-current">Topic: {selectedTopic}</span>
        </nav>
      )}

      {/* Toolbar / Search */}
      <div className="toolbar">
        <input
          className="input search-input"
          placeholder="Search title, subtitle, topic, or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {selectedTopic && (
          <select
            className="input"
            style={{ width: "auto" }}
            value={selectedSubtopic}
            onChange={(e) => setSelectedSubtopic(e.target.value)}
          >
            <option value="">All Subtopics</option>
            {Array.from(
              new Set(videos.filter((v) => v.topic === selectedTopic).map((v) => v.subtopic || "General"))
            ).map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        )}
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
        {(query || selectedTag || selectedSubtopic) && (
          <button
            className="btn"
            onClick={() => {
              setQuery("");
              setSelectedTag("");
              setSelectedSubtopic("");
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* VIEW 1: TOPIC OVERVIEW (When no specific topic is selected) */}
      {!selectedTopic && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "1.35rem", margin: 0 }}>📚 Study Topics</h2>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              {topicStats.length} {topicStats.length === 1 ? "topic" : "topics"} available
            </span>
          </div>

          {topicStats.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>No study topics yet.</p>
              {currentMode === "uploader" ? (
                <p style={{ fontSize: "0.875rem", marginTop: "6px" }}>Use the form above to add your first topic, subtopic, and video!</p>
              ) : (
                <p style={{ fontSize: "0.875rem", marginTop: "6px" }}>Please ask an uploader to add study videos.</p>
              )}
            </div>
          ) : (
            <section className="topic-grid">
              {topicStats.map((item) => (
                <article
                  key={item.topic}
                  className="topic-card"
                  onClick={() => {
                    setSelectedTopic(item.topic);
                    setSelectedSubtopic("");
                  }}
                >
                  <div>
                    <div className="topic-icon">📁</div>
                    <div className="topic-title">{item.topic}</div>
                    <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                      Includes {item.subtopicCount} {item.subtopicCount === 1 ? "subtopic" : "subtopics"}
                    </div>
                  </div>

                  <div>
                    <div className="topic-meta">
                      <span>🎬 {item.videoCount} {item.videoCount === 1 ? "Video" : "Videos"}</span>
                      <span>•</span>
                      <span style={{ color: "var(--primary)", fontWeight: 600 }}>Explore →</span>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      {/* VIEW 2: TOPIC DETAIL PAGE (Organized by Subtopics) */}
      {selectedTopic && (
        <div>
          {subtopicGroups.length === 0 ? (
            <div className="empty-state">
              <p style={{ margin: 0 }}>No videos found in this topic matching your filters.</p>
            </div>
          ) : (
            subtopicGroups.map(([subtopicName, subVideos]) => (
              <section className="subtopic-section" key={subtopicName}>
                <div className="subtopic-header">
                  <h3 className="subtopic-title">📌 {subtopicName}</h3>
                  <span className="subtopic-badge">{subVideos.length} {subVideos.length === 1 ? "video" : "videos"}</span>
                </div>

                <div className="video-grid">
                  {subVideos.map((video) => (
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
                              fontSize: "0.875rem",
                              color: "var(--text-muted)",
                              marginBottom: "8px",
                              lineHeight: "1.4"
                            }}
                          >
                            {video.subtitle}
                          </div>
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
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

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
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "3px" }}>
                  <span>{activeModalVideo.topic}</span>
                  <span> › </span>
                  <span>{activeModalVideo.subtopic}</span>
                  {activeModalVideo.subtitle && <span> • {activeModalVideo.subtitle}</span>}
                </div>
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