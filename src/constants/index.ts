import type { Category, Urgency } from "../types";

export const CATEGORIES: Record<Category, { color: string; icon: string }> = {
  "Security Alert":   { color: "#ff4444", icon: "🔴" },
  "Action Required":  { color: "#ff8c00", icon: "⚡" },
  "Vendor / Sales":   { color: "#888",    icon: "📦" },
  "HR / Admin":       { color: "#5b8dee", icon: "🏫" },
  "Parent / Staff":   { color: "#22c55e", icon: "💬" },
  "Newsletter / FYI": { color: "#666",    icon: "📰" },
  "Finance / Budget": { color: "#a78bfa", icon: "💰" },
  "Tech Support":     { color: "#38bdf8", icon: "🛠️" },
  "General":          { color: "#999",    icon: "📧" },
};

export const URGENCY_COLORS: Record<Urgency, string> = {
  Critical: "#ff2222",
  High:     "#ff8c00",
  Medium:   "#eab308",
  Low:      "#22c55e",
};

export const URGENCY_ORDER: Record<Urgency, number> = {
  Critical: 0,
  High:     1,
  Medium:   2,
  Low:      3,
};

export const FILTER_OPTIONS = ["All", "Unread", "Critical", "High", "Medium", "Low"] as const;
export const SORT_OPTIONS = ["received", "urgency"] as const;
