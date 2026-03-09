/**
 * Multi-account persistence helpers.
 *
 * Accounts are stored as a JSON array in localStorage.
 * The active account ID is stored separately so it survives page refreshes.
 *
 * Pending account state (used during an in-progress OAuth redirect for a new
 * account) is stored in sessionStorage so it's discarded if the tab is closed.
 */

import type { Account, PendingAccount } from "../types";

const ACCOUNTS_KEY = "inbox-triage:accounts";
const ACTIVE_KEY = "inbox-triage:active-account-id";
const PENDING_KEY = "inbox-triage:pending-account";

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function loadActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveAccountId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function savePendingAccount(pending: PendingAccount): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function loadAndClearPendingAccount(): PendingAccount | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as PendingAccount;
  } catch {
    return null;
  }
}

export function isTokenExpired(account: Account): boolean {
  return Date.now() >= account.tokenExpiry;
}
