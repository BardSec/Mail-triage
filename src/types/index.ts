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

export type SortBy = "received" | "urgency";
export type FilterBy = "All" | "Unread" | Urgency;
