import type { Rarity } from "./shop";

/* ── Evolution ─────────────────────────────────────────────────── */
export type FamiliarStage = "egg" | "hatchling" | "juvenile" | "adult" | "elder";

export type FamiliarPersonality =
  | "aggressive"
  | "cautious"
  | "balanced"
  | "contrarian"
  | "sentinel";

export type FamiliarMood =
  | "excited"
  | "alert"
  | "calm"
  | "worried"
  | "sleeping";

/* ── Abilities ─────────────────────────────────────────────────── */
export type AbilityDataSource =
  | "signals"
  | "whales"
  | "sentiment"
  | "predictions"
  | "stress-test"
  | "correlations";

export interface FamiliarAbility {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockStage: FamiliarStage;
  unlockCost: number;
  isUnlocked: boolean;
  cooldownSeconds: number;
  dataSource: AbilityDataSource;
}

/* ── Cosmetics ─────────────────────────────────────────────────── */
export type CosmeticSlot = "hat" | "accessory" | "aura" | "color";

export interface FamiliarCosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  cost: number;
  preview: string;
  cssColor?: string;
}

/* ── Insight ───────────────────────────────────────────────────── */
export interface FamiliarInsight {
  id: string;
  abilityId: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "positive";
  timestamp: string;
  data?: Record<string, unknown>;
}

/* ── State ─────────────────────────────────────────────────────── */
export interface FamiliarState {
  name: string;
  stage: FamiliarStage;
  personality: FamiliarPersonality;
  mood: FamiliarMood;
  xp: number;
  xpToEvolve: number;
  happiness: number;
  tradingStreak: number;
  totalInsightsGiven: number;
  equippedCosmetics: Partial<Record<CosmeticSlot, string>>;
  unlockedAbilities: string[];
  lastFedAt: string;
  bondLevel: number;
  insights: FamiliarInsight[];
}
