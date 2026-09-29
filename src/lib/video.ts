import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, type Readable as NodeReadable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import type { NextRequest } from "next/server";

export const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const MAX_REQUEST_OVERHEAD = 1024 * 1024;
const JOB_TTL_MS = 60 * 60 * 1000;
const MAX_UPLOADS_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMITS = new Map<string, number[]>();
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

export type Quality = "maximum" | "high" | "balanced";
export type Resolution = "original" | "2160" | "1440" | "1080" | "720" | "480";
export type FrameRate = "original" | "60" | "30" | "24";

type CompressionSettings = {
  resolution: Resolution;
  frameRate: FrameRate;
};

const RESOLUTION_BOUNDS: Record<Exclude<Resolution, "original">, [number, number]> = {
  "2160": [3840, 2160],
  "1440": [2560, 1440],
  "1080": [1920, 1080],
  "720": [1280, 720],
  "480": [854, 480],
};

export type VideoInfo = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  codec: string;
  frameCount?: number;
  rotation?: number;
};

export type VideoJob = {
  id: string;
  status: "processing" | "complete" | "error";
  progress: number;
  phase: string;
  input: VideoInfo;
  output?: VideoInfo;
  originalName: string;
  originalSize: number;
  settings: CompressionSettings;
  compressedSize?: number;
  error?: string;
  tempDir: string;
  inputPath: string;
  outputPath: string;
};

type ProbeStream = {
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  nb_frames?: string;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
};

type ProbeOutput = {
  streams?: ProbeStream[];
  format?: { duration?: string };
};

type UploadError = Error & { status?: number };

const jobs = new Map<string, VideoJob>();

async function* webStreamChunks(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function nodeStreamResponseBody(stream: NodeReadable): ReadableStream<Uint8Array> {
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer) => {
        if (cancelled) return;
        controller.enqueue(new Uint8Array(chunk));
        if (controller.desiredSize !== null && controller.desiredSize <= 0) stream.pause();
      });
      stream.once("end", () => {
        if (!cancelled) controller.close();
      });
      stream.once("error", (error) => {
        if (!cancelled) controller.error(error);
      });
      stream.pause();
    },
    pull() {
      if (!cancelled) stream.resume();
    },
    cancel() {
      cancelled = true;
      stream.destroy();
    },
  });
}

function makeUploadError(message: string, status = 400): UploadError {
  return Object.assign(new Error(message), { status });
}

function isQuality(value: string): value is Quality {
  return value === "maximum" || value === "high" || value === "balanced";
}

function isResolution(value: string): value is Resolution {
  return value === "original" || Object.hasOwn(RESOLUTION_BOUNDS, value);
}

function isFrameRate(value: string): value is FrameRate {
  return value === "original" || value === "60" || value === "30" || value === "24";
}

function fraction(value?: string) {
  if (!value) return 0;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function frameRate(stream: ProbeStream) {
  const average = fraction(stream.avg_frame_rate);
  const rate = average > 0 ? average : fraction(stream.r_frame_rate);
  return Math.round(rate * 1000) / 1000;
}

function normalizeRotation(rotation?: number) {
  if (rotation === undefined || !Number.isFinite(rotation)) return 0;
  return ((Math.round(rotation) % 360) + 360) % 360;
}

function executeProbe(filePath: string): Promise<ProbeOutput> {
  return new Promise((resolve, reject) => {
    execFile(
      /*turbopackIgnore: true*/
      FFPROBE_PATH,
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_frames:stream_tags=rotate:stream_side_data=rotation:format=duration",
        "-of", "json",
        filePath,
      ],
      { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          if ("code" in error && error.code === "ENOENT") {
            reject(makeUploadError("FFprobe is not installed or FFPROBE_PATH is not configured.", 503));
          } else {
            if (stderr.trim()) console.error("FFprobe rejected an uploaded video:", stderr.trim().slice(-2000));
            reject(makeUploadError("FFprobe could not read this video. Check the file and try again."));
          }
          return;
        }
        try {
          resolve(JSON.parse(stdout) as ProbeOutput);
        } catch {
          reject(makeUploadError("FFprobe returned invalid video metadata.", 422));
        }
      },
    );
  });
}

