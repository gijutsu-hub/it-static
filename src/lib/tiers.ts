export interface Tier {
  name: string;
  icon: string;       // material symbol
  emoji: string;
  color: string;      // bg color
  textColor: string;
  borderColor: string;
  minPoints: number;
  nextAt: number | null;
}

const TIERS: Tier[] = [
  { name: "Scout",   icon: "my_location",  emoji: "🔍", color: "#e8e8e8", textColor: "#444",    borderColor: "#bbb",    minPoints: 0,    nextAt: 100  },
  { name: "Hunter",  icon: "search",       emoji: "🎯", color: "#d4edda", textColor: "#155724", borderColor: "#28a745", minPoints: 100,  nextAt: 500  },
  { name: "Tracker", icon: "radar",        emoji: "🛰️", color: "#cce5ff", textColor: "#004085", borderColor: "#0056b3", minPoints: 500,  nextAt: 1500 },
  { name: "Elite",   icon: "bolt",         emoji: "⚡", color: "#fff3cd", textColor: "#856404", borderColor: "#ffc107", minPoints: 1500, nextAt: 5000 },
  { name: "Legend",  icon: "workspace_premium", emoji: "👑", color: "#f3e8f7", textColor: "#6a1b9a", borderColor: "#9c27b0", minPoints: 5000, nextAt: null },
];

export function getTier(points: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPoints) return TIERS[i];
  }
  return TIERS[0];
}

export function getTierProgress(points: number): { tier: Tier; progress: number } {
  const tier = getTier(points);
  if (!tier.nextAt) return { tier, progress: 100 };
  const range = tier.nextAt - tier.minPoints;
  const done = points - tier.minPoints;
  return { tier, progress: Math.min(100, Math.round((done / range) * 100)) };
}

export { TIERS };
