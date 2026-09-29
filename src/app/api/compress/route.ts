import { NextRequest, NextResponse } from "next/server";
import { getDiscordAccessError } from "@/lib/discord-access";
import { createCompressionJob, getUploadError } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const accessError = await getDiscordAccessError();
  if (accessError) return accessError;
  try {
    const job = await createCompressionJob(request);
    return NextResponse.json({ job }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = getUploadError(error);
    return NextResponse.json({ error: result.message }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
