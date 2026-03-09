/**
 * Microsoft Authentication Library (MSAL) helpers.
 *
 * Uses the implicit grant flow to obtain an access token for Microsoft Graph.
 * The token is returned in the URL fragment (#access_token=...) after the
 * user authenticates in the Microsoft login popup/redirect.
 *
 * NOTE: The implicit flow is suitable for SPAs in dev. For production, prefer
 * the authorization code flow with PKCE (no client secret required for SPAs).
 */

/**
 * Builds the Microsoft OAuth2 authorization URL for an implicit-grant token request.
 */
export function buildAuthUrl(
  clientId: string,
  tenantId: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "token",
    redirect_uri: redirectUri,
    scope: "https://graph.microsoft.com/Mail.Read",
    response_mode: "fragment",
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

/**
 * Parses the access token from the URL hash after a successful OAuth redirect.
 * Returns null if no token is present in the hash.
 */
export function parseTokenFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return null;
  const params = new URLSearchParams(hash.replace("#", ""));
  return params.get("access_token");
}
