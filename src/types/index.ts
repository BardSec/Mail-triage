export type Urgency = "Critical" | "High" | "Medium" | "Low";

export type Category =
  | "Security Alert"
  | "Action Required"
  | "Vendor / Sales"
  | "HR / Admin"
  | "Parent / Staff"
  | "Newsletter / FYI"
  | "Finance / Budget"
  | "Tech Support"
  | "General";

export interface Email {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
  importance: string;
}

export interface TriageResult {
  urgency: Urgency;
  urgencyReason: string;
  category: Category;
  actionItems: string[];
  summary: string;
}

/** A stored M365 account (credentials + live token). */
export interface Account {
  id: string;          // random UUID generated at account-add time
  clientId: string;
  tenantId: string;
  displayName: string; // from Graph /me
  email: string;       // from Graph /me
  token: string;
  tokenExpiry: number; // unix ms timestamp
}

export type SortBy = "received" | "urgency";
export type FilterBy = "All" | "Unread" | Urgency;

/** Stored in sessionStorage during an in-progress OAuth redirect for a new account. */
export interface PendingAccount {
  id: string;
  clientId: string;
  tenantId: string;
}
