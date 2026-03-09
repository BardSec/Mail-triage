import { useState } from "react";
import { CATEGORIES, URGENCY_COLORS } from "../constants";
import { markAsRead } from "../api/graph";
import type { Email, TriageResult } from "../types";

interface EmailCardProps {
  email: Email;
  triage: TriageResult | undefined;
  index: number;
  token: string;
  onMarkAsRead: (emailId: string) => void;
  onDraftReply: (email: Email, triage: TriageResult) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailCard({
  email,
  triage,
  index,
  token,
  onMarkAsRead,
  onDraftReply,
}: EmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const urgencyColor = triage ? URGENCY_COLORS[triage.urgency] : "#555";
  const cat = triage?.category ? CATEGORIES[triage.category] : CATEGORIES["General"];
  const isPending = !triage;

  async function handleMarkAsRead(e: React.MouseEvent) {
    e.stopPropagation();
    if (email.isRead || markingRead) return;
    setMarkingRead(true);
    try {
      await markAsRead(email.id, token);
      onMarkAsRead(email.id);
    } finally {
      setMarkingRead(false);
    }
  }

  function handleDraftReply(e: React.MouseEvent) {
    e.stopPropagation();
    if (triage) onDraftReply(email, triage);
  }

  return (
    <div
      onClick={() => setExpanded((x) => !x)}
      style={{
        background: "#111315",
        border: "1px solid #1a1d20",
        borderLeft: `3px solid ${urgencyColor}`,
        borderRadius: 4,
        padding: "18px 20px",
        cursor: "pointer",
        marginBottom: 10,
        opacity: email.isRead ? 0.75 : 1,
        animation: "fadeUp 0.3s ease both",
        animationDelay: `${index * 60}ms`,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = urgencyColor)
      }
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1d20";
        (e.currentTarget as HTMLDivElement).style.borderLeftColor = urgencyColor;
      }}
    >
      {/* Card header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Urgency badge */}
        <div
          style={{
            minWidth: 72,
            textAlign: "center",
            padding: "3px 0",
            background: urgencyColor + "18",
            borderRadius: 2,
            border: `1px solid ${urgencyColor}40`,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: isPending ? "#444" : urgencyColor,
              letterSpacing: 1.5,
              fontWeight: 700,
              animation: isPending ? "pulse 1.4s ease-in-out infinite" : "none",
            }}
          >
            {triage?.urgency ?? "…"}
          </div>
        </div>

        {/* Email metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 10, color: cat.color }}>
              {cat.icon} {triage?.category ?? "Analyzing..."}
            </span>
            {!email.isRead && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#0078d4",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#e8eaf0",
              fontWeight: email.isRead ? 400 : 600,
              marginBottom: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {email.subject || "(no subject)"}
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>
            {email.from?.emailAddress?.name || email.from?.emailAddress?.address}
            {" · "}
            {formatDate(email.receivedDateTime)}
          </div>
        </div>

        {/* Expand chevron */}
        <div
          style={{
            fontSize: 14,
            color: "#333",
            transition: "transform 0.2s",
            transform: expanded ? "rotate(90deg)" : "none",
            flexShrink: 0,
          }}
        >
          ▶
        </div>
      </div>

      {/* Expanded content */}
      {expanded && triage && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid #1a1d20",
          }}
        >
          {/* Summary */}
          <p style={{ fontSize: 12, color: "#aaa", lineHeight: 1.7, marginBottom: 14 }}>
            {triage.summary}
          </p>

          {/* Urgency reason */}
          {triage.urgencyReason && (
            <div
              style={{
                fontSize: 11,
                color: "#666",
                marginBottom: 12,
                fontStyle: "italic",
              }}
            >
              ⚠ {triage.urgencyReason}
            </div>
          )}

          {/* Action items */}
          {triage.actionItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "#444",
                  marginBottom: 8,
                }}
              >
                ACTION ITEMS
              </div>
              {triage.actionItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 6,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ color: "#0078d4", fontSize: 10, marginTop: 2 }}>◆</span>
                  <span style={{ fontSize: 12, color: "#ccc" }}>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: 8,
              paddingTop: 12,
              borderTop: "1px solid #131518",
            }}
          >
            {!email.isRead && (
              <button
                onClick={handleMarkAsRead}
                disabled={markingRead}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  border: "1px solid #222",
                  borderRadius: 3,
                  color: markingRead ? "#333" : "#666",
                  fontSize: 10,
                  fontFamily: "inherit",
                  letterSpacing: 1.5,
                  cursor: markingRead ? "default" : "pointer",
                }}
              >
                {markingRead ? "MARKING..." : "MARK AS READ"}
              </button>
            )}
            <button
              onClick={handleDraftReply}
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: "1px solid #0078d440",
                borderRadius: 3,
                color: "#0078d4",
                fontSize: 10,
                fontFamily: "inherit",
                letterSpacing: 1.5,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.borderColor = "#0078d4")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.borderColor = "#0078d440")
              }
            >
              DRAFT REPLY
            </button>
          </div>
        </div>
      )}

      {/* Expanded but still loading */}
      {expanded && !triage && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid #1a1d20",
            fontSize: 11,
            color: "#333",
            letterSpacing: 2,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        >
          ANALYZING WITH CLAUDE...
        </div>
      )}
    </div>
  );
}
