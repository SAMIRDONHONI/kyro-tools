import { NextResponse } from "next/server";
import { getVideoRequestAccess } from "@/lib/discord-access";
import { getJob, getPublicJob } from "@/lib/video";
import { videoApiPreflight, withVideoApiCors } from "@/lib/video-access-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return videoApiPreflight(request);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await getVideoRequestAccess(request);
  if (!access.ok) return access.error;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return withVideoApiCors(request, NextResponse.json({ error: "Compression job not found." }, { status: 404, headers: { "Cache-Control": "no-store" } }));
  }
  const job = getJob(id);
  if (!job || job.ownerId !== access.userId) {
    return withVideoApiCors(request, NextResponse.json({ error: "Compression job expired or does not exist." }, { status: 404, headers: { "Cache-Control": "no-store" } }));
  }
  return withVideoApiCors(request, NextResponse.json(getPublicJob(job), { headers: { "Cache-Control": "no-store" } }));
}
