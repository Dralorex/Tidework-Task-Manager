import "server-only";

export type AvatarScanVerdict = "approved" | "blocked" | "review";

export type AvatarScanResult = {
  verdict: AvatarScanVerdict;
  detail: string;
  source: "openai" | "none";
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function assertPngBuffer(bytes: Buffer) {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error("Profile pictures must be PNG files.");
  }
}

/**
 * Auto NSFW / inappropriate scan.
 * - With OPENAI_API_KEY: omni-moderation on the image (block high, review medium).
 * - Without a scanner: fail closed → pending human review (never auto-approve).
 */
export async function scanAvatarImage(
  bytes: Buffer,
): Promise<AvatarScanResult> {
  assertPngBuffer(bytes);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      verdict: "review",
      detail: "No auto scanner configured; queued for human review.",
      source: "none",
    };
  }

  const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[rowgon:avatar:moderation]", res.status, text.slice(0, 400));
    return {
      verdict: "review",
      detail: "Auto scanner unavailable; queued for human review.",
      source: "openai",
    };
  }

  const json = (await res.json()) as {
    results?: Array<{
      flagged?: boolean;
      categories?: Record<string, boolean>;
      category_scores?: Record<string, number>;
    }>;
  };
  const result = json.results?.[0];
  if (!result) {
    return {
      verdict: "review",
      detail: "Empty moderation response; queued for human review.",
      source: "openai",
    };
  }

  const scores = result.category_scores ?? {};
  const sexual = scores["sexual"] ?? 0;
  const sexualMinors = scores["sexual/minors"] ?? 0;
  const violence = scores["violence"] ?? 0;
  const graphic = scores["violence/graphic"] ?? 0;

  if (sexualMinors >= 0.2) {
    return {
      verdict: "blocked",
      detail: "Blocked by automated safety check.",
      source: "openai",
    };
  }
  if (sexual >= 0.55 || graphic >= 0.7 || violence >= 0.85) {
    return {
      verdict: "blocked",
      detail: "Blocked by automated safety check.",
      source: "openai",
    };
  }
  if (
    result.flagged ||
    sexual >= 0.25 ||
    graphic >= 0.4 ||
    violence >= 0.55
  ) {
    return {
      verdict: "review",
      detail: "Flagged for human review.",
      source: "openai",
    };
  }

  return {
    verdict: "approved",
    detail: "Passed automated safety check.",
    source: "openai",
  };
}
