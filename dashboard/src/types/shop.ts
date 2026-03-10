/* ── Rarity System ──────────────────────────────────────────────── */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface RarityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: string;
}

/* ── Strategy Artifacts ─────────────────────────────────────────── */
export interface StrategyArtifact {
  id: string;
  name: string;
  description: string;
  type: "offensive" | "defensive" | "hybrid";
  rarity: Rarity;
  winRate: number;
  avgReturn: number;
  totalTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  element: "fire" | "ice" | "lightning" | "earth" | "void";
  level: number;
  priceTier: number;
  isOwned: boolean;
  isEquipped: boolean;
}

/* ── Signal Packs ───────────────────────────────────────────────── */
export interface SignalPack {
  id: string;
  name: string;
  symbol: string;
  channelType: "sniper" | "swing" | "scalp" | "whale";
  rarity: Rarity;
  signalCount24h: number;
  accuracy7d: number;
  avgConfidence: number;
  latestSignal: {
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    timestamp: string;
  } | null;
  subscriptionCost: number;
  isSubscribed: boolean;
}

/* ── Indicator Potions ──────────────────────────────────────────── */
export interface IndicatorIngredient {
  id: string;
  name: string;
  category: "momentum" | "trend" | "volatility" | "volume";
  icon: string;
  description: string;
  color: string;
}

export interface CraftedIndicator {
  id: string;
  name: string;
  ingredients: string[];
  rarity: Rarity;
  effectiveness: number;
  createdAt: string;
  priceTier: number;
}

/* ── Achievements & Quests ──────────────────────────────────────── */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  category: "trading" | "strategy" | "social" | "explorer" | "diamond_hands";
  progress: number;
  isUnlocked: boolean;
  reward: number;
  unlockedAt?: string;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: "daily" | "weekly" | "monthly" | "legendary";
  icon: string;
  objectives: Array<{
    label: string;
    current: number;
    target: number;
  }>;
  reward: number;
  xpReward: number;
  expiresAt?: string;
  isCompleted: boolean;
  isClaimed: boolean;
}

/* ── Staking ────────────────────────────────────────────────────── */
export interface StakingPool {
  id: string;
  name: string;
  description: string;
  apy: number;
  lockPeriod: string;
  totalStaked: number;
  minStake: number;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "diamond";
}

/* ── Governance ─────────────────────────────────────────────────── */
export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  author: string;
  status: "active" | "passed" | "rejected" | "pending";
  votesFor: number;
  votesAgainst: number;
  endsAt: string;
  category: "feature" | "parameter" | "treasury" | "partnership";
}

/* ── Player Profile ─────────────────────────────────────────────── */
export interface PlayerProfile {
  goblinsName: string;
  title: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  gbln_balance: number;
  gbln_staked: number;
  totalEarned: number;
  rank: number;
  tier: "bronze" | "silver" | "gold" | "diamond" | "goblin_king";
  joinedAt: string;
  tradingDays: number;
  achievementsUnlocked: number;
  strategiesOwned: number;
}
