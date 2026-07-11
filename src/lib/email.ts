import { logger } from "./logger";

/**
 * Thin Resend client (plain fetch — no SDK needed).
 * If RESEND_API_KEY is missing, sends become logged no-ops so the app
 * keeps working in environments without email configured.
 *
 * NOTE: with Resend's sandbox sender (onboarding@resend.dev) delivery is
 * restricted to the Resend account owner's address until a domain is verified.
 */

export interface EmailAttachment {
  filename: string;
  /** base64-encoded content */
  content: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "AI Receptionist <onboarding@resend.dev>";

  if (!apiKey) {
    logger.info({ to: input.to, subject: input.subject }, "email skipped (no RESEND_API_KEY)");
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: text.slice(0, 300), to: input.to }, "email send failed");
      return { ok: false, error: `resend_${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    logger.info({ to: input.to, id: data.id }, "email sent");
    return { ok: true, id: data.id };
  } catch (err) {
    logger.error({ err, to: input.to }, "email send threw");
    return { ok: false, error: "network_error" };
  }
}

/** Shared minimal branded wrapper for transactional emails. */
export function emailLayout(title: string, bodyHtml: string, accent = "#5B57D4"): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F7F7F8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #EAEAEC;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${accent};padding:18px 28px;">
          <span style="color:#ffffff;font-size:16px;font-weight:bold;">${title}</span>
        </td></tr>
        <tr><td style="padding:28px;color:#17171A;font-size:14px;line-height:1.7;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #EAEAEC;color:#9A9AA5;font-size:11px;">
          Sent by AI Receptionist
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
