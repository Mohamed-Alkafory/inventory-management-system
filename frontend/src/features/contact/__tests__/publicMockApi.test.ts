import { afterEach, describe, expect, it } from "vitest";
import { resetMockContactRateLimit, mockPublicContactApi } from "../publicMockApi";

const submission = {
  name: "Jane Doe",
  email: "jane@example.com",
  subject: "Delivery question",
  message: "How long does delivery take?",
  honeypot: "",
};

afterEach(() => resetMockContactRateLimit());

describe("mockPublicContactApi", () => {
  it("accepts five submissions per hour and answers 429 for the sixth", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(mockPublicContactApi.submit(submission)).resolves.toEqual({ received: true });
    }
    await expect(mockPublicContactApi.submit(submission)).rejects.toMatchObject({ status: 429 });
  });

  it("still answers received for a filled honeypot but counts it against the limit", async () => {
    const spam = { ...submission, honeypot: "bot" };
    for (let i = 0; i < 5; i += 1) {
      await expect(mockPublicContactApi.submit(spam)).resolves.toEqual({ received: true });
    }
    await expect(mockPublicContactApi.submit(submission)).rejects.toMatchObject({ status: 429 });
  });

  it("forgets the window after a reset", async () => {
    for (let i = 0; i < 5; i += 1) await mockPublicContactApi.submit(submission);
    resetMockContactRateLimit();
    await expect(mockPublicContactApi.submit(submission)).resolves.toEqual({ received: true });
  });
});
