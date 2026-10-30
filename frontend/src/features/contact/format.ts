export const SUPPORT_MESSAGES_PATH = "/support/messages";
export const messagePath = (id: string | number) => `${SUPPORT_MESSAGES_PATH}/${id}`;

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** "Oct 30, 2026, 3:00 PM" — local time, "—" for a missing date. */
export const formatContactDate = (iso: string) => (iso ? dateTime.format(new Date(iso)) : "—");
