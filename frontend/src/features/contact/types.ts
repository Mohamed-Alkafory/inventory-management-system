export type Id = string | number;

export type ContactStatus = "NEW" | "IN_PROGRESS" | "RESOLVED";

export const CONTACT_STATUSES: ContactStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED"];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

/** Assignee snapshot returned inside the private inbox. */
export interface ContactAssignee {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

/** Private support-inbox shape (GET /contact-messages*). */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  assignedToId: string | null;
  assignedTo: ContactAssignee | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListParams {
  status: "" | ContactStatus;
  /** "" = every assignee. */
  assignedToId: string;
  search: string;
  page: number; // 1-based
  pageSize: number;
}

export interface ContactPage {
  items: ContactMessage[];
  total: number;
}

export interface ContactUpdateInput {
  status?: ContactStatus;
  assignedToId?: string | null;
  internalNote?: string | null;
}

export interface ContactMessagesApi {
  list(params: ContactListParams): Promise<ContactPage>;
  get(id: Id): Promise<ContactMessage>;
  update(id: Id, patch: ContactUpdateInput): Promise<ContactMessage>;
}
