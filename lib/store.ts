import fs from "fs";
import path from "path";

export interface VideoRecord {
  id: number;
  title: string;
  subtitle?: string | null;
  youtube_id: string;
  tags: string[];
  category: string | null;
  added_by: string;
}

const dataDir = path.join(process.cwd(), "data");
const videosFile = path.join(dataDir, "videos.json");
const watchedFile = path.join(dataDir, "watched.json");

function ensureFiles() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(videosFile)) {
      fs.writeFileSync(videosFile, JSON.stringify([]), "utf8");
    }
    if (!fs.existsSync(watchedFile)) {
      fs.writeFileSync(watchedFile, JSON.stringify([]), "utf8");
    }
  } catch (err) {
    console.error("Error creating data directory/files:", err);
  }
}

export const persistentStore = {
  getVideos: (): VideoRecord[] => {
    ensureFiles();
    try {
      const data = fs.readFileSync(videosFile, "utf8");
      return JSON.parse(data || "[]");
    } catch {
      return [];
    }
  },

  addVideo: (v: Omit<VideoRecord, "id">): VideoRecord => {
    ensureFiles();
    const videos = persistentStore.getVideos();
    const nextId = Date.now();
    const record: VideoRecord = { id: nextId, ...v };
    const updated = [record, ...videos];
    try {
      fs.writeFileSync(videosFile, JSON.stringify(updated, null, 2), "utf8");
    } catch (err) {
      console.error("Error saving video to disk:", err);
    }
    return record;
  },

  deleteVideo: (id: number, userIdentifier: string): boolean => {
    ensureFiles();
    const videos = persistentStore.getVideos();
    const normalizedUser = userIdentifier.toLowerCase();
    
    // Only allow deletion if user added it or is the authorized owner
    const target = videos.find((v) => v.id === id);
    if (!target) return false;

    const isOwner = target.added_by.toLowerCase() === normalizedUser || 
                    normalizedUser === "abhi.ukande22@gmail.com";
    if (!isOwner) return false;

    const updated = videos.filter((v) => v.id !== id);
    try {
      fs.writeFileSync(videosFile, JSON.stringify(updated, null, 2), "utf8");
      return true;
    } catch {
      return false;
    }
  },

  getWatchedSet: (userId: string): Set<number> => {
    ensureFiles();
    const set = new Set<number>();
    try {
      const data = fs.readFileSync(watchedFile, "utf8");
      const records: Array<{ user_id: string; video_id: number }> = JSON.parse(data || "[]");
      records.forEach((r) => {
        if (r.user_id.toLowerCase() === userId.toLowerCase()) {
          set.add(Number(r.video_id));
        }
      });
    } catch {}
    return set;
  },

  setWatched: (userId: string, videoId: number, watched: boolean) => {
    ensureFiles();
    try {
      const data = fs.readFileSync(watchedFile, "utf8");
      let records: Array<{ user_id: string; video_id: number }> = JSON.parse(data || "[]");
      const normUser = userId.toLowerCase();
      
      // Remove existing entry
      records = records.filter(
        (r) => !(r.user_id.toLowerCase() === normUser && Number(r.video_id) === videoId)
      );

      if (watched) {
        records.push({ user_id: normUser, video_id: videoId });
      }

      fs.writeFileSync(watchedFile, JSON.stringify(records, null, 2), "utf8");
    } catch (err) {
      console.error("Error updating watched status on disk:", err);
    }
  }
};
