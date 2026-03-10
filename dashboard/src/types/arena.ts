import type { Rarity } from "./shop";

export type ArenaRank = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "champion";

export interface ArenaFighter {
  id: string;
  name: string;
  strategyName: string;
  winRate: number;
  elo: number;
  rank: ArenaRank;
  avatar: string;
  wins: number;
  losses: number;
  streak: number;
  isPlayer?: boolean;
}

export interface ArenaBattleRound {
  round: number;
  playerReturn: number;
  opponentReturn: number;
  marketCondition: "bull" | "bear" | "chop" | "crash" | "moon";
  winner: "player" | "opponent" | "draw";
}

export interface ArenaBattle {
  id: string;
  player: ArenaFighter;
  opponent: ArenaFighter;
  rounds: ArenaBattleRound[];
  winner: "player" | "opponent" | "draw";
  wager: number;
  eloChange: number;
  timestamp: string;
}

export interface ArenaSeason {
  id: string;
  name: string;
  number: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  rewards: Array<{
    rank: ArenaRank;
    gbln: number;
    title: string;
    cosmetic?: string;
  }>;
}

export interface TreasureMap {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  icon: string;
  waypoints: TreasureWaypoint[];
  reward: TreasureReward;
  expiresAt: string;
  isCompleted: boolean;
  currentWaypoint: number;
}

export interface TreasureWaypoint {
  id: string;
  name: string;
  description: string;
  icon: string;
  challenge: TreasureChallenge;
  isCompleted: boolean;
  reward: { gbln: number; xp: number };
}

export interface TreasureChallenge {
  type: "profit_target" | "win_streak" | "trade_count" | "hold_duration" | "low_drawdown" | "high_sharpe";
  target: number;
  current: number;
  unit: string;
  description: string;
}

export interface TreasureReward {
  gbln: number;
  xp: number;
  item?: { type: "strategy" | "enchantment" | "cosmetic"; name: string; rarity: Rarity };
}

export interface Guild {
  id: string;
  name: string;
  tag: string;
  icon: string;
  level: number;
  members: GuildMember[];
  maxMembers: number;
  treasury: number;
  totalWinRate: number;
  weeklyXP: number;
  perks: GuildPerk[];
  description: string;
  isRecruiting: boolean;
  minLevel: number;
}

export interface GuildMember {
  id: string;
  name: string;
  role: "leader" | "officer" | "member";
  level: number;
  contribution: number;
  joinedAt: string;
  isOnline: boolean;
  avatar: string;
}

export interface GuildPerk {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: number;
  maxLevel: number;
  cost: number;
  effect: string;
}

export interface Prophecy {
  id: string;
  question: string;
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  direction: "above" | "below";
  deadline: string;
  totalPool: number;
  yesPool: number;
  noPool: number;
  userBet?: { side: "yes" | "no"; amount: number };
  status: "active" | "resolved_yes" | "resolved_no" | "expired";
  author: string;
  category: "price" | "volume" | "dominance" | "event";
}

export interface DashboardSkin {
  id: string;
  name: string;
  description: string;
  preview: string;
  rarity: Rarity;
  cost: number;
  category: "theme" | "chart" | "cursor" | "sound" | "frame";
  cssVars?: Record<string, string>;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface MysteryChest {
  id: string;
  tier: "wooden" | "iron" | "gold" | "diamond" | "legendary";
  cost: number;
  possibleRewards: ChestReward[];
  icon: string;
  glowColor: string;
  openAnimation: string;
}

export interface ChestReward {
  type: "gbln" | "strategy" | "enchantment" | "cosmetic" | "xp" | "chest";
  name: string;
  value: number;
  rarity: Rarity;
  icon: string;
}

export interface BattlePassTier {
  level: number;
  xpRequired: number;
  freeReward?: { type: string; name: string; icon: string; value: number };
  premiumReward?: { type: string; name: string; icon: string; value: number; rarity: Rarity };
  isClaimed: boolean;
}

export interface BattlePassSeason {
  id: string;
  name: string;
  number: number;
  theme: string;
  icon: string;
  startDate: string;
  endDate: string;
  tiers: BattlePassTier[];
  currentXP: number;
  isPremium: boolean;
  premiumCost: number;
}

export interface ActivityFeedItem {
  id: string;
  type: "purchase" | "craft" | "achievement" | "battle" | "chest" | "prophecy" | "guild";
  playerName: string;
  message: string;
  icon: string;
  rarity?: Rarity;
  timestamp: string;
}
