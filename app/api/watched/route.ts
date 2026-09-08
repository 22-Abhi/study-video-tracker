import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";
import { persistentStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId, watched } = await req.json();
  const numericVideoId = parseInt(String(videoId), 10);
  if (isNaN(numericVideoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  // Update persistent disk store
  persistentStore.setWatched(userId, numericVideoId, !!watched);

  // Also try Supabase
  try {
    if (watched) {
      await supabase.from("watched").upsert(
        { user_id: userId, video_id: numericVideoId },
        { onConflict: "user_id,video_id" }
      );
    } else {
      await supabase
        .from("watched")
        .delete()
        .eq("user_id", userId)
        .eq("video_id", numericVideoId);
    }
  } catch {}

  return NextResponse.json({ ok: true });
}