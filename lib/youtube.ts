export function youtubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    
    // youtu.be/VIDEO_ID
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    
    // youtube.com variants
    if (url.hostname.includes("youtube.com") || url.hostname.includes("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        const v = url.searchParams.get("v");
        return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
      }
      
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        const id = parts[embedIdx + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
      
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
        const id = parts[shortsIdx + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {}

  return null;
}