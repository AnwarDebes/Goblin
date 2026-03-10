import type {
  FamiliarStage,
  FamiliarPersonality,
  FamiliarMood,
  FamiliarAbility,
  FamiliarCosmetic,
  FamiliarState,
} from "@/types/familiar";
import type { Rarity } from "@/types/shop";

/* ── Evolution Thresholds ──────────────────────────────────────── */

export const STAGE_ORDER: FamiliarStage[] = [
  "egg",
  "hatchling",
  "juvenile",
  "adult",
  "elder",
];

export const EVOLUTION_XP: Record<FamiliarStage, number> = {
  egg: 100,
  hatchling: 500,
  juvenile: 2000,
  adult: 10000,
  elder: Infinity,
};

export const STAGE_CONFIG: Record<
  FamiliarStage,
  { label: string; icon: string; color: string; glowColor: string; description: string }
> = {
  egg: {
    label: "Mysterious Egg",
    icon: "🥚",
    color: "text-amber-300",
    glowColor: "rgba(251,191,36,0.3)",
    description: "A warm egg pulsing with potential. Trade to hatch it!",
  },
  hatchling: {
    label: "Hatchling",
    icon: "🐣",
    color: "text-green-300",
    glowColor: "rgba(134,239,172,0.3)",
    description: "A tiny goblin emerges, eager to learn the markets.",
  },
  juvenile: {
    label: "Juvenile",
    icon: "👹",
    color: "text-blue-400",
    glowColor: "rgba(96,165,250,0.4)",
    description: "Growing sharper. Starting to sense market movements.",
  },
  adult: {
    label: "Adult",
    icon: "🧙",
    color: "text-purple-400",
    glowColor: "rgba(192,132,252,0.5)",
    description: "A seasoned goblin sage with deep market wisdom.",
  },
  elder: {
    label: "Elder",
    icon: "👑",
    color: "text-amber-400",
    glowColor: "rgba(251,191,36,0.6)",
    description: "Transcended. The Elder sees all market dimensions.",
  },
};

/* ── Personality ───────────────────────────────────────────────── */

export function computePersonality(
  winRate: number,
  avgReturn: number,
  tradeCount: number
): FamiliarPersonality {
  if (winRate > 65 && avgReturn > 2) return "aggressive";
  if (winRate > 55 && avgReturn < 0.5) return "cautious";
  if (winRate < 45) return "contrarian";
  if (tradeCount > 200) return "sentinel";
  return "balanced";
}

export const PERSONALITY_LABELS: Record<FamiliarPersonality, { label: string; icon: string; description: string }> = {
  aggressive: { label: "Aggressive", icon: "🔥", description: "Favors high-risk, high-reward plays" },
  cautious: { label: "Cautious", icon: "🛡️", description: "Prefers safe, consistent returns" },
  balanced: { label: "Balanced", icon: "⚖️", description: "Adapts to any market condition" },
  contrarian: { label: "Contrarian", icon: "🔄", description: "Goes against the crowd" },
  sentinel: { label: "Sentinel", icon: "👁️", description: "Always watching, never sleeping" },
};

/* ── Mood ───────────────────────────────────────────────────────── */

export function computeMood(
  dailyPnl: number,
  happiness: number,
  lastTradeMinutesAgo: number
): FamiliarMood {
  if (lastTradeMinutesAgo > 720) return "sleeping";
  if (dailyPnl > 5) return "excited";
  if (dailyPnl < -3) return "worried";
  if (happiness > 70 || dailyPnl > 0) return "alert";
  return "calm";
}

export const MOOD_CONFIG: Record<
  FamiliarMood,
  { label: string; icon: string; color: string; bgColor: string; animation: string }
> = {
  excited: {
    label: "Excited",
    icon: "🤩",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    animation: "animate-bounce",
  },
  alert: {
    label: "Alert",
    icon: "👀",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    animation: "animate-pulse",
  },
  calm: {
    label: "Calm",
    icon: "😌",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    animation: "",
  },
  worried: {
    label: "Worried",
    icon: "😰",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    animation: "animate-pulse",
  },
  sleeping: {
    label: "Sleeping",
    icon: "😴",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    animation: "",
  },
};

