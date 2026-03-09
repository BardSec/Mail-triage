import { useEffect, useRef, useState } from "react";
import { buildAuthUrl, currentRedirectUri } from "../auth/msal";
import { savePendingAccount } from "../utils/accounts";
import type { Account } from "../types";

interface AccountSwitcherProps {
  accounts: Account[];
  activeAccountId: string | null;
  onSwitch: (accountId: string) => void;
}

export function AccountSwitcher({
  accounts,
  activeAccountId,
  onSwitch,
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const active = accounts.find((a) => a.id === activeAccountId);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleAddAccount() {
    if (!clientId.trim() || !tenantId.trim()) return;

    const pendingId = crypto.randomUUID();
    savePendingAccount({ id: pendingId, clientId, tenantId });

    const redirectUri = currentRedirectUri();
    window.location.href = buildAuthUrl(clientId, tenantId, redirectUri, pendingId);
  }

  if (!active) return null;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen((x) => !x);
          setShowAddForm(false);
        }}
        style={{
          background: "transparent",
          border: "1px solid #1e2124",
          borderRadius: 3,
          padding: "6px 12px",
          color: "#888",
          fontSize: 11,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.borderColor = "#0078d4")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.borderColor = "#1e2124")
        }
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#0078d4",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active.email || active.displayName}
        </span>
        <span style={{ color: "#444", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 280,
            background: "#111315",
            border: "1px solid #1e2124",
            borderRadius: 4,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Account list */}
          <div style={{ padding: "8px 0" }}>
            <div
              style={{
                fontSize: 9,
                color: "#444",
                letterSpacing: 2,
                padding: "4px 16px 8px",
              }}
            >
              ACCOUNTS
            </div>
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    onSwitch(acc.id);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    background: isActive ? "#0078d415" : "transparent",
                    border: "none",
                    borderLeft: isActive ? "2px solid #0078d4" : "2px solid transparent",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: isActive ? "#e8eaf0" : "#888" }}>
                      {acc.displayName}
                    </div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                      {acc.email}
                    </div>
                  </div>
                  {isActive && (
                    <span style={{ marginLeft: "auto", color: "#0078d4", fontSize: 10 }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add account section */}
          <div style={{ borderTop: "1px solid #1a1d20", padding: "8px 0" }}>
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "10px 16px",
                  color: "#0078d4",
                  fontSize: 11,
                  fontFamily: "inherit",
                  letterSpacing: 1.5,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + ADD ACCOUNT
              </button>
            ) : (
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 10 }}>
                  ADD M365 ACCOUNT
                </div>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Client ID"
                  style={inputStyle}
                />
                <input
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Tenant ID"
                  style={{ ...inputStyle, marginTop: 8 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setShowAddForm(false)}
                    style={cancelBtnStyle}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleAddAccount}
                    disabled={!clientId.trim() || !tenantId.trim()}
                    style={{
                      ...addBtnStyle,
                      background:
                        clientId.trim() && tenantId.trim()
                          ? "#0078d4"
                          : "#1a1d20",
                      color:
                        clientId.trim() && tenantId.trim() ? "#fff" : "#444",
                    }}
                  >
                    SIGN IN →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0b0d",
  border: "1px solid #222",
  borderRadius: 3,
  padding: "8px 10px",
  color: "#e8eaf0",
  fontSize: 11,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 0",
  background: "transparent",
  border: "1px solid #222",
  borderRadius: 3,
  color: "#555",
  fontSize: 10,
  fontFamily: "inherit",
  letterSpacing: 1.5,
  cursor: "pointer",
};

const addBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 0",
  border: "none",
  borderRadius: 3,
  fontSize: 10,
  fontFamily: "inherit",
  letterSpacing: 1.5,
  cursor: "pointer",
  transition: "background 0.15s",
};
