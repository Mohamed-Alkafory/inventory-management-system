export type PasswordRule = { id: string; label: string; test: (value: string) => boolean };

/** Single source of truth for the password policy (validation + the live checklist). */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { id: "number", label: "One number (0–9)", test: (v) => /\d/.test(v) },
  { id: "special", label: "One special character (! @ # $ …)", test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export const passwordScore = (value: string) => PASSWORD_RULES.filter((r) => r.test(value)).length;
export const isStrongPassword = (value: string) => PASSWORD_RULES.every((r) => r.test(value));

export function strengthLabel(score: number): { label: string; tone: string } {
  if (score <= 2) return { label: "Weak", tone: "bg-danger-600" };
  if (score === 3) return { label: "Fair", tone: "bg-warning-600" };
  if (score === 4) return { label: "Good", tone: "bg-info-600" };
  return { label: "Strong", tone: "bg-success-600" };
}
