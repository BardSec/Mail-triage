import { useEffect, useRef, useState } from "react";
import { parseTokenFromHash } from "./auth/msal";
import { fetchEmails, fetchMe, fetchSingleEmail } from "./api/graph";
import { triageEmail } from "./api/claude";
import { getCachedTriage, setCachedTriage } from "./utils/cache";
import {
  loadAccounts,
  saveAccounts,
  loadActiveAccountId,
  saveActiveAccountId,
  loadAndClearPendingAccount,
  isTokenExpired,
} from "./utils/accounts";
import { LoginScreen } from "./components/LoginScreen";
import { InboxDashboard } from "./components/InboxDashboard";
import { ComposeModal } from "./components/ComposeModal";
import type { Account, Email, FilterBy, SortBy, TriageResult } from "./types";

interface DraftTarget {
  email: Email;
  triage: TriageResult;
}

export default function App() {
  // ── Account state ──────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [activeAccountId, setActiveAccountId] = useState<string | null>(
    () => loadActiveAccountId()
  );

  // ── Email / triage state ───────────────────────────────────────────────────
  const [emails, setEmails] = useState<Email[]>([]);
  const [triageMap, setTriageMap] = useState<Record<string, TriageResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<FilterBy>("All");
  const [sortBy, setSortBy] = useState<SortBy>("received");
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);

  // Ref so SSE handler always sees the latest token without re-subscribing
  const activeAccountRef = useRef<Account | null>(null);

  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) ?? null;
  activeAccountRef.current = activeAccount;

  // ── Step 1: Handle OAuth redirect ──────────────────────────────────────────
  useEffect(() => {
    const result = parseTokenFromHash();
    if (!result) return;

    // Clean hash from URL immediately
    window.history.replaceState(null, "", window.location.pathname);

    const { token, expiresIn, state } = result;
    const tokenExpiry = Date.now() + expiresIn * 1000;

    // Determine if this is an initial login or a new-account addition
    const pending = loadAndClearPendingAccount();
    const accountId = pending?.id ?? state ?? crypto.randomUUID();
    const clientId =
      pending?.clientId ?? import.meta.env.VITE_CLIENT_ID ?? "";
    const tenantId =
      pending?.tenantId ?? import.meta.env.VITE_TENANT_ID ?? "";

    // Fetch display name / email from Graph
    fetchMe(token).then(({ displayName, email }) => {
      const newAccount: Account = {
        id: accountId,
        clientId,
        tenantId,
        displayName,
        email,
        token,
        tokenExpiry,
      };

      setAccounts((prev) => {
        const filtered = prev.filter((a) => a.id !== accountId);
        const updated = [...filtered, newAccount];
        saveAccounts(updated);
        return updated;
      });

      setActiveAccountId(accountId);
      saveActiveAccountId(accountId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: Fetch + triage when active account changes ────────────────────
  useEffect(() => {
    if (!activeAccount) return;
    if (isTokenExpired(activeAccount)) {
      setError("Session expired. Please sign in again.");
      return;
    }

    const { token } = activeAccount;

    setLoading(true);
    setError(null);
    setEmails([]);
    setTriageMap({});

    fetchEmails(token)
      .then(async (msgs) => {
        setEmails(msgs);
        setLoading(false);

        // Triage sequentially — check cache first to skip already-analyzed emails
        for (const email of msgs) {
          const cached = getCachedTriage(email.id);
          if (cached) {
            setTriageMap((prev) => ({ ...prev, [email.id]: cached }));
            continue;
          }

          const result = await triageEmail(email).catch(() => null);
          if (result) {
            setCachedTriage(email.id, result);
            setTriageMap((prev) => ({ ...prev, [email.id]: result }));
          }
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 3: SSE connection for real-time new-email notifications ───────────
  useEffect(() => {
    if (!activeAccount) return;

    const es = new EventSource("/api/events");

    es.onmessage = async (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        emailId?: string;
      };

      if (data.type !== "new_email" || !data.emailId) return;

      const account = activeAccountRef.current;
      if (!account || isTokenExpired(account)) return;

      try {
        const email = await fetchSingleEmail(data.emailId, account.token);
        setEmails((prev) => {
          // Deduplicate — email may have been fetched already
          if (prev.some((e) => e.id === email.id)) return prev;
          return [email, ...prev];
        });

        const result = await triageEmail(email).catch(() => null);
        if (result) {
          setCachedTriage(email.id, result);
          setTriageMap((prev) => ({ ...prev, [email.id]: result }));
        }
      } catch {
        // Silently ignore — network hiccup or stale token
      }
    };

    es.onerror = () => es.close();

    return () => es.close();
  }, [activeAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callbacks ──────────────────────────────────────────────────────────────

  function handleMarkAsRead(emailId: string) {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isRead: true } : e))
    );
  }

  function handleAccountSwitch(accountId: string) {
    setActiveAccountId(accountId);
    saveActiveAccountId(accountId);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!activeAccount) {
    return <LoginScreen />;
  }

  return (
    <>
      <InboxDashboard
        emails={emails}
        triageMap={triageMap}
        loading={loading}
        error={error}
        filter={filter}
        sortBy={sortBy}
        token={activeAccount.token}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onFilterChange={setFilter}
        onSortChange={setSortBy}
        onMarkAsRead={handleMarkAsRead}
        onDraftReply={(email, triage) => setDraftTarget({ email, triage })}
        onAccountSwitch={handleAccountSwitch}
      />

      {draftTarget && (
        <ComposeModal
          email={draftTarget.email}
          triage={draftTarget.triage}
          onClose={() => setDraftTarget(null)}
        />
      )}
    </>
  );
}
