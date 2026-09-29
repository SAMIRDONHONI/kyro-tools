import { NextResponse } from "next/server";
import { getDiscordAccessError } from "@/lib/discord-access";
import { getJob, getPublicJob } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const accessError = await getDiscordAccessError();
  if (accessError) return accessError;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Compression job not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Compression job expired or does not exist." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(getPublicJob(job), { headers: { "Cache-Control": "no-store" } });
}