/* ── Abilities ─────────────────────────────────────────────────── */

export const FAMILIAR_ABILITIES: FamiliarAbility[] = [
  {
    id: "danger-sense",
    name: "Danger Sense",
    description: "Warns when portfolio risk exceeds safe thresholds using stress test analysis.",
    icon: "🚨",
    unlockStage: "hatchling",
    unlockCost: 50,
    isUnlocked: false,
    cooldownSeconds: 300,
    dataSource: "stress-test",
  },
  {
    id: "gold-nose",
    name: "Gold Nose",
    description: "Detects whale movements and large transaction flows in real-time.",
    icon: "👃",
    unlockStage: "hatchling",
    unlockCost: 200,
    isUnlocked: false,
    cooldownSeconds: 120,
    dataSource: "whales",
  },
  {
    id: "market-whisper",
    name: "Market Whisper",
    description: "Translates signal data into natural language market summaries.",
    icon: "🗣️",
    unlockStage: "juvenile",
    unlockCost: 300,
    isUnlocked: false,
    cooldownSeconds: 60,
    dataSource: "signals",
  },
  {
    id: "crystal-gaze",
    name: "Crystal Gaze",
    description: "Peers into the prediction cone to forecast short-term price movements.",
    icon: "🔮",
    unlockStage: "adult",
    unlockCost: 1000,
    isUnlocked: false,
    cooldownSeconds: 180,
    dataSource: "predictions",
  },
  {
    id: "correlation-web",
    name: "Correlation Web",
    description: "Visualizes hidden correlations between your positions and the broader market.",
    icon: "🕸️",
    unlockStage: "adult",
    unlockCost: 1500,
    isUnlocked: false,
    cooldownSeconds: 300,
    dataSource: "correlations",
  },
  {
    id: "elders-wisdom",
    name: "Elder's Wisdom",
    description: "Unified market briefing combining all data sources into actionable intelligence.",
    icon: "📖",
    unlockStage: "elder",
    unlockCost: 5000,
    isUnlocked: false,
    cooldownSeconds: 600,
    dataSource: "signals",
  },
];

/* ── Cosmetics ─────────────────────────────────────────────────── */

export const COSMETIC_CATALOG: FamiliarCosmetic[] = [
  // Hats
  { id: "hat-wizard", name: "Wizard Hat", slot: "hat", rarity: "common", cost: 20, preview: "🧙" },
  { id: "hat-crown", name: "Golden Crown", slot: "hat", rarity: "epic", cost: 800, preview: "👑" },
  { id: "hat-horns", name: "Devil Horns", slot: "hat", rarity: "rare", cost: 300, preview: "😈" },
  { id: "hat-pirate", name: "Pirate Bandana", slot: "hat", rarity: "uncommon", cost: 100, preview: "🏴‍☠️" },
  { id: "hat-santa", name: "Santa Hat", slot: "hat", rarity: "rare", cost: 250, preview: "🎅" },
  { id: "hat-tophat", name: "Diamond Top Hat", slot: "hat", rarity: "legendary", cost: 2000, preview: "🎩" },
  // Accessories
  { id: "acc-monocle", name: "Monocle", slot: "accessory", rarity: "uncommon", cost: 80, preview: "🧐" },
  { id: "acc-shield", name: "Mini Shield", slot: "accessory", rarity: "rare", cost: 350, preview: "🛡️" },
  { id: "acc-sword", name: "Tiny Sword", slot: "accessory", rarity: "rare", cost: 400, preview: "⚔️" },
  { id: "acc-book", name: "Ancient Tome", slot: "accessory", rarity: "epic", cost: 900, preview: "📕" },
  { id: "acc-staff", name: "Crystal Staff", slot: "accessory", rarity: "legendary", cost: 1800, preview: "🪄" },
  // Auras
  { id: "aura-fire", name: "Fire Aura", slot: "aura", rarity: "rare", cost: 500, preview: "🔥", cssColor: "rgba(239,68,68,0.4)" },
  { id: "aura-ice", name: "Ice Aura", slot: "aura", rarity: "rare", cost: 500, preview: "❄️", cssColor: "rgba(96,165,250,0.4)" },
  { id: "aura-lightning", name: "Lightning Aura", slot: "aura", rarity: "epic", cost: 1000, preview: "⚡", cssColor: "rgba(250,204,21,0.4)" },
  { id: "aura-void", name: "Void Aura", slot: "aura", rarity: "legendary", cost: 2000, preview: "🌀", cssColor: "rgba(168,85,247,0.5)" },
  { id: "aura-gold", name: "Golden Aura", slot: "aura", rarity: "epic", cost: 1200, preview: "✨", cssColor: "rgba(251,191,36,0.4)" },
  // Colors
  { id: "color-emerald", name: "Emerald Skin", slot: "color", rarity: "common", cost: 30, preview: "💚", cssColor: "#10b981" },
  { id: "color-crimson", name: "Crimson Skin", slot: "color", rarity: "uncommon", cost: 100, preview: "❤️", cssColor: "#ef4444" },
  { id: "color-sapphire", name: "Sapphire Skin", slot: "color", rarity: "uncommon", cost: 100, preview: "💙", cssColor: "#3b82f6" },
  { id: "color-amethyst", name: "Amethyst Skin", slot: "color", rarity: "rare", cost: 300, preview: "💜", cssColor: "#a855f7" },
  { id: "color-obsidian", name: "Obsidian Skin", slot: "color", rarity: "epic", cost: 750, preview: "🖤", cssColor: "#1e1b4b" },
  { id: "color-celestial", name: "Celestial Skin", slot: "color", rarity: "legendary", cost: 1500, preview: "🤍", cssColor: "#f0f9ff" },
];

