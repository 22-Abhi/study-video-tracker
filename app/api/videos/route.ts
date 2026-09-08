import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabase } from "@/lib/supabase";
import { youtubeId } from "@/lib/youtube";
import { authOptions } from "@/lib/auth";
import { persistentStore, VideoRecord } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dbVideos: VideoRecord[] = [];
  let dbWatched: number[] = [];

  // Run database queries in parallel for maximum speed
  try {
    const [videosRes, watchedRes] = await Promise.allSettled([
      supabase
        .from("videos")
        .select("id, title, subtitle, youtube_id, tags, category, added_by")
        .order("id", { ascending: false }),
      supabase
        .from("watched")
        .select("video_id")
        .eq("user_id", userId)
    ]);

    if (videosRes.status === "fulfilled" && !videosRes.value.error && videosRes.value.data) {
      dbVideos = videosRes.value.data.map((v: any) => ({
        ...v,
        topic: v.topic || v.category || "General",
        subtopic: v.subtopic || "General Lessons"
      }));
    }

    if (watchedRes.status === "fulfilled" && !watchedRes.value.error && watchedRes.value.data) {
      dbWatched = watchedRes.value.data.map((x: any) => Number(x.video_id));
    }
  } catch {}

  // Merge with disk store
  const diskVideos = persistentStore.getVideos();
  const existingYoutubeIds = new Set(dbVideos.map((v) => v.youtube_id));
  const additionalDiskVideos = diskVideos.filter((v) => !existingYoutubeIds.has(v.youtube_id));
  const combinedVideos = [...dbVideos, ...additionalDiskVideos];

  const diskWatched = persistentStore.getWatchedSet(userId);
  const combinedWatched = new Set([...dbWatched, ...Array.from(diskWatched)]);

  const result = combinedVideos.map((v) => ({
    ...v,
    watched: combinedWatched.has(Number(v.id))
  }));

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate"
    }
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = session.user?.email?.toLowerCase();
  const isAuthorizedUploader = userEmail === "abhi.ukande22@gmail.com" || session.user?.role === "uploader";
  if (!isAuthorizedUploader) {
    return NextResponse.json({ error: "Forbidden: Only authorized uploader can add videos" }, { status: 403 });
  }

  const body = await req.json();
  const rawUrl = String(body.url || "").trim();
  const title = String(body.title || "").trim();
  const subtitle = String(body.subtitle || "").trim() || null;
  const topic = String(body.topic || "").trim() || "General";
  const subtopic = String(body.subtopic || "").trim() || "General Lessons";
  const category = String(body.category || "").trim() || topic;

  const yId = youtubeId(rawUrl);
  if (!yId || !title) {
    return NextResponse.json(
      { error: "A valid YouTube URL and title are required" },
      { status: 400 }
    );
  }

  let tags: string[] = [];
  if (typeof body.tags === "string") {
    tags = body.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
  } else if (Array.isArray(body.tags)) {
    tags = body.tags.map((t: any) => String(t).trim()).filter(Boolean);
  }

  // Save to persistent storage immediately
  const savedRecord = persistentStore.addVideo({
    title,
    subtitle,
    topic,
    subtopic,
    youtube_id: yId,
    tags,
    category,
    added_by: userId
  });

  // Sync to Supabase in the background non-blocking
  (async () => {
    try {
      await supabase.from("videos").insert({
        title,
        subtitle,
        youtube_id: yId,
        tags,
        category: topic,
        added_by: userId
      });
    } catch {}
  })();

  return NextResponse.json(savedRecord, { status: 201 });
}