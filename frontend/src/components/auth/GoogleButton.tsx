import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, USE_MOCK } from "../../lib/env";

type Props = {
  /** Called with the Google ID token (credential). */
  onCredential: (idToken: string) => void;
  /** Wording of the official Google button. */
  variant?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
};

const LABELS = {
  signin_with: "Sign in with Google",
  signup_with: "Sign up with Google",
  continue_with: "Continue with Google",
};

const GSI_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

/** Loads Google Identity Services once. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const baseButton =
  "flex w-full items-center justify-center gap-3 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

/**
 * "Continue with Google".
 *  - VITE_USE_MOCK=true      → simulated Google account (no network)
 *  - VITE_GOOGLE_CLIENT_ID   → the official Google button (Google Identity Services)
 *  - neither                 → disabled, with a hint for the developer
 */
export default function GoogleButton({ onCredential, variant = "continue_with", disabled }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (USE_MOCK || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const el = holder.current;
        if (cancelled || !el || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID as string,
          callback: ({ credential }) => callback.current(credential),
        });
        window.google.accounts.id.renderButton(el, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: variant,
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(400, Math.max(200, el.offsetWidth || 340)),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [variant]);

  if (USE_MOCK) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onCredential("mock-google-credential")}
        className={`${baseButton} hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <GoogleLogo />
        {LABELS[variant]}
      </button>
    );
  }

  if (!GOOGLE_CLIENT_ID || loadError) {
    return (
      <div>
        <button type="button" disabled className={`${baseButton} cursor-not-allowed opacity-60`}>
          <GoogleLogo />
          {LABELS[variant]}
        </button>
        <p className="mt-1.5 text-center text-xs text-muted">
          {loadError ? "Couldn’t load Google sign-in. Check your connection." : "Google sign-in isn’t configured yet."}
        </p>
      </div>
    );
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
      <div ref={holder} className="flex min-h-10 w-full justify-center" />
    </div>
  );
}
