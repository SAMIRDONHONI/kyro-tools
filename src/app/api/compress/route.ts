import { NextRequest, NextResponse } from "next/server";
import { getVideoRequestAccess } from "@/lib/discord-access";
import { createCompressionJob, getUploadError } from "@/lib/video";
import { videoApiPreflight, withVideoApiCors } from "@/lib/video-access-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return videoApiPreflight(request);
}

export async function POST(request: NextRequest) {
  const access = await getVideoRequestAccess(request);
  if (!access.ok) return access.error;
  try {
    const job = await createCompressionJob(request, access.userId);
    return withVideoApiCors(request, NextResponse.json({ job }, { status: 202, headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    const result = getUploadError(error);
    return withVideoApiCors(request, NextResponse.json({ error: result.message }, { status: result.status, headers: { "Cache-Control": "no-store" } }));
  }
}
