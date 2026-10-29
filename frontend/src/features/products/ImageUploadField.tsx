import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button, Field } from "../../components/ui";
import { cn } from "../../lib/cn";
import { resolveImageUrl } from "../../lib/imageUrl";
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "./imageFile";
import type { ImageValidationRules } from "./imageFile";

export type ImageUploadFieldProps = {
  /** Image currently stored (external URL, blob: preview or `/uploads/...` path). */
  currentUrl?: string | null;
  /** Newly picked file, before it is uploaded. */
  file: File | null;
  /** True when the saved image is marked for deletion on save. */
  removed?: boolean;
  onFileSelect: (file: File | null) => void;
  /** The user asked to drop the image (new selection or the saved one). */
  onRemove: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Overrides the default product limits/copy (2 MB, JPEG/PNG/WebP). */
  rules?: ImageValidationRules;
  label?: string;
  hint?: string;
  previewAlt?: string;
  /** Extra copy under the buttons. `null` hides the default helper text. */
  helperText?: string | null;
  /** Size/shape classes for the preview box, e.g. `size-24 rounded-full`. */
  previewClassName?: string;
  chooseLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
  loadingLabel?: string;
};

/**
 * File picker with a preview, client-side type/size validation and a remove
 * action. The actual upload is controlled by the caller.
 */
export default function ImageUploadField({
  currentUrl,
  file,
  removed = false,
  onFileSelect,
  onRemove,
  disabled = false,
  loading = false,
  rules,
  label = "Product image",
  hint = "JPEG, PNG or WebP — up to 2 MB.",
  previewAlt = "Product image preview",
  helperText = "A wide, well-lit photo looks best. It is cropped to fit the card.",
  previewClassName = "h-24 w-32 rounded-lg",
  chooseLabel = "Choose image",
  changeLabel = "Change image",
  removeLabel = "Remove image",
  loadingLabel = "Uploading…",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are only created for a newly picked file; revoked when it changes/unmounts.
  const preview = useMemo(() => {
    if (!file || typeof URL.createObjectURL !== "function") return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL?.(preview);
  }, [preview]);

  const savedSrc = removed ? null : resolveImageUrl(currentUrl);
  const src = preview ?? savedSrc;
  const canRemove = Boolean(file || src);
  const disabledReason = disabled || loading;
  const acceptedTypes = rules?.allowedTypes ?? ACCEPTED_IMAGE_TYPES;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const next = input.files?.[0] ?? null;
    // Allow picking the same file again later.
    input.value = "";
    if (!next) return;

    const problem = validateImageFile(next, rules);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onFileSelect(next);
  };

  const handleRemove = () => {
    setError(null);
    onRemove();
  };

  return (
    <Field label={label} error={error ?? undefined} hint={hint}>
      {(aria) => (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-alt/50 p-3">
          <input
            ref={inputRef}
            id={aria.id}
            type="file"
            accept={acceptedTypes.join(",")}
            className="sr-only"
            aria-invalid={aria.invalid || undefined}
            aria-describedby={aria["aria-describedby"]}
            disabled={disabledReason}
            onChange={handleChange}
          />

          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden border bg-white",
              previewClassName,
              error ? "border-danger-600" : "border-line",
            )}
          >
            {src ? (
              <img src={src} alt={previewAlt} className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400" aria-label="No image">
                <ImagePlus className="size-6" aria-hidden="true" />
                <span className="text-[11px] font-medium">No image</span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={loading}
                disabled={disabledReason}
                leftIcon={<ImagePlus className="size-4" aria-hidden="true" />}
                onClick={() => inputRef.current?.click()}
              >
                {loading ? loadingLabel : src ? changeLabel : chooseLabel}
              </Button>
              {canRemove && !loading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabledReason}
                  leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
                  onClick={handleRemove}
                >
                  {removeLabel}
                </Button>
              )}
            </div>
            {helperText && <p className="text-xs text-muted">{helperText}</p>}
          </div>
        </div>
      )}
    </Field>
  );
}
