"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  FileVideo2,
  Gauge,
  LockKeyhole,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";
type Quality = "maximum" | "high" | "balanced";
type Resolution = "original" | "2160" | "1440" | "1080" | "720" | "480";
type FrameRate = "original" | "60" | "30" | "24";
type CompressionSettings = { resolution: Resolution; frameRate: FrameRate };

type VideoInfo = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  codec: string;
};

type Job = {
  id: string;
  status: "processing" | "complete" | "error";
  progress: number;
  phase: string;
  settings: CompressionSettings;
  input: VideoInfo;
  output?: VideoInfo;
  originalName: string;
  originalSize: number;
  compressedSize?: number;
  error?: string;
};

const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const videoApiOrigin = process.env.NEXT_PUBLIC_VIDEO_API_URL?.replace(/\/+$/, "") ?? "";
let cachedApiToken: { token: string; expiresAt: number } | null = null;
const qualities: { value: Quality; label: string; detail: string }[] = [
  { value: "maximum", label: "Maximum quality", detail: "CRF 18 · near-lossless" },
  { value: "high", label: "High quality", detail: "CRF 20 · smaller files" },
  { value: "balanced", label: "Balanced", detail: "CRF 23 · compact output" },
];
const resolutionOptions: { value: Resolution; label: string }[] = [
  { value: "original", label: "Keep original" },
  { value: "2160", label: "2160p" },
  { value: "1440", label: "1440p" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
];
const frameRateOptions: { value: FrameRate; label: string }[] = [
  { value: "original", label: "Keep original" },
  { value: "60", label: "60 FPS" },
  { value: "30", label: "30 FPS" },
  { value: "24", label: "24 FPS" },
];

function selectedLabel<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((option) => option.value === value)?.label ?? options[0].label;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatFps(fps: number) {
  return Number.isInteger(fps) ? String(fps) : fps.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

async function getVideoApiToken(scope: "api" | "media" = "api", jobId?: string) {
  if (!videoApiOrigin) return null;
  if (scope === "api" && cachedApiToken && cachedApiToken.expiresAt * 1000 > Date.now() + 30_000) {
    return cachedApiToken.token;
  }

  const response = await fetch("/api/video-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, ...(jobId ? { jobId } : {}) }),
    cache: "no-store",
  });
  const result = await response.json() as { token?: string; expiresAt?: number; error?: string };
  if (!response.ok || !result.token || !result.expiresAt) {
    throw new Error(result.error || "Could not authorize the video service.");
  }
  if (scope === "api") cachedApiToken = { token: result.token, expiresAt: result.expiresAt };
  return result.token;
}

function Landscape({ compressed = false }: { compressed?: boolean }) {
  return (
    <div className={`landscape ${compressed ? "landscape-compressed" : ""}`}>
      <div className="landscape-sky" />
      <div className="landscape-sun" />
      <div className="landscape-ridge landscape-ridge-back" />
      <div className="landscape-ridge landscape-ridge-front" />
      <div className="landscape-ground" />
      <div className="landscape-grain" />
    </div>
  );
}

function ComparisonCard() {
  const [split, setSplit] = useState(51);

  return (
    <div className="comparison-card">
      <div className="comparison-topline">
        <div className="comparison-title">
          <span className="live-dot" />
          <span>QUALITY, PRESERVED</span>
        </div>
        <span className="comparison-duration">00:27</span>
      </div>
      <div className="comparison-frame">
        <Landscape />
        <div className="comparison-after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          <Landscape compressed />
        </div>
        <span className="preview-label preview-label-before">BEFORE</span>
        <span className="preview-label preview-label-after">COMPRESSED</span>
        <div className="comparison-divider" style={{ left: `${split}%` }}>
          <span className="comparison-grip">
            <span />
            <span />
          </span>
        </div>
        <input
          aria-label="Drag to compare original and compressed video"
          className="comparison-range"
          type="range"
          min="8"
          max="92"
          value={split}
          onChange={(event) => setSplit(Number(event.target.value))}
        />
        <div className="preview-spec preview-spec-before">1080p <i /> 60 FPS</div>
        <div className="preview-spec preview-spec-after">1080p <i /> 60 FPS</div>
        <div className="scene-caption">
          <span>KEEP THE MOMENT.</span>
          <span>LOSE THE WEIGHT.</span>
        </div>
      </div>
      <div className="comparison-stats">
        <div>
          <span className="stat-label">ORIGINAL</span>
          <strong>42.8 <small>MB</small></strong>
        </div>
        <ArrowRight className="stats-arrow" size={17} strokeWidth={1.7} />
        <div>
          <span className="stat-label">COMPRESSED</span>
          <strong>18.4 <small>MB</small></strong>
        </div>
        <div className="saved-pill"><ArrowDownToLine size={13} /> 57% saved</div>
      </div>
      <div className="comparison-footnote">
        <span><Check size={13} /> Same resolution</span>
        <span><Check size={13} /> Same frame rate</span>
        <span><LockKeyhole size={12} /> Private by default</span>
      </div>
    </div>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#" aria-label="Kyro Tools home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-name">KYRO<span>.</span></span>
        </a>
        <span className="engine-badge"><span /> VIDEO ENGINE</span>
        <nav className={`main-nav ${menuOpen ? "main-nav-open" : ""}`} aria-label="Main navigation">
          <a href="#compress" onClick={() => setMenuOpen(false)}>Compress</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#guide" onClick={() => setMenuOpen(false)}>Guide</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button search-button" aria-label="Search" onClick={() => document.getElementById("guide")?.scrollIntoView({ behavior: "smooth" })}>
            <Search size={17} strokeWidth={1.8} />
          </button>
          <a href="#compress" className="header-try">Try free <ArrowRight size={14} /></a>
          <a href="#compress" className="sign-in">Sign in</a>
          <button className="icon-button mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default function Workspace() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [quality, setQuality] = useState<Quality>("maximum");
  const [resolution, setResolution] = useState<Resolution>("original");
  const [frameRate, setFrameRate] = useState<FrameRate>("original");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [mediaToken, setMediaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [localVideo, setLocalVideo] = useState<{ url: string; width: number; height: number; duration: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setError("");
    setJob(null);
    setPhase("idle");
    if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    videoUrl.current = null;
    setLocalVideo(null);
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("That file is over the 1 GB limit. Choose a smaller video to continue.");
      return;
    }
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["mp4", "mov", "mkv", "webm"].includes(extension)) {
      setFile(null);
      setError("Choose an MP4, MOV, MKV, or WebM video.");
      return;
    }
    setFile(nextFile);
    const url = URL.createObjectURL(nextFile);
    videoUrl.current = url;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setLocalVideo({ url, width: video.videoWidth, height: video.videoHeight, duration: video.duration });
    };
    video.src = url;
    setLocalVideo({ url, width: 0, height: 0, duration: 0 });
  }

  async function pollJob(id: string) {
    try {
      const token = await getVideoApiToken();
      const response = await fetch(`${videoApiOrigin}/api/jobs/${id}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json() as Job & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not check compression status.");
      setJob(data);
      if (data.status === "complete") {
        const accessToken = await getVideoApiToken("media", id);
        setMediaToken(accessToken);
        setPhase("done");
        return;
      }
      if (data.status === "error") {
        setError(data.error || "Compression could not be completed.");
        setPhase("error");
        return;
      }
      pollTimer.current = setTimeout(() => { void pollJob(id); }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not check compression status.");
      setPhase("error");
    }
  }

  async function startCompression() {
    if (!file || phase === "uploading" || phase === "processing") return;
    setError("");
    setJob(null);
    setMediaToken(null);
    setUploadProgress(0);
    setPhase("uploading");
    let token: string | null;
    try {
      token = await getVideoApiToken();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not authorize the video service.");
      setPhase("error");
      return;
    }
    const form = new FormData();
    form.append("video", file);
    form.append("quality", quality);
    form.append("resolution", resolution);
    form.append("frameRate", frameRate);
    const request = new XMLHttpRequest();
    request.open("POST", `${videoApiOrigin}/api/compress`);
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => {
      setError("The upload was interrupted. Check your connection and try again.");
      setPhase("error");
    };
    request.onload = () => {
      let response: { error?: string; job?: Job };
      try {
        response = JSON.parse(request.responseText);
      } catch {
        setError("The server returned an unexpected response. Please try again.");
        setPhase("error");
        return;
      }
      if (request.status < 200 || request.status >= 300 || !response.job) {
        setError(response.error || "The video could not be uploaded.");
        setPhase("error");
        return;
      }
      setJob(response.job);
      setPhase("processing");
      pollJob(response.job.id);
    };
    request.send(form);
  }

  function reset() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    videoUrl.current = null;
    setFile(null);
    setLocalVideo(null);
    setJob(null);
    setMediaToken(null);
    setError("");
    setUploadProgress(0);
    setPhase("idle");
    if (fileInput.current) fileInput.current.value = "";
    document.getElementById("compress")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const currentProgress = phase === "uploading" ? uploadProgress : job?.progress ?? 0;
  const settingsDisabled = phase === "uploading" || phase === "processing";
  const savings = job?.compressedSize && job.originalSize
    ? Math.round((1 - job.compressedSize / job.originalSize) * 100)
    : 0;
  const mediaQuery = mediaToken ? `?token=${encodeURIComponent(mediaToken)}` : "";
  const videoApiPath = (jobId: string, path: "video" | "download") =>
    `${videoApiOrigin}/api/jobs/${jobId}/${path}${mediaQuery}`;

  return (
    <>
      <Header />
      <main>
        <section className="hero section-shell" id="top">
          <div className="hero-copy">
            <div className="hero-eyebrows">
              <span className="engine-live"><span className="live-dot" /> <Zap size={12} fill="currentColor" /> KYRO ENGINE · LIVE</span>
              <span className="new-badge">NEW <i /> 1080P · 60 FPS</span>
            </div>
            <h1>Keep the quality.<br /><span>Lose the file size.</span></h1>
            <p className="hero-description">
              Your videos, beautifully optimized. High-quality H.264 compression that keeps your resolution sharp and every frame smooth.
            </p>
            <div className="hero-buttons">
              <a className="button button-primary" href="#compress">Compress video <ArrowRight size={16} /></a>
              <a className="button button-secondary" href="#how-it-works"><Play size={14} fill="currentColor" /> See how it works</a>
            </div>
            <div className="hero-specs">
              <span>1080p</span><i /><span>60 FPS</span><i /><span>H.264</span><i /><span>High quality</span>
            </div>
          </div>
          <div className="hero-visual">
            <ComparisonCard />
            <div className="float-note"><span className="float-note-icon"><ShieldCheck size={15} /></span>            <span><strong>Just your video.</strong><small>Automatically deleted after one hour</small></span></div>
          </div>
          <div className="hero-index"><span>01</span><i /> BUILT FOR THE NEXT FRAME</div>
        </section>

        <section className="trust-strip" id="features">
          <div className="trust-inner">
            <span className="trust-intro">A better way to hit upload.</span>
            <div className="trust-point"><Gauge size={17} /><span>Less waiting</span></div>
            <div className="trust-point"><Sparkles size={16} /><span>More detail</span></div>
            <div className="trust-point"><LockKeyhole size={15} /><span>Private by design</span></div>
            <span className="trust-note">NO WATERMARKS <i /> NO SURPRISES</span>
          </div>
        </section>

        <section className="compress-section section-shell" id="compress">
          <div className="section-heading">
            <div>
              <div className="section-kicker"><span>01</span> THE CREATOR WORKSPACE</div>
              <h2>Compress your video<span>.</span></h2>
              <p>Upload your video and we’ll optimize it while preserving the original resolution and frame rate.</p>
            </div>
            <div className="secure-note"><LockKeyhole size={15} /><span>Private upload<br /><strong>Deleted after 1 hour</strong></span></div>
          </div>

          <div className="workspace-grid">
            <div className="upload-panel panel">
              <div className="panel-topline"><span className="panel-title"><span className="step-dot">1</span> YOUR VIDEO</span><span className="optional-note">UP TO 1 GB</span></div>
              {phase === "done" && job ? (
                <div className="result-content">
                  <div className="result-heading"><span className="result-check"><CheckCircle2 size={20} /></span><div><h3>Your video is ready.</h3><p>Verified output, ready to download.</p></div></div>
                  <div className="portrait-video-frame">
                    <video controls playsInline src={videoApiPath(job.id, "video")} />
                  </div>
                  <div className="result-stats">
                    <div><span>ORIGINAL SIZE</span><strong>{formatBytes(job.originalSize)}</strong></div>
                    <div><span>COMPRESSED</span><strong>{formatBytes(job.compressedSize ?? 0)}</strong></div>
                    <div><span>{savings >= 0 ? "SPACE SAVED" : "SIZE INCREASE"}</span><strong className={savings >= 0 ? "lime-text" : "size-increase"}>{savings >= 0 ? `${savings}%` : `${Math.abs(savings)}% larger`}</strong></div>
                    <div><span>RESOLUTION</span><strong>{job.output?.width} × {job.output?.height}</strong></div>
                    <div><span>FRAME RATE</span><strong>{formatFps(job.output?.fps ?? 0)} FPS</strong></div>
                    <div><span>DURATION</span><strong>{formatDuration(job.output?.duration ?? 0)}</strong></div>
                    <div><span>VIDEO CODEC</span><strong>{job.output?.codec.toUpperCase()}</strong></div>
                  </div>
                  <div className="verified-line"><Check size={14} /> FFprobe verified the output against your selected settings</div>
                  <div className="result-actions">
                    <a className="button button-primary result-download" href={videoApiPath(job.id, "download")}><ArrowDownToLine size={16} /> Download video</a>
                    <button className="button button-secondary" onClick={reset}>Compress another</button>
                  </div>
                </div>
              ) : phase === "uploading" || phase === "processing" ? (
                <div className="processing-content">
                  {phase === "processing" && job && localVideo && (
                    <div className="processing-preview">
                      <div className="portrait-video-frame">
                        <video src={localVideo.url} controls playsInline preload="metadata" />
                      </div>
                      <div><span>{job.input.width} × {job.input.height}</span><i /><span>{formatFps(job.input.fps)} FPS</span><i /><span>{formatDuration(job.input.duration)}</span><i /><span>{job.input.codec.toUpperCase()}</span></div>
                    </div>
                  )}
                  <div className="processing-art"><div className="processing-ring"><Clapperboard size={28} strokeWidth={1.3} /></div><span className="processing-orbit orbit-one" /><span className="processing-orbit orbit-two" /></div>
                  <span className="processing-kicker">{phase === "uploading" ? "SECURE UPLOAD" : "KYRO ENCODER"}</span>
                  <h3>{phase === "uploading" ? "Uploading your video..." : "Optimizing your video..."}</h3>
                  <p>{phase === "uploading" ? "Sending your file securely to the encoder." : "Applying your resolution and frame-rate settings."}</p>
                  <div className="progress-meta"><span>{phase === "uploading" ? "UPLOAD PROGRESS" : "ENCODING PROGRESS"}</span><strong>{currentProgress}%</strong></div>
                  <div className="progress-track"><span style={{ width: `${currentProgress}%` }} /></div>
                  <div className="processing-details">
                    <span>{job ? `${job.input.width} × ${job.input.height} · ${formatFps(job.input.fps)} FPS` : file?.name}</span>
                    <span>{phase === "uploading" ? formatBytes(file?.size ?? 0) : job?.phase || "Preparing encoder"}</span>
                  </div>
                  <div className="processing-status"><span className="live-dot" /> {phase === "uploading" ? "Transferring file" : "Encoding · FFmpeg"}</div>
                </div>
              ) : (
                <>
                  <label
                    className={`drop-zone ${dragging ? "drop-zone-active" : ""} ${file ? "drop-zone-selected" : ""}`}
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
                  >
                    <input
                      ref={fileInput}
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
                      onChange={(event) => chooseFile(event.target.files?.[0])}
                    />
                    {file ? (
                      <div className="selected-file-content">
                        {localVideo?.width ? <div className="portrait-video-frame"><video src={localVideo.url} controls playsInline preload="metadata" /></div> : <span className="selection-loading"><FileVideo2 size={20} /> Reading video preview…</span>}
                        <div className="selected-file">
                          <div className="selected-file-icon"><FileVideo2 size={23} /></div>
                          <div className="selected-file-copy"><strong>{file.name}</strong><span>{formatBytes(file.size)} <i /> {localVideo?.width ? `${localVideo.width} × ${localVideo.height}` : "Reading video details"}</span></div>
                          <button className="remove-file" type="button" aria-label="Remove selected video" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFile(null); setLocalVideo(null); if (videoUrl.current) URL.revokeObjectURL(videoUrl.current); videoUrl.current = null; if (fileInput.current) fileInput.current.value = ""; }}><X size={17} /></button>
                        </div>
                        <div className="selection-details"><span>Resolution <strong>{localVideo?.width ? `${localVideo.width} × ${localVideo.height}` : "Reading…"}</strong></span><span>Duration <strong>{localVideo?.duration ? formatDuration(localVideo.duration) : "Reading…"}</strong></span><span>Frame rate <strong>{job ? `${formatFps(job.input.fps)} FPS` : "Read on upload"}</strong></span><span>Codec <strong>{job?.input.codec.toUpperCase() ?? "Read on upload"}</strong></span></div>
                      </div>
                    ) : (
                      <>
                        <span className="upload-symbol"><Upload size={21} strokeWidth={1.6} /></span>
                        <strong>Drop your video here</strong>
                        <span className="drop-divider"><i /> <b>or</b> <i /></span>
                        <span className="choose-file">Choose video <ArrowRight size={14} /></span>
                        <span className="drop-hint">MP4, MOV, MKV or WebM <i /> Maximum file size 1 GB</span>
                      </>
                    )}
                  </label>
                  {error && <div className="error-message" role="alert"><CircleHelp size={15} /> {error}</div>}
                  <div className="upload-assurances"><span><LockKeyhole size={13} /> Private upload</span><span><ShieldCheck size={14} /> Auto-deleted</span><span><CheckCircle2 size={14} /> No watermark</span></div>
                </>
              )}
            </div>

            <div className="settings-panel panel">
              <div className="panel-topline"><span className="panel-title"><span className="step-dot">2</span> OUTPUT SETTINGS</span><span className="optional-note">YOU’RE IN CONTROL</span></div>
              {phase === "done" ? (
                <div className="verified-output">
                  <span className="verified-icon"><CheckCircle2 size={20} /></span>
                  <h3>Quality, accounted for.</h3>
                  <p>Your actual output, verified by FFprobe after encoding.</p>
                  <div className="output-row"><span>Resolution</span><strong>{job?.output?.width} × {job?.output?.height}</strong></div>
                  <div className="output-row"><span>Frame rate</span><strong>{formatFps(job?.output?.fps ?? 0)} FPS</strong></div>
                  <div className="output-row"><span>Resolution setting</span><strong>{selectedLabel(resolutionOptions, job?.settings.resolution ?? "original")}</strong></div>
                  <div className="output-row"><span>Frame-rate setting</span><strong>{selectedLabel(frameRateOptions, job?.settings.frameRate ?? "original")}</strong></div>
                  <div className="output-row"><span>Video codec</span><strong>{job?.output?.codec.toUpperCase()}</strong></div>
                  <div className="output-row"><span>Audio</span><strong>AAC · 192 kbps</strong></div>
                  <div className="private-callout"><LockKeyhole size={15} /><span><strong>Your file stays yours.</strong><br />It will be automatically deleted after 1 hour.</span></div>
                </div>
              ) : (
                <>
                  <div className="setting-group">
                    <div className="setting-label"><span>Compression quality</span><span className="setting-hint">CHOOSE YOUR BALANCE</span></div>
                    <div className="quality-options">
                      {qualities.map((option) => (
                        <button key={option.value} className={`quality-option ${quality === option.value ? "quality-option-active" : ""}`} onClick={() => setQuality(option.value)} disabled={phase !== "idle"} aria-pressed={quality === option.value}>
                          <span className="quality-radio">{quality === option.value && <i />}</span>
                          <span className="quality-copy"><strong>{option.label}</strong><small>{option.detail}</small></span>
                          {option.value === "maximum" && <span className="recommended-tag">BEST DETAIL</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-group technical-settings">
                    <label className="setting-row" htmlFor="output-resolution"><span><span className="setting-icon"><Clapperboard size={15} /></span>Resolution</span><span className="setting-select-wrap"><select id="output-resolution" className="setting-select" value={resolution} onChange={(event) => setResolution(event.target.value as Resolution)} disabled={settingsDisabled} aria-label="Output resolution">{resolutionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} /></span></label>
                    <label className="setting-row" htmlFor="output-frame-rate"><span><span className="setting-icon"><Gauge size={15} /></span>Frame rate</span><span className="setting-select-wrap"><select id="output-frame-rate" className="setting-select" value={frameRate} onChange={(event) => setFrameRate(event.target.value as FrameRate)} disabled={settingsDisabled} aria-label="Output frame rate">{frameRateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} /></span></label>
                    <div className="setting-row"><span><span className="setting-icon"><AudioLines size={15} /></span>Audio</span><strong>High quality AAC <ChevronDown size={14} /></strong></div>
                  </div>
                  <div className="settings-footnote"><Check size={13} /> Output target: {resolution === "original" ? "keep original resolution" : `up to ${selectedLabel(resolutionOptions, resolution)}`} · {frameRate === "original" ? "keep original FPS" : selectedLabel(frameRateOptions, frameRate)}. Smaller videos won’t upscale.</div>
                  <button className="button button-primary start-button" onClick={startCompression} disabled={!file || phase !== "idle"}>
                    Start compression <ArrowRight size={16} />
                  </button>
                  <div className="settings-lock"><LockKeyhole size={12} /> Your original is never modified.</div>
                  {phase === "error" && error && <div className="error-message" role="alert"><CircleHelp size={15} /> {error}<button className="retry-button" onClick={() => file && startCompression()}>Try again</button></div>}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="how-section section-shell" id="how-it-works">
          <div className="how-intro">
            <div className="section-kicker"><span>02</span> SIMPLE BY DESIGN</div>
            <h2>Three steps.<br /><span>One lighter upload.</span></h2>
            <p>All the quality you put in, without the weight you don’t need.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card"><span className="step-number">01</span><span className="step-icon"><Upload size={19} /></span><h3>Drop it in</h3><p>Choose a video up to 1 GB. MP4, MOV, MKV and WebM all welcome.</p></article>
            <article className="step-card"><span className="step-number">02</span><span className="step-icon"><Zap size={18} /></span><h3>We tune it</h3><p>Choose output limits, or keep your original resolution and frame rate as-is.</p></article>
            <article className="step-card"><span className="step-number">03</span><span className="step-icon"><ArrowDownToLine size={19} /></span><h3>Take it with you</h3><p>Download a share-ready H.264 video. Your upload is deleted automatically.</p></article>
          </div>
        </section>

        <section className="closing-cta section-shell" id="pricing">
          <div className="closing-mark"><span className="brand-mark"><span /><span /><span /></span></div>
          <div><span className="section-kicker">MADE FOR WHAT’S NEXT</span><h2>Your next post, <span>minus the wait.</span></h2><p>Free to use. No watermark. No account needed.</p></div>
          <a className="button button-primary" href="#compress">Compress a video <ArrowRight size={16} /></a>
        </section>
      </main>
      <footer className="site-footer section-shell" id="guide">
        <a className="brand footer-brand" href="#top"><span className="brand-mark"><span /><span /><span /></span><span className="brand-name">KYRO<span>.</span></span></a>
        <span>Thoughtful video compression for creators.</span>
        <div className="footer-meta"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><span>YOUR VIDEOS ARE AUTOMATICALLY DELETED</span><span>© 2026 KYRO TOOLS</span></div>
      </footer>
    </>
  );
}
