import { NextRequest, NextResponse } from "next/server";
import { getVideoRequestAccess } from "@/lib/discord-access";
import { getDownloadName, getJob, videoStream } from "@/lib/video";
import { videoApiPreflight, withVideoApiCors } from "@/lib/video-access-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return videoApiPreflight(request);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await getVideoRequestAccess(request, id);
  if (!access.ok) return access.error;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return withVideoApiCors(request, NextResponse.json({ error: "Video not found." }, { status: 404, headers: { "Cache-Control": "no-store" } }));
  }
  const job = getJob(id);
  if (!job || job.ownerId !== access.userId || job.status !== "complete") {
    return withVideoApiCors(request, NextResponse.json({ error: "Video is not ready or has expired." }, { status: 404, headers: { "Cache-Control": "no-store" } }));
  }
  try {
    return withVideoApiCors(request, await videoStream(job.outputPath, request.headers.get("range"), getDownloadName(job.originalName), true));
  } catch (error) {
    console.error(`Could not download video for job ${id}:`, error);
    return withVideoApiCors(request, NextResponse.json({ error: "The compressed video is temporarily unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } }));
  }
}
