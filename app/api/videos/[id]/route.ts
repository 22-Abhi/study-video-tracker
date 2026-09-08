import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";
import { persistentStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = session.user?.email?.toLowerCase();
  const isAuthorizedUploader = userEmail === "abhi.ukande22@gmail.com" || session.user?.role === "uploader";
  if (!isAuthorizedUploader) {
    return NextResponse.json({ error: "Forbidden: Only authorized uploader can delete videos" }, { status: 403 });
  }

  const videoId = parseInt(params.id, 10);
  if (isNaN(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  // Delete from persistent disk store
  persistentStore.deleteVideo(videoId, userId);

  // Also delete from Supabase if present
  try {
    await supabase.from("videos").delete().eq("id", videoId);
  } catch {}

  return NextResponse.json({ ok: true });
}