/* ── Helpers ───────────────────────────────────────────────────── */

export function getNextStage(current: FamiliarStage): FamiliarStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

export function canEvolve(state: FamiliarState): boolean {
  const threshold = EVOLUTION_XP[state.stage];
  return state.xp >= threshold && state.stage !== "elder";
}

export function computeHappinessDecay(lastFedAt: string): number {
  const hoursSinceFed = (Date.now() - new Date(lastFedAt).getTime()) / (1000 * 60 * 60);
  return Math.max(0, 100 - Math.floor(hoursSinceFed * 2));
}

export function computeBondLevel(insightsGiven: number, happiness: number): number {
  const base = Math.min(10, Math.floor(insightsGiven / 20));
  const happinessBonus = happiness > 80 ? 1 : 0;
  return Math.min(10, base + happinessBonus);
}

export function getAbilityForStage(stage: FamiliarStage): FamiliarAbility[] {
  return FAMILIAR_ABILITIES.filter((a) => {
    const abilityIdx = STAGE_ORDER.indexOf(a.unlockStage);
    const currentIdx = STAGE_ORDER.indexOf(stage);
    return abilityIdx <= currentIdx;
  });
}

export function createDefaultFamiliar(): FamiliarState {
  return {
    name: "Gobby",
    stage: "egg",
    personality: "balanced",
    mood: "calm",
    xp: 0,
    xpToEvolve: EVOLUTION_XP.egg,
    happiness: 100,
    tradingStreak: 0,
    totalInsightsGiven: 0,
    equippedCosmetics: {},
    unlockedAbilities: [],
    lastFedAt: new Date().toISOString(),
    bondLevel: 1,
    insights: [],
  };
}

export function computeFamiliarXP(tradeCount: number, wins: number, achievementsUnlocked: number): number {
  return tradeCount * 10 + wins * 5 + achievementsUnlocked * 100;
}

export function getCosmeticsBySlot(slot: FamiliarCosmetic["slot"]): FamiliarCosmetic[] {
  return COSMETIC_CATALOG.filter((c) => c.slot === slot);
}

export function getCosmeticById(id: string): FamiliarCosmetic | undefined {
  return COSMETIC_CATALOG.find((c) => c.id === id);
}

export function getAbilityById(id: string): FamiliarAbility | undefined {
  return FAMILIAR_ABILITIES.find((a) => a.id === id);
}
