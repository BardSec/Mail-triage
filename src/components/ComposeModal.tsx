import { useEffect, useRef, useState } from "react";
import type { Email, TriageResult } from "../types";
import { draftReply } from "../api/claude";

interface ComposeModalProps {
  email: Email;
  triage: TriageResult;
  onClose: () => void;
}

export function ComposeModal({ email, triage, onClose }: ComposeModalProps) {
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    draftReply(email, triage)
      .then((text) => {
        if (text === null) {
          setError(
            "Backend unavailable. Start the FastAPI server to enable reply drafting."
          );
        } else {
          setDraft(text);
        }
      })
      .catch(() =>
        setError("Failed to generate reply draft. Please try again.")
      )
      .finally(() => setLoading(false));
  }, [email, triage]);

  function handleCopy() {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* Overlay */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#111315",
          border: "1px solid #1e2124",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #1a1d20",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 4 }}>
              DRAFT REPLY
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#e8eaf0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 460,
              }}
            >
              Re: {email.subject}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              To: {email.from?.emailAddress?.name || email.from?.emailAddress?.address}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#555",
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
              fontFamily: "inherit",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "#333",
                fontSize: 11,
                letterSpacing: 2,
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            >
              GENERATING REPLY WITH CLAUDE...
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#ff222218",
                border: "1px solid #ff222240",
                borderRadius: 3,
                padding: 16,
                color: "#ff6666",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {!loading && !error && (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{
                width: "100%",
                minHeight: 220,
                background: "#0a0b0d",
                border: "1px solid #222",
                borderRadius: 3,
                padding: "14px",
                color: "#e8eaf0",
                fontSize: 13,
                fontFamily: "'IBM Plex Mono', monospace",
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #1a1d20",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <div style={{ marginRight: "auto", fontSize: 10, color: "#333", alignSelf: "center" }}>
              AI-generated — review before sending
            </div>
            <button
              onClick={handleCopy}
              style={{
                padding: "8px 18px",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: 3,
                color: copied ? "#22c55e" : "#888",
                fontSize: 11,
                fontFamily: "inherit",
                letterSpacing: 1.5,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "8px 18px",
                background: "#0078d4",
                border: "none",
                borderRadius: 3,
                color: "#fff",
                fontSize: 11,
                fontFamily: "inherit",
                letterSpacing: 1.5,
                cursor: "pointer",
              }}
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
