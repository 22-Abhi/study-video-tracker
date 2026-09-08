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

  // 1. Fetch from Supabase if available
  try {
    const { data: videos, error } = await supabase
      .from("videos")
      .select("id, title, youtube_id, tags, category, added_by")
      .order("id", { ascending: false });

    if (!error && videos && videos.length > 0) {
      dbVideos = videos;
    }
  } catch {}

  try {
    const { data: watchedRecords, error } = await supabase
      .from("watched")
      .select("video_id")
      .eq("user_id", userId);

    if (!error && watchedRecords) {
      dbWatched = watchedRecords.map((x) => Number(x.video_id));
    }
  } catch {}

  // 2. Fetch from persistent disk storage
  const diskVideos = persistentStore.getVideos();
  const existingYoutubeIds = new Set(dbVideos.map((v) => v.youtube_id));
  
  // Combine DB videos and disk videos without duplicates
  const additionalDiskVideos = diskVideos.filter((v) => !existingYoutubeIds.has(v.youtube_id));
  const combinedVideos = [...dbVideos, ...additionalDiskVideos];

  // Combine watched status
  const diskWatched = persistentStore.getWatchedSet(userId);
  const combinedWatched = new Set([...dbWatched, ...Array.from(diskWatched)]);

  const result = combinedVideos.map((v) => ({
    ...v,
    watched: combinedWatched.has(Number(v.id))
  }));

  return NextResponse.json(result);
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
  const category = String(body.category || "").trim() || null;

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

  // Save permanently to disk storage immediately
  const savedRecord = persistentStore.addVideo({
    title,
    youtube_id: yId,
    tags,
    category,
    added_by: userId
  });

  // Also sync to Supabase in the background
  try {
    await supabase.from("videos").insert({
      title,
      youtube_id: yId,
      tags,
      category,
      added_by: userId
    });
  } catch {}

  return NextResponse.json(savedRecord, { status: 201 });
}