export async function probeVideo(filePath: string): Promise<VideoInfo> {
  const probe = await executeProbe(filePath);
  const stream = probe.streams?.[0];
  const duration = Number(stream?.duration || probe.format?.duration);
  const fps = stream ? frameRate(stream) : 0;
  const frameCount = Number(stream?.nb_frames);
  if (
    !stream?.codec_name ||
    !Number.isInteger(stream.width) ||
    !Number.isInteger(stream.height) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(fps) ||
    fps <= 0
  ) {
    throw makeUploadError("The uploaded file does not contain a supported video stream.", 422);
  }
  return {
    width: stream.width!,
    height: stream.height!,
    fps,
    duration,
    codec: stream.codec_name,
    frameCount: Number.isSafeInteger(frameCount) && frameCount > 0 ? frameCount : undefined,
    rotation: stream.side_data_list?.find((sideData) => Number.isFinite(sideData.rotation))?.rotation
      ?? (stream.tags?.rotate ? Number(stream.tags.rotate) : undefined),
  };
}

function safeOriginalName(name: string) {
  const leaf = name.replace(/\\/g, "/").split("/").pop() ?? "video";
  const safe = leaf.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160);
  return safe || "video";
}

function allowedMime(extension: string, mime: string) {
  const accepted: Record<string, string[]> = {
    mp4: ["video/mp4"],
    mov: ["video/quicktime", "video/mp4"],
    mkv: ["video/x-matroska", "video/mkv"],
    webm: ["video/webm"],
  };
  return accepted[extension]?.includes(mime.toLowerCase()) ?? false;
}

async function validateContainer(filePath: string, extension: string) {
  const handle = await open(filePath, "r");
  const header = Buffer.alloc(16);
  let bytesRead: number;
  try {
    ({ bytesRead } = await handle.read(header, 0, header.length, 0));
  } finally {
    await handle.close();
  }
  if (bytesRead < 8) throw makeUploadError("The uploaded video file is incomplete.");
  const isIsoBmff = header.toString("ascii", 4, 8) === "ftyp";
  const isEbml = header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if ((["mp4", "mov"].includes(extension) && !isIsoBmff) || (["mkv", "webm"].includes(extension) && !isEbml)) {
    throw makeUploadError("The file contents do not match the selected video type.");
  }
}

