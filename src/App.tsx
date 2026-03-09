import { useEffect, useState } from "react";
import { parseTokenFromHash } from "./auth/msal";
import { fetchEmails } from "./api/graph";
import { triageEmail } from "./api/claude";
import { LoginScreen } from "./components/LoginScreen";
import { InboxDashboard } from "./components/InboxDashboard";
import type { Email, FilterBy, SortBy, TriageResult } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [triageMap, setTriageMap] = useState<Record<string, TriageResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterBy>("All");
  const [sortBy, setSortBy] = useState<SortBy>("received");

  // Step 1 — parse OAuth token from URL hash on redirect
  useEffect(() => {
    const t = parseTokenFromHash();
    if (t) {
      setToken(t);
      // Clean the hash so the token isn't visible in the URL bar
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Step 2 — fetch emails then progressively triage each one
  useEffect(() => {
    if (!token) return;

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

    setLoading(true);
    setError(null);

    fetchEmails(token)
      .then(async (msgs) => {
        setEmails(msgs);
        setLoading(false);

        if (!apiKey) {
          console.warn(
            "VITE_ANTHROPIC_API_KEY is not set. Skipping AI triage."
          );
          return;
        }

        // Triage sequentially so we don't hammer the API with 20 concurrent requests
        for (const email of msgs) {
          const result = await triageEmail(email, apiKey).catch(() => null);
          if (result) {
            setTriageMap((prev) => ({ ...prev, [email.id]: result }));
          }
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <InboxDashboard
      emails={emails}
      triageMap={triageMap}
      loading={loading}
      error={error}
      filter={filter}
      sortBy={sortBy}
      onFilterChange={setFilter}
      onSortChange={setSortBy}
    />
  );
}
