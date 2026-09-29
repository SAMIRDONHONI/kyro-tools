import { NextRequest, NextResponse } from "next/server";
import { getDiscordAccessError } from "@/lib/discord-access";
import { getJob, videoStream } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const accessError = await getDiscordAccessError();
  if (accessError) return accessError;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Video not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const job = getJob(id);
  if (!job || job.status !== "complete") {
    return NextResponse.json({ error: "Video is not ready or has expired." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return await videoStream(job.outputPath, request.headers.get("range"), "kyro-video.mp4", false);
  } catch (error) {
    console.error(`Could not stream video for job ${id}:`, error);
    return NextResponse.json({ error: "The compressed video is temporarily unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