function consumeRateLimit(request: NextRequest) {
  const key = request.headers.get("x-real-ip")?.trim() || "unresolved-client";
  const now = Date.now();
  const recent = (RATE_LIMITS.get(key) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (recent.length >= MAX_UPLOADS_PER_HOUR) {
    RATE_LIMITS.set(key, recent);
    return false;
  }
  recent.push(now);
  RATE_LIMITS.set(key, recent);
  if (RATE_LIMITS.size > 1000) {
    for (const [address, stamps] of RATE_LIMITS) {
      if (stamps.every((stamp) => now - stamp >= RATE_WINDOW_MS)) RATE_LIMITS.delete(address);
    }
  }
  return true;
}

async function readUpload(request: NextRequest, tempDir: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw makeUploadError("Send the video as a multipart form upload.");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + MAX_REQUEST_OVERHEAD) {
    throw makeUploadError("The upload exceeds the 1 GB file-size limit.", 413);
  }
  if (!request.body) throw makeUploadError("The upload did not contain a request body.");

  const parser = Busboy({
    headers: { "content-type": contentType },
    limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 3, fieldSize: 32 },
  });
  let uploadPath = "";
  let originalName = "";
  let originalSize = 0;
  let quality: Quality = "maximum";
  const settings: CompressionSettings = { resolution: "original", frameRate: "original" };
  const receivedFields = new Set<string>();
  let fileTask: Promise<void> | undefined;
  let uploadFailure: UploadError | undefined;
  let receivedFile = false;

  const parsed = new Promise<void>((resolve, reject) => {
    parser.once("close", resolve);
    parser.once("error", () => reject(makeUploadError("The multipart upload is invalid.")));
    parser.once("filesLimit", () => { uploadFailure = makeUploadError("Only one video can be uploaded at a time."); });
    parser.once("fieldsLimit", () => { uploadFailure = makeUploadError("The upload contains unexpected fields."); });

    parser.on("field", (fieldName, value) => {
      if (receivedFields.has(fieldName)) {
        uploadFailure = makeUploadError("Compression settings must not be repeated.");
      } else {
        receivedFields.add(fieldName);
      }
      if (fieldName === "quality" && isQuality(value)) {
        quality = value;
      } else if (fieldName === "resolution" && isResolution(value)) {
        settings.resolution = value;
      } else if (fieldName === "frameRate" && isFrameRate(value)) {
        settings.frameRate = value;
      } else {
        uploadFailure = makeUploadError("The compression settings are invalid.");
      }
    });

    parser.on("file", (fieldName, file, info) => {
      if (receivedFile || fieldName !== "video") {
        uploadFailure = makeUploadError("The upload must contain one video file.");
        file.resume();
        return;
      }
      receivedFile = true;
      const extension = path.extname(info.filename).slice(1).toLowerCase();
      if (!["mp4", "mov", "mkv", "webm"].includes(extension) || !allowedMime(extension, info.mimeType)) {
        uploadFailure = makeUploadError("The file extension and MIME type must match an MP4, MOV, MKV, or WebM video.");
        file.resume();
        return;
      }
      originalName = safeOriginalName(info.filename);
      uploadPath = path.join(tempDir, `${randomUUID()}.upload`);
      file.once("limit", () => { uploadFailure = makeUploadError("The upload exceeds the 1 GB file-size limit.", 413); });
      fileTask = pipeline(file, createWriteStream(uploadPath, { flags: "wx", mode: 0o600 }));
    });
  });

  const requestStream = pipeline(Readable.from(webStreamChunks(request.body)), parser);
  try {
    await Promise.all([parsed, requestStream]);
    if (fileTask) {
      try {
        await fileTask;
      } catch {
        throw makeUploadError("The video upload could not be written to temporary storage.", 500);
      }
    }
  } catch (error) {
    if (fileTask) await fileTask.catch(() => undefined);
    throw error;
  }
  if (uploadFailure) throw uploadFailure;
  if (!receivedFile || !uploadPath) throw makeUploadError("Choose a video file to upload.");
  await validateContainer(uploadPath, path.extname(originalName).slice(1).toLowerCase());
  originalSize = (await stat(uploadPath)).size;
  if (originalSize === 0) throw makeUploadError("The uploaded video file is empty.");
  return { uploadPath, originalName, originalSize, quality, settings };
}

function publicJob(job: VideoJob) {
  return {
    id: job.id,
    status: job.status,
    progress: Math.round(job.progress),
    phase: job.phase,
    input: job.input,
    output: job.output,
    originalName: job.originalName,
    originalSize: job.originalSize,
    settings: job.settings,
    compressedSize: job.compressedSize,
    error: job.error,
  };
}

async function cleanJob(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  try {
    await rm(job.tempDir, { recursive: true, force: true });
    jobs.delete(id);
  } catch (error) {
    console.error(`Could not remove temporary video files for job ${id}:`, error);
  }
}

function scheduleCleanup(id: string) {
  const timer = setTimeout(() => { void cleanJob(id); }, JOB_TTL_MS);
  timer.unref();
}

function setJobError(job: VideoJob, message: string, detail?: string) {
  job.status = "error";
  job.phase = "failed";
  job.error = message;
  if (detail) console.error(`Video compression failed for job ${job.id}: ${detail}`);
  scheduleCleanup(job.id);
}

