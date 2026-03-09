import { FILTER_OPTIONS, SORT_OPTIONS, URGENCY_ORDER } from "../constants";
import { EmailCard } from "./EmailCard";
import type { Email, FilterBy, SortBy, TriageResult, Urgency } from "../types";

interface InboxDashboardProps {
  emails: Email[];
  triageMap: Record<string, TriageResult>;
  loading: boolean;
  error: string | null;
  filter: FilterBy;
  sortBy: SortBy;
  onFilterChange: (f: FilterBy) => void;
  onSortChange: (s: SortBy) => void;
}

const STAT_BUTTON_BASE: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 2,
  fontSize: 10,
  letterSpacing: 1.5,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
};

export function InboxDashboard({
  emails,
  triageMap,
  loading,
  error,
  filter,
  sortBy,
  onFilterChange,
  onSortChange,
}: InboxDashboardProps) {
  const triageValues = Object.values(triageMap);
  const criticalCount = triageValues.filter((t) => t.urgency === "Critical").length;
  const highCount = triageValues.filter((t) => t.urgency === "High").length;
  const actionCount = triageValues.filter((t) => t.actionItems.length > 0).length;

  const filtered = emails.filter((e) => {
    if (filter === "All") return true;
    if (filter === "Unread") return !e.isRead;
    return triageMap[e.id]?.urgency === (filter as Urgency);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "urgency") {
      const ao = URGENCY_ORDER[triageMap[a.id]?.urgency] ?? 9;
      const bo = URGENCY_ORDER[triageMap[b.id]?.urgency] ?? 9;
      return ao - bo;
    }
    return (
      new Date(b.receivedDateTime).getTime() -
      new Date(a.receivedDateTime).getTime()
    );
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b0d",
        fontFamily: "'IBM Plex Mono', monospace",
        color: "#e8eaf0",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          borderBottom: "1px solid #1a1d20",
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 8px #22c55e",
            }}
          />
          <span style={{ fontSize: 11, letterSpacing: 4, color: "#666" }}>
            INBOX TRIAGE
          </span>
          <span style={{ fontSize: 11, color: "#333" }}>// M365</span>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 24 }}>
          {(
            [
              ["CRITICAL", criticalCount, "#ff2222"],
              ["HIGH", highCount, "#ff8c00"],
              ["ACTION ITEMS", actionCount, "#0078d4"],
            ] as const
          ).map(([label, count, color]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, color, fontWeight: 700 }}>{count}</div>
              <div style={{ fontSize: 9, color: "#444", letterSpacing: 1.5 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div
        style={{
          padding: "14px 28px",
          borderBottom: "1px solid #131518",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => onFilterChange(f as FilterBy)}
              style={{
                ...STAT_BUTTON_BASE,
                border: `1px solid ${active ? "#0078d4" : "#1e2124"}`,
                background: active ? "#0078d420" : "transparent",
                color: active ? "#0078d4" : "#555",
              }}
            >
              {f.toUpperCase()}
            </button>
          );
        })}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 10, color: "#444" }}>SORT</span>
          {SORT_OPTIONS.map((s) => {
            const active = sortBy === s;
            return (
              <button
                key={s}
                onClick={() => onSortChange(s as SortBy)}
                style={{
                  ...STAT_BUTTON_BASE,
                  border: `1px solid ${active ? "#555" : "#1e2124"}`,
                  background: "transparent",
                  color: active ? "#aaa" : "#444",
                  letterSpacing: 1,
                }}
              >
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div
        style={{ maxWidth: 860, margin: "0 auto", padding: "24px 28px" }}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#333" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 3,
                marginBottom: 8,
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            >
              FETCHING MAIL...
            </div>
            <div style={{ fontSize: 10, color: "#222" }}>
              Connecting to Microsoft Graph
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#ff222218",
              border: "1px solid #ff222240",
              borderRadius: 4,
              padding: 20,
              color: "#ff6666",
              fontSize: 12,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "#333",
              fontSize: 12,
            }}
          >
            NO MESSAGES FOUND
          </div>
        )}

        {sorted.map((email, i) => (
          <EmailCard
            key={email.id}
            email={email}
            triage={triageMap[email.id]}
            index={i}
          />
        ))}

        {/* Progressive triage progress indicator */}
        {emails.length > 0 &&
          Object.keys(triageMap).length < emails.length && (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                color: "#333",
                fontSize: 10,
                letterSpacing: 2,
              }}
            >
              ANALYZING {Object.keys(triageMap).length}/{emails.length}{" "}
              MESSAGES...
            </div>
          )}
      </div>
    </div>
  );
}
