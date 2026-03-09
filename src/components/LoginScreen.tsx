import { useState } from "react";
import { buildAuthUrl } from "../auth/msal";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "#0a0b0d",
  border: "1px solid #222",
  borderRadius: 3,
  padding: "10px 12px",
  color: "#e8eaf0",
  fontSize: 12,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: "#666",
  letterSpacing: 2,
  display: "block",
  marginBottom: 6,
};

export function LoginScreen() {
  const [clientId, setClientId] = useState(
    import.meta.env.VITE_CLIENT_ID ?? ""
  );
  const [tenantId, setTenantId] = useState(
    import.meta.env.VITE_TENANT_ID ?? ""
  );

  function handleLogin() {
    const redirectUri = window.location.href.split("?")[0].split("#")[0];
    window.location.href = buildAuthUrl(clientId, tenantId, redirectUri);
  }

  const ready = clientId.trim() !== "" && tenantId.trim() !== "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b0d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <div
        style={{
          width: 420,
          padding: "48px 40px",
          background: "#111315",
          border: "1px solid #1e2124",
          borderRadius: 4,
          boxShadow: "0 0 60px rgba(0,120,255,0.05)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 4,
              color: "#444",
              marginBottom: 8,
            }}
          >
            INBOX TRIAGE SYSTEM
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#e8eaf0",
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            M365 Connect
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
            Authorize via Microsoft Entra ID
          </div>
        </div>

        {/* Client ID input */}
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL_STYLE}>ENTRA APP CLIENT ID</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={INPUT_STYLE}
          />
        </div>

        {/* Tenant ID input */}
        <div style={{ marginBottom: 28 }}>
          <label style={LABEL_STYLE}>TENANT ID</label>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={INPUT_STYLE}
          />
        </div>

        {/* Sign-in button */}
        <button
          onClick={handleLogin}
          disabled={!ready}
          style={{
            width: "100%",
            padding: "12px",
            background: ready ? "#0078d4" : "#1a1d20",
            color: ready ? "#fff" : "#444",
            border: "none",
            borderRadius: 3,
            fontSize: 12,
            fontFamily: "inherit",
            letterSpacing: 2,
            cursor: ready ? "pointer" : "not-allowed",
            fontWeight: 700,
            transition: "background 0.2s",
          }}
        >
          SIGN IN WITH MICROSOFT →
        </button>

        {/* Setup checklist */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#0d0f11",
            borderRadius: 3,
            border: "1px solid #1a1d20",
          }}
        >
          <div
            style={{ fontSize: 10, color: "#555", letterSpacing: 1, marginBottom: 8 }}
          >
            SETUP REQUIRED
          </div>
          <div style={{ fontSize: 11, color: "#444", lineHeight: 1.8 }}>
            1. Register app in Entra ID portal
            <br />
            2. Add{" "}
            <span style={{ color: "#0078d4" }}>Mail.Read</span> API permission
            <br />
            3. Set redirect URI to this page URL
            <br />
            4. Enable implicit grant (access tokens)
          </div>
        </div>
      </div>
    </div>
  );
}
