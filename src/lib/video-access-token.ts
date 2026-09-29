import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type VideoTokenScope = "api" | "media";

type VideoAccessClaims = {
  sub: string;
  scope: VideoTokenScope;
  jobId?: string;
  exp: number;
};

const TOKEN_TTL_SECONDS = 5 * 60;
const MEDIA_TOKEN_TTL_SECONDS = 55 * 60;

function getSecret() {
  const secret = process.env.VIDEO_API_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("VIDEO_API_TOKEN_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(encodedClaims: string) {
  return createHmac("sha256", getSecret()).update(encodedClaims).digest("base64url");
}

export function issueVideoAccessToken(userId: string, scope: VideoTokenScope, jobId?: string) {
  if (scope === "media" && (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId))) {
    throw new Error("A valid compression job ID is required for media access.");
  }
  const expiresAt = Math.floor(Date.now() / 1000) + (
    scope === "media" ? MEDIA_TOKEN_TTL_SECONDS : TOKEN_TTL_SECONDS
  );
  const claims: VideoAccessClaims = {
    sub: userId,
    scope,
    ...(scope === "media" ? { jobId } : {}),
    exp: expiresAt,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${encodedClaims}.${sign(encodedClaims)}`, expiresAt };
}

export function verifyVideoAccessToken(token: string): VideoAccessClaims | null {
  const [encodedClaims, signature, extra] = token.split(".");
  if (!encodedClaims || !signature || extra !== undefined) return null;
  try {
    const expected = Buffer.from(sign(encodedClaims), "base64url");
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

    const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as Partial<VideoAccessClaims>;
    if (
      typeof claims.sub !== "string" ||
      !claims.sub ||
      (claims.scope !== "api" && claims.scope !== "media") ||
      !Number.isInteger(claims.exp) ||
      claims.exp! <= Math.floor(Date.now() / 1000) ||
      (claims.scope === "media" && (typeof claims.jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(claims.jobId)))
    ) {
      return null;
    }
    return claims as VideoAccessClaims;
  } catch {
    return null;
  }
}

export function getVideoApiCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return new Headers();

  const allowedOrigins = (process.env.VIDEO_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes(origin)) return null;

  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, Content-Disposition",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
}

export function withVideoApiCors(request: Request, response: Response) {
  const headers = getVideoApiCorsHeaders(request);
  if (headers === null) {
    return Response.json({ error: "This website is not allowed to access the video service." }, {
      status: 403,
      headers: { "Cache-Control": "no-store", Vary: "Origin" },
    });
  }
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export function videoApiPreflight(request: Request) {
  const headers = getVideoApiCorsHeaders(request);
  if (headers === null) {
    return Response.json({ error: "This website is not allowed to access the video service." }, {
      status: 403,
      headers: { "Cache-Control": "no-store", Vary: "Origin" },
    });
  }
  headers.set("Content-Length", "0");
  return new Response(null, { status: 204, headers });
}
