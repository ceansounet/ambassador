import type { CostSummary } from "@/lib/stats/cost-summary";

let cached: { data: CostSummary; expiresAt: number } | null = null;

export function getCachedCostSummary() {
  if (cached === null || Date.now() >= cached.expiresAt) {
    return null;
  }

  return cached.data;
}

export function setCachedCostSummary(data: CostSummary, ttlMs = 5 * 60 * 1000) {
  cached = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
}

export function clearCachedCostSummary() {
  cached = null;
}
