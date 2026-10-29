/** Shared limits for product pictures; keep in sync with the backend (2 MB). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const IMAGE_TYPE_ERROR = "Choose a JPEG, PNG or WebP image.";
export const IMAGE_SIZE_ERROR = "Image must be 2 MB or smaller.";
export const IMAGE_EMPTY_ERROR = "That file is empty. Choose another image.";

export type ImageValidationRules = {
  /** Maximum file size in bytes. Defaults to the product limit (2 MB). */
  maxBytes?: number;
  /** Allowed MIME types. Defaults to JPEG/PNG/WebP. */
  allowedTypes?: readonly string[];
  /** Overrides for callers with different copy (e.g. avatars). */
  typeError?: string;
  sizeError?: string;
  emptyError?: string;
};

/** Client-side guard so an invalid file never reaches the upload request. */
export function validateImageFile(file: File, rules: ImageValidationRules = {}): string | null {
  const allowedTypes = rules.allowedTypes ?? ACCEPTED_IMAGE_TYPES;
  const maxBytes = rules.maxBytes ?? MAX_IMAGE_BYTES;

  if (!allowedTypes.includes(file.type)) return rules.typeError ?? IMAGE_TYPE_ERROR;
  if (file.size === 0) return rules.emptyError ?? IMAGE_EMPTY_ERROR;
  if (file.size > maxBytes) return rules.sizeError ?? IMAGE_SIZE_ERROR;
  return null;
}