function runCompression(job: VideoJob, quality: Quality) {
  if (job.input.width % 2 !== 0 || job.input.height % 2 !== 0) {
    setJobError(job, "This video has odd pixel dimensions, which cannot be encoded as yuv420p without changing its resolution.");
    return;
  }

  const crf = quality === "maximum" ? "18" : quality === "high" ? "20" : "23";
  const filters: string[] = [];
  const maxHeight = job.settings.resolution === "original"
    ? job.input.height
    : RESOLUTION_BOUNDS[job.settings.resolution][1];
  const maxWidth = job.settings.resolution === "original"
    ? job.input.width
    : RESOLUTION_BOUNDS[job.settings.resolution][0];
  const isPortrait = normalizeRotation(job.input.rotation) === 0
    && job.input.height > job.input.width;
  const targetWidth = isPortrait ? maxHeight : maxWidth;
  const targetHeight = isPortrait ? maxWidth : maxHeight;
  if (job.settings.resolution !== "original") {
    filters.push(`scale=w='min(iw,${targetWidth})':h='min(ih,${targetHeight})':force_original_aspect_ratio=decrease:force_divisible_by=2`);
  }
  const targetFrameRate = job.settings.frameRate === "original" ? undefined : Number(job.settings.frameRate);
  const hasFrameRateSelection = targetFrameRate !== undefined;
  if (hasFrameRateSelection) filters.push(`fps=${targetFrameRate}`);
  const args = [
    "-hide_banner", "-loglevel", "error", "-nostats", "-y",
    "-noautorotate",
    "-i", job.inputPath,
    "-map", "0:v:0", "-map", "0:a?",
    "-map_metadata", "0",
    "-c:v", "libx264", "-preset", "medium", "-crf", crf,
    ...(filters.length ? ["-vf", filters.join(",")] : []),
    "-pix_fmt", "yuv420p", "-fps_mode", "passthrough",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-progress", "pipe:1",
    job.outputPath,
  ];

  let stderr = "";
  let stdoutBuffer = "";
  let failed = false;
  const child = spawn(
    /*turbopackIgnore: true*/
    FFMPEG_PATH,
    args,
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      if (key === "out_time_us") {
        const seconds = Number(value) / 1_000_000;
        if (Number.isFinite(seconds) && job.input.duration > 0) {
          job.progress = Math.min(99, Math.max(0, (seconds / job.input.duration) * 100));
        }
      }
      if (key === "progress" && value === "end") job.phase = "Verifying output";
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-8_000);
  });
  child.once("error", (error) => {
    failed = true;
    const message = error.message.includes("ENOENT")
      ? "FFmpeg is not installed or FFMPEG_PATH is not configured."
      : "The video encoder could not be started.";
    setJobError(job, message, error.message);
  });
  child.once("close", async (code) => {
    if (failed || job.status !== "processing") return;
    if (code !== 0) {
      setJobError(job, "FFmpeg could not encode this video. Try another supported video file.", stderr.trim());
      return;
    }
    try {
      const output = await probeVideo(job.outputPath);
      if (output.codec !== "h264") throw new Error(`Expected H.264 output, found ${output.codec}.`);
      if (output.width !== job.input.width || output.height !== job.input.height) {
        if (job.settings.resolution === "original") {
          throw new Error(`Output dimensions ${output.width}x${output.height} differ from input ${job.input.width}x${job.input.height}.`);
        }
      }
      if (output.width > job.input.width || output.height > job.input.height) {
        throw new Error("The output resolution is larger than the original video.");
      }
      if (Math.abs(output.width / output.height - job.input.width / job.input.height) > 0.005) {
        throw new Error("The output aspect ratio differs from the original video.");
      }
      if (output.width > targetWidth || output.height > targetHeight) {
        throw new Error(`Output dimensions ${output.width}x${output.height} exceed the selected resolution limit.`);
      }
      if (normalizeRotation(output.rotation) !== normalizeRotation(job.input.rotation)) {
        throw new Error("The output orientation differs from the original video.");
      }
      if (
        job.input.frameCount !== undefined &&
        output.frameCount !== undefined &&
        job.settings.frameRate === "original" &&
        job.input.frameCount !== output.frameCount
      ) {
        throw new Error(`Output frame count ${output.frameCount} differs from input ${job.input.frameCount}.`);
      }
      if (hasFrameRateSelection) {
        if (Math.abs(output.fps - targetFrameRate) > Math.max(0.1, targetFrameRate * 0.001)) {
          throw new Error(`Output frame rate ${output.fps} does not match the selected ${targetFrameRate} FPS.`);
        }
      } else if (
        Math.abs(output.fps - job.input.fps) > Math.max(0.1, job.input.fps * 0.001) &&
        (job.input.frameCount === undefined || output.frameCount === undefined)
      ) {
        throw new Error(`Output frame rate ${output.fps} differs from input ${job.input.fps}.`);
      }
      if (Math.abs(output.duration - job.input.duration) > Math.max(0.1, 2 / job.input.fps)) {
        throw new Error(`Output duration ${output.duration} differs from input ${job.input.duration}.`);
      }
      const outputStat = await stat(job.outputPath);
      await rm(job.inputPath, { force: true });
      job.output = output;
      job.compressedSize = outputStat.size;
      job.progress = 100;
      job.phase = "Complete";
      job.status = "complete";
      scheduleCleanup(job.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown output verification failure.";
      setJobError(
        job,
        `The encoded video did not pass output verification. No file is available to download. ${detail}`,
        detail,
      );
    }
  });
}

