import type { ImageValidationRules } from "../products/imageFile";
import { ACCEPTED_IMAGE_TYPES } from "../products/imageFile";

/** Keep in sync with the backend avatar limit (1 MB). */
export const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

export const AVATAR_TYPE_ERROR = "Choose a JPEG, PNG or WebP image.";
export const AVATAR_SIZE_ERROR = "Image must be 1 MB or smaller.";
export const AVATAR_EMPTY_ERROR = "That file is empty. Choose another image.";

/** Validation shared by the profile upload field and any avatar picker. */
export const AVATAR_RULES: ImageValidationRules = {
  maxBytes: MAX_AVATAR_BYTES,
  allowedTypes: ACCEPTED_IMAGE_TYPES,
  typeError: AVATAR_TYPE_ERROR,
  sizeError: AVATAR_SIZE_ERROR,
  emptyError: AVATAR_EMPTY_ERROR,
};
