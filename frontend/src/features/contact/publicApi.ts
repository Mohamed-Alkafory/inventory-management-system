import { USE_MOCK } from "../../lib/env";
import { publicRequest } from "../../lib/http";
import { mockPublicContactApi } from "./publicMockApi";

/** Exact body accepted by the public `POST /contact` endpoint. */
export interface ContactSubmissionInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Anti-bot trap: the form always sends it, and it must stay empty. */
  honeypot: string;
}

export interface ContactSubmissionResponse {
  received: true;
}

export interface PublicContactApi {
  submit(input: ContactSubmissionInput): Promise<ContactSubmissionResponse>;
}

export const realPublicContactApi: PublicContactApi = {
  async submit(input) {
    // `publicRequest` keeps this anonymous: no bearer token, no refresh, no
    // session-expired redirect when a signed-in visitor submits.
    return publicRequest<ContactSubmissionResponse>("/contact", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export const publicContactApi: PublicContactApi = USE_MOCK ? mockPublicContactApi : realPublicContactApi;
