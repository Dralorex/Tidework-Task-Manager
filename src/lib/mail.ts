import { Resend } from "resend";

export function getAppBaseUrl() {
  const explicit = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Rowgon <onboarding@resend.dev>"
  );
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/** Turn Resend/API failures into actionable copy for the UI. */
export function explainMailError(raw: string): string {
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes("only send testing emails") ||
    lower.includes("verify a domain") ||
    lower.includes("you can only send")
  ) {
    return (
      "Resend’s free test sender (onboarding@resend.dev) can only deliver to the " +
      "email on your Resend account. Either send to that address, or verify a " +
      "domain at resend.com/domains and set EMAIL_FROM on Vercel to an address " +
      "on that domain."
    );
  }

  if (
    lower.includes("invalid api key") ||
    lower.includes("api key is invalid") ||
    lower.includes("unauthorized") ||
    lower.includes("missing api key")
  ) {
    return (
      "Resend rejected the API key. Check RESEND_API_KEY in Vercel " +
      "(Production) and redeploy."
    );
  }

  if (lower.includes("domain is not verified") || lower.includes("not verified")) {
    return (
      "EMAIL_FROM uses a domain that isn’t verified in Resend. " +
      "Verify it at resend.com/domains or use Rowgon <onboarding@resend.dev> " +
      "and only mail your Resend account email."
    );
  }

  if (msg) return msg;
  return "Couldn’t send the email. Check Resend / Vercel env vars and try again.";
}

/**
 * Sends email via Resend when RESEND_API_KEY is set.
 * Without a key, logs the message (local/dev) and returns mocked: true.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: true; mocked: boolean } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[rowgon:mail:dev]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { ok: true, mocked: true };
  }

  try {
    const resend = new Resend(apiKey);
    const from = getEmailFrom();
    const appUrl = getAppBaseUrl();
    const replyTo =
      input.replyTo?.trim() ||
      process.env.EMAIL_REPLY_TO?.trim() ||
      undefined;
    // Align From domain, Reply-To, and List-Unsubscribe to improve inbox placement.
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(replyTo ? { replyTo } : {}),
      headers: {
        "List-Unsubscribe": `<${appUrl}/app/profile>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
    if (result.error) {
      console.error("[rowgon:mail]", result.error);
      return { ok: false, error: explainMailError(result.error.message) };
    }
    return { ok: true, mocked: false };
  } catch (err) {
    console.error("[rowgon:mail]", err);
    const raw = err instanceof Error ? err.message : "Failed to send email.";
    return { ok: false, error: explainMailError(raw) };
  }
}
