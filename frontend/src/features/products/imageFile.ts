/** Shared limits for product pictures; keep in sync with the backend (2 MB). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const IMAGE_TYPE_ERROR = "Choose a JPEG, PNG or WebP image.";
export const IMAGE_SIZE_ERROR = "Image must be 2 MB or smaller.";
export const IMAGE_EMPTY_ERROR = "That file is empty. Choose another image.";

/** Client-side guard so an invalid file never reaches the upload request. */
export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return IMAGE_TYPE_ERROR;
  if (file.size === 0) return IMAGE_EMPTY_ERROR;
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_SIZE_ERROR;
  return null;
}
