import type { Metadata } from "next";
import LegalPage from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | KYRO TOOLS",
  description: "Terms for using the KYRO TOOLS video compression service.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms apply when you access or use KYRO TOOLS. By using the service, you agree to them."
    >
      <section>
        <h2>1. The service</h2>
        <p>
          KYRO TOOLS provides a video upload and compression service. You can choose compression
          settings, have a video processed using FFmpeg, and download the resulting file. The service
          checks output details such as codec, dimensions, frame rate, and duration.
        </p>
        <p>
          KYRO TOOLS does not currently connect to TikTok or publish videos to TikTok. You must
          download a processed video and upload it to other services yourself. Third-party platforms
          may process or re-encode videos after upload; KYRO TOOLS cannot control or guarantee their
          resulting quality.
        </p>
      </section>
      <section>
        <h2>2. Access and accounts</h2>
        <p>
          Access may require signing in with Discord and meeting the configured server membership
          or role requirements. You are responsible for your account and for keeping access to it
          secure. Access can be unavailable if a third-party sign-in provider or the service is
          unavailable.
        </p>
      </section>
      <section>
        <h2>3. Your videos and acceptable use</h2>
        <p>
          You retain your rights to videos you upload. You must own or have permission to upload,
          process, and download each video. Do not use KYRO TOOLS to violate another person’s
          rights, break the law, distribute harmful content, or interfere with the service or its
          security.
        </p>
        <p>
          You authorize KYRO TOOLS to temporarily receive and process your selected video solely to
          provide the requested compression and download. Do not upload content you are not
          authorized to share with the service.
        </p>
      </section>
      <section>
        <h2>4. Temporary files and availability</h2>
        <p>
          Videos are processed on a temporary basis and are not intended to be stored as a library
          or backup. Source videos are removed after successful processing; temporary job files and
          output videos are scheduled for deletion within one hour. Active jobs may be interrupted
          by service restarts, and downloads may become unavailable after cleanup.
        </p>
        <p>
          The service is provided as available. Compression results depend on the source video and
          selected settings. We do not guarantee uninterrupted access, a particular file-size
          reduction, or that every input format will process successfully.
        </p>
      </section>
      <section>
        <h2>5. Third-party services</h2>
        <p>
          KYRO TOOLS uses Discord for sign-in and role verification, and Vercel and Railway to host
          the website and video-processing service. Their services are subject to their own terms
          and policies. KYRO TOOLS is not affiliated with or endorsed by TikTok.
        </p>
      </section>
      <section>
        <h2>6. Changes and contact</h2>
        <p>
          We may update the service or these terms. The current version will be published on this
          page with its effective date. Continued use after an update means you accept the revised
          terms, to the extent permitted by applicable law.
        </p>
        <p>
          For questions, use the KYRO TOOLS Discord contact link below. These terms do not limit
          any rights that cannot be limited under applicable law.
        </p>
      </section>
    </LegalPage>
  );
}
