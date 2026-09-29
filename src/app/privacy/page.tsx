import type { Metadata } from "next";
import LegalPage from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | KYRO TOOLS",
  description: "How KYRO TOOLS handles account information, uploads, and service data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy describes the information KYRO TOOLS uses to provide video compression and protect the service."
    >
      <section>
        <h2>1. Information we process</h2>
        <ul>
          <li>
            <strong>Discord sign-in information:</strong> your Discord account identifier and
            profile name, plus information needed to check your server membership and roles.
          </li>
          <li>
            <strong>Sign-in session:</strong> Auth.js maintains a session in a browser cookie. The
            session supports sign-in and access checks and expires according to the configured
            session lifetime.
          </li>
          <li>
            <strong>Video and job information:</strong> the video you choose to upload, its
            filename and file size, technical media details, selected settings, and compression
            status and output.
          </li>
          <li>
            <strong>Network and diagnostic information:</strong> an IP address may be used for
            upload rate limiting and security. Technical errors and service requests may also be
            recorded by the application or its hosting providers.
          </li>
        </ul>
      </section>
      <section>
        <h2>2. How videos are handled</h2>
        <p>
          The browser sends your video directly to KYRO TOOLS’ video-processing service over
          HTTPS. The service temporarily stores the file to run FFmpeg and verify the output.
          Source files are deleted after successful encoding. Temporary job files and output files
          are scheduled for deletion within one hour; active files may be removed earlier if the
          service restarts.
        </p>
        <p>
          Video files are not intended to be permanently stored, shared publicly, used for
          advertising, or used to train machine-learning models. Do not treat KYRO TOOLS as a
          backup service.
        </p>
      </section>
      <section>
        <h2>3. Why we use information</h2>
        <ul>
          <li>To authenticate you and verify whether you may use the workspace.</li>
          <li>To receive, compress, verify, preview, and return the video you requested.</li>
          <li>To enforce upload limits, prevent abuse, secure the service, and troubleshoot failures.</li>
        </ul>
      </section>
      <section>
        <h2>4. Service providers and sharing</h2>
        <p>
          We use Discord to authenticate accounts and check server access, Vercel to host the
          website, and Railway to host the video-processing service. These providers process
          information as needed to deliver their services and may handle operational logs under
          their own policies. We do not sell your personal information.
        </p>
        <p>
          KYRO TOOLS does not currently connect to TikTok or send videos or account information to
          TikTok. When you independently upload a downloaded video to another platform, that
          platform’s privacy policy applies.
        </p>
      </section>
      <section>
        <h2>5. Retention and security</h2>
        <p>
          Video files and in-memory job details are temporary, as described above. The service
          does not maintain a permanent video library. Sign-in cookies remain until they expire or
          you sign out. Operational logs may be retained by the service or its hosting providers
          according to their settings and policies.
        </p>
        <p>
          We use HTTPS, access checks, temporary file storage, and automatic cleanup to protect
          uploads. No internet service can guarantee absolute security.
        </p>
      </section>
      <section>
        <h2>6. Your choices and contact</h2>
        <p>
          You can stop using the service, sign out, and remove local browser data. For requests
          about information associated with your use of KYRO TOOLS, contact us through the Discord
          server linked below. We may need to verify your identity before responding.
        </p>
      </section>
    </LegalPage>
  );
}
