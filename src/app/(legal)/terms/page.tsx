export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="!text-ink-soft !text-[12.5px]">Last updated: July 2026</p>

      <h2>The service</h2>
      <p>
        AI Receptionist provides AI-powered chat assistants, lead management, appointment
        booking, quoting, and website tools for businesses on a subscription basis. AI-generated
        responses are produced automatically and may occasionally be inaccurate — businesses
        remain responsible for the information they publish and the commitments they make to
        their customers.
      </p>

      <h2>Accounts & trials</h2>
      <ul>
        <li>You must provide accurate information when creating an account.</li>
        <li>Trials are free for 14 days; no charges apply until a paid plan is chosen.</li>
        <li>You are responsible for keeping your credentials secure.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>No unlawful, deceptive, or harmful content or activity.</li>
        <li>No attempts to breach, overload, or reverse-engineer the service.</li>
        <li>No sending of spam through the platform's messaging features.</li>
      </ul>

      <h2>Data</h2>
      <p>
        Your business data remains yours. We process it only to provide the service, as
        described in our Privacy Policy. You can export or delete your data by contacting us.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided &ldquo;as is.&rdquo; To the maximum extent permitted by law, our
        liability is limited to the fees paid in the twelve months preceding a claim.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:hello@aireceptionist.app" className="text-accent">
          hello@aireceptionist.app
        </a>
      </p>
    </article>
  );
}
