export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="!text-ink-soft !text-[12.5px]">Last updated: July 2026</p>

      <h2>Who we are</h2>
      <p>
        AI Receptionist provides AI-powered customer communication tools for small businesses.
        This policy explains what data we process when you use our platform or talk to a chat
        assistant powered by it.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — name, email, and business details you provide when
          creating an account.
        </li>
        <li>
          <strong>Conversation data</strong> — messages exchanged with an AI assistant,
          including contact details you choose to share (name, phone, email) so the business
          can follow up with you.
        </li>
        <li>
          <strong>Usage data</strong> — basic technical information (IP address, browser type)
          used for security and rate limiting.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To answer your questions and route your requests to the business you contacted.</li>
        <li>To create leads, appointments, and quotes at your request.</li>
        <li>To improve reliability and prevent abuse.</li>
      </ul>
      <p>
        Conversations are processed by third-party language-model providers acting as data
        processors. We do not sell personal data.
      </p>

      <h2>Data retention & your rights</h2>
      <p>
        Businesses using the platform control their customer data. Under the GDPR you may
        request access to, correction of, or deletion of your personal data at any time —
        contact the business you interacted with, or email us at{" "}
        <a href="mailto:hello@aireceptionist.app" className="text-accent">
          hello@aireceptionist.app
        </a>
        .
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, stored in the European Union, and protected by
        role-based access controls and audit logging.
      </p>
    </article>
  );
}
