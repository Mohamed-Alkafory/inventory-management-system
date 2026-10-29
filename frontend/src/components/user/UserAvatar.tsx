import { useState } from "react";
import { cn } from "../../lib/cn";
import { resolveImageUrl } from "../../lib/imageUrl";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
};

/** "Jane A. Doe" → "JD" (first letters of the first two words). */
function avatarInitials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export type UserAvatarProps = {
  name?: string | null;
  /** Avatar URL from the API (`/uploads/...`, external URL) — resolved for `<img>`. */
  src?: string | null;
  size?: UserAvatarSize | number;
  className?: string;
  /** Accessible label; defaults to "<name> avatar". */
  alt?: string;
};

/**
 * Circular user picture with an initials fallback. The fallback is used when
 * there is no avatar *or* the image fails to load (e.g. deleted upload), so
 * every surface showing a user can rely on the same component.
 */
export default function UserAvatar({ name, src, size = "md", className, alt }: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = resolveImageUrl(src);
  const showImage = resolved !== null && failedSrc !== resolved;
  const label = alt ?? `${name?.trim() || "User"} avatar`;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 font-bold text-primary-700",
        typeof size === "string" && SIZE_CLASSES[size],
        className,
      )}
      style={typeof size === "number" ? { width: size, height: size } : undefined}
    >
      {showImage ? (
        <img
          src={resolved}
          alt={label}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(resolved)}
        />
      ) : (
        <span role="img" aria-label={label}>
          {avatarInitials(name)}
        </span>
      )}
    </span>
  );
}
