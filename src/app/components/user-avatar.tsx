export function UserAvatar({
  userId,
  label,
  shape = "circle",
  status = "none",
  size = 40,
  className = "",
}: {
  userId: string;
  label: string;
  shape?: string | null;
  status?: string | null;
  size?: number;
  className?: string;
}) {
  const rounded = shape === "rounded" ? "rounded-2xl" : "rounded-full";
  const initial = (label.trim()[0] || "?").toUpperCase();
  const showImage = status === "approved" || status === "pending";

  if (!showImage) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-[color:var(--tide-deep)]/12 font-semibold text-[color:var(--tide-deep)] ${rounded} ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(11, size * 0.4),
        }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed R2 redirect
    <img
      src={`/api/avatar/${userId}`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 object-cover ${rounded} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
