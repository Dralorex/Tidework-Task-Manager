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
    "Tidework <onboarding@resend.dev>"
  );
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Sends email via Resend when RESEND_API_KEY is set.
 * Without a key, logs the message (local/dev) and returns mocked: true.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: true; mocked: boolean } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[tidework:mail:dev]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { ok: true, mocked: true };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (result.error) {
      console.error("[tidework:mail]", result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, mocked: false };
  } catch (err) {
    console.error("[tidework:mail]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send email.",
    };
  }
}