export async function createCompressionJob(request: NextRequest) {
  if (!consumeRateLimit(request)) {
    throw makeUploadError("Upload limit reached. Please wait an hour before trying again.", 429);
  }
  const tempDir = await mkdtemp(path.join(tmpdir(), "kyro-tools-"));
  try {
    const upload = await readUpload(request, tempDir);
    const input = await probeVideo(upload.uploadPath);
    const id = randomUUID();
    const outputPath = path.join(tempDir, `${randomUUID()}.mp4`);
    const job: VideoJob = {
      id,
      status: "processing",
      progress: 0,
      phase: "Encoding",
      input,
      originalName: upload.originalName,
      originalSize: upload.originalSize,
      settings: upload.settings,
      tempDir,
      inputPath: upload.uploadPath,
      outputPath,
    };
    jobs.set(id, job);
    void runCompression(job, upload.quality);
    return publicJob(job);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function getJob(id: string) {
  return jobs.get(id);
}

export function getPublicJob(job: VideoJob) {
  return publicJob(job);
}

export function getUploadError(error: unknown) {
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return { status: error.status, message: error.message };
  }
  console.error("Unexpected video upload failure:", error);
  return { status: 500, message: "The video could not be uploaded. Please try again." };
}

export function videoStream(filePath: string, rangeHeader: string | null, filename: string, attachment: boolean) {
  return stat(filePath).then((fileStat) => {
    const size = fileStat.size;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": "video/mp4",
      "X-Content-Type-Options": "nosniff",
    });
    const disposition = attachment ? "attachment" : "inline";
    headers.set("Content-Disposition", `${disposition}; filename="${filename}"`);
    if (!rangeHeader) {
      headers.set("Content-Length", String(size));
      return new Response(nodeStreamResponseBody(createReadStream(filePath)), { status: 200, headers });
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (!match[1] && !match[2])) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    let end = match[2] && match[1] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    return new Response(nodeStreamResponseBody(createReadStream(filePath, { start, end })), { status: 206, headers });
  });
}

export function getDownloadName(originalName: string) {
  const base = path.parse(originalName).name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "kyro-video";
  return `${base}-compressed.mp4`;
}
