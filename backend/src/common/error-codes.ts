/**
 * Machine-readable error codes from the API contract (`docs/api-contract.md` §2).
 * Deriving them from the HTTP status keeps the exception filters consistent
 * with each other without every endpoint hardcoding its own code.
 */
export function errorCodeForStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'BUSINESS_RULE_ERROR';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Converts the validation-pipe messages array into the contract §2
 * `fieldErrors` shape: `{ jsonKey: [messages] }`.
 *
 * ValidationPipe / class-validator messages embed the offending property as a
 * leading word (`name must be a string`, `price should not exist`) and
 * appended whitelist violations read `property <name> should not exist`.
 * Messages whose property cannot be determined (e.g. "each value in items …")
 * are collected under the `_` key so nothing is silently dropped.
 */
export function fieldErrorsFromMessages(
  messages: string[],
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const message of messages) {
    if (typeof message !== 'string') {
      (fieldErrors._ ??= []).push(message);
      continue;
    }

    const property =
      /^property\s+(\S+)/.exec(message)?.[1] ??
      /^([a-zA-Z][a-zA-Z0-9_]*)\s+(?:must|should)\b/.exec(message)?.[1];

    const key = property ?? '_';

    (fieldErrors[key] ??= []).push(message);
  }

  return fieldErrors;
}
