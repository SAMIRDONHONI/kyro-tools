import { auth } from "../../../../auth";
import { issueVideoAccessToken } from "@/lib/video-access-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in with Discord to use video processing." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (session.accessStatus !== "authorized") {
    return Response.json({ error: "Your Discord account needs the server access role." }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let scope: "api" | "media" = "api";
  let jobId: string | undefined;
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "scope" in body) {
      if (body.scope === "media" && "jobId" in body && typeof body.jobId === "string") {
        scope = "media";
        jobId = body.jobId;
      } else if (body.scope !== "api") {
        return Response.json({ error: "The video access request is invalid." }, {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        });
      }
    }
  } catch {
    return Response.json({ error: "The video access request is invalid." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const result = issueVideoAccessToken(session.user.id, scope, jobId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not issue a video access token:", error);
    return Response.json({ error: "Video processing is not configured yet." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
