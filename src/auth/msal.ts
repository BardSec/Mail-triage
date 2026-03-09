/**
 * Microsoft Authentication Library (MSAL) helpers.
 *
 * Uses the implicit grant flow to obtain an access token for Microsoft Graph.
 * The token is returned in the URL fragment (#access_token=...) after the
 * user authenticates.
 *
 * The `state` parameter round-trips through the OAuth redirect so we can
 * identify which pending account the returned token belongs to (multi-account).
 */

export interface TokenResult {
  token: string;
  expiresIn: number; // seconds until expiry
  state: string | null; // echoed back from the OAuth `state` param
}

/**
 * Builds the Microsoft OAuth2 authorization URL for an implicit-grant token request.
 * Pass `state` to correlate the response with a pending account addition.
 */
export function buildAuthUrl(
  clientId: string,
  tenantId: string,
  redirectUri: string,
  state?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "token",
    redirect_uri: redirectUri,
    scope: "https://graph.microsoft.com/Mail.Read",
    response_mode: "fragment",
    ...(state ? { state } : {}),
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

/**
 * Parses the access token (and metadata) from the URL hash after OAuth redirect.
 * Returns null if no token is present.
 */
export function parseTokenFromHash(): TokenResult | null {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return null;

  const params = new URLSearchParams(hash.replace("#", ""));
  const token = params.get("access_token");
  if (!token) return null;

  return {
    token,
    expiresIn: parseInt(params.get("expires_in") ?? "3600", 10),
    state: params.get("state"),
  };
}

/**
 * Returns the redirect URI for the current page (strips hash + query string).
 */
export function currentRedirectUri(): string {
  return `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
}
