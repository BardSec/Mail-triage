/**
 * Persistent triage cache backed by localStorage.
 *
 * Cache entries expire after 24 hours so stale AI analyses are evicted
 * automatically. Re-running the app within 24 hours will skip Claude calls
 * for emails that were already triaged.
 *
 * Storage key pattern: "inbox-triage:triage:<emailId>"
 */

import type { TriageResult } from "../types";

const CACHE_PREFIX = "inbox-triage:triage:";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  result: TriageResult;
  cachedAt: number; // unix ms
}

export function getCachedTriage(emailId: string): TriageResult | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + emailId);
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + emailId);
      return null;
    }

    return entry.result;
  } catch {
    return null;
  }
}

export function setCachedTriage(emailId: string, result: TriageResult): void {
  try {
    const entry: CacheEntry = { result, cachedAt: Date.now() };
    localStorage.setItem(CACHE_PREFIX + emailId, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently skip caching
  }
}

/** Wipes all triage cache entries (useful for testing / forced re-analysis). */
export function clearTriageCache(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
