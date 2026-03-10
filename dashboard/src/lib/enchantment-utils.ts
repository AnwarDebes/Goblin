import type { Enchantment, EnchantmentSet, EnchantedStrategy, EnchantmentSlot } from "@/types/enchantment";
import type { Rarity } from "@/types/shop";

/* ── Enchantment Catalog ───────────────────────────────────────── */

export const ENCHANTMENT_SETS: EnchantmentSet[] = [
  {
    id: "iron-guard",
    name: "Iron Guard",
    icon: "🛡️",
    description: "Defensive enchantments that protect against drawdowns",
    requiredPieces: 3,
    enchantmentIds: ["ig-stop-loss", "ig-drawdown", "ig-position", "ig-cooldown", "ig-hedge"],
    bonusDescription: "Set Bonus: -15% max drawdown protection",
    bonusModifier: { type: "stop_loss", value: 15, unit: "percent", direction: "tighter" },
    color: "text-blue-400",
  },
  {
    id: "storm-striker",
    name: "Storm Striker",
    icon: "⚡",
    description: "Offensive enchantments that amplify winning trades",
    requiredPieces: 3,
    enchantmentIds: ["ss-take-profit", "ss-position", "ss-momentum", "ss-breakout", "ss-leverage"],
    bonusDescription: "Set Bonus: +20% take profit extension",
    bonusModifier: { type: "take_profit", value: 20, unit: "percent", direction: "wider" },
    color: "text-red-400",
  },
  {
    id: "oracle-blessing",
    name: "Oracle's Blessing",
    icon: "🔮",
    description: "Signal-based enchantments that enhance decision quality",
    requiredPieces: 3,
    enchantmentIds: ["ob-sentiment", "ob-correlation", "ob-volume", "ob-whale", "ob-confidence"],
    bonusDescription: "Set Bonus: +25% signal confidence threshold",
    bonusModifier: { type: "sentiment_gate", value: 25, unit: "percent", direction: "increase" },
    color: "text-purple-400",
  },
  {
    id: "time-weaver",
    name: "Time Weaver",
    icon: "⏰",
    description: "Timing enchantments that optimize entry and exit points",
    requiredPieces: 3,
    enchantmentIds: ["tw-session", "tw-volatility", "tw-trend", "tw-reversion", "tw-news"],
    bonusDescription: "Set Bonus: Smart session timing for +10% win rate",
    bonusModifier: { type: "time_filter", value: 10, unit: "percent", direction: "increase" },
    color: "text-amber-400",
  },
];

export const ENCHANTMENTS: Enchantment[] = [
  // Iron Guard Set
  { id: "ig-stop-loss", name: "Stop Loss Tightener", description: "Reduces stop loss distance by 10%, limiting downside risk.", icon: "🔒", rarity: "uncommon", slot: "primary", cost: 100, modifier: { type: "stop_loss", value: 10, unit: "percent", direction: "tighter" }, setId: "iron-guard" },
  { id: "ig-drawdown", name: "Drawdown Shield", description: "Pauses trading when drawdown exceeds threshold.", icon: "🛡️", rarity: "rare", slot: "secondary", cost: 300, modifier: { type: "stop_loss", value: 5, unit: "percent", direction: "tighter" }, setId: "iron-guard" },
  { id: "ig-position", name: "Position Reducer", description: "Reduces position size by 20% during high volatility.", icon: "📉", rarity: "uncommon", slot: "primary", cost: 150, modifier: { type: "position_size", value: 20, unit: "percent", direction: "decrease" }, setId: "iron-guard" },
  { id: "ig-cooldown", name: "Cooldown Enforcer", description: "Adds 5-minute cooldown between trades.", icon: "⏸️", rarity: "common", slot: "primary", cost: 50, modifier: { type: "cooldown", value: 300, unit: "absolute", direction: "increase" }, setId: "iron-guard" },
  { id: "ig-hedge", name: "Hedge Trigger", description: "Auto-hedges when correlation drops below 0.3.", icon: "🔄", rarity: "epic", slot: "tertiary", cost: 800, modifier: { type: "correlation_filter", value: 30, unit: "percent", direction: "tighter" }, setId: "iron-guard" },

  // Storm Striker Set
  { id: "ss-take-profit", name: "Take Profit Extender", description: "Extends take profit target by 15% on strong trends.", icon: "🎯", rarity: "uncommon", slot: "primary", cost: 120, modifier: { type: "take_profit", value: 15, unit: "percent", direction: "wider" }, setId: "storm-striker" },
  { id: "ss-position", name: "Position Amplifier", description: "Increases position size by 25% on high-confidence signals.", icon: "📈", rarity: "rare", slot: "secondary", cost: 350, modifier: { type: "position_size", value: 25, unit: "percent", direction: "increase" }, setId: "storm-striker" },
  { id: "ss-momentum", name: "Momentum Surfer", description: "Adds momentum confirmation before entry.", icon: "🏄", rarity: "rare", slot: "secondary", cost: 400, modifier: { type: "momentum_boost", value: 15, unit: "percent", direction: "increase" }, setId: "storm-striker" },
  { id: "ss-breakout", name: "Breakout Detector", description: "Detects volume breakouts for aggressive entries.", icon: "💥", rarity: "epic", slot: "tertiary", cost: 900, modifier: { type: "volume_filter", value: 200, unit: "percent", direction: "increase" }, setId: "storm-striker" },
  { id: "ss-leverage", name: "Leverage Boost", description: "Increases effective leverage by 1.5x on winning streaks.", icon: "🚀", rarity: "legendary", slot: "mythic", cost: 2000, modifier: { type: "position_size", value: 50, unit: "percent", direction: "increase" }, setId: "storm-striker" },

  // Oracle's Blessing Set
  { id: "ob-sentiment", name: "Sentiment Gate", description: "Only enters trades when sentiment aligns with direction.", icon: "🧠", rarity: "uncommon", slot: "primary", cost: 130, modifier: { type: "sentiment_gate", value: 60, unit: "percent", direction: "increase" }, setId: "oracle-blessing" },
  { id: "ob-correlation", name: "Correlation Shield", description: "Blocks trades on highly correlated assets.", icon: "🔗", rarity: "rare", slot: "secondary", cost: 350, modifier: { type: "correlation_filter", value: 80, unit: "percent", direction: "tighter" }, setId: "oracle-blessing" },
  { id: "ob-volume", name: "Volume Surge Detector", description: "Confirms entries with unusual volume spikes.", icon: "📊", rarity: "rare", slot: "secondary", cost: 300, modifier: { type: "volume_filter", value: 150, unit: "percent", direction: "increase" }, setId: "oracle-blessing" },
  { id: "ob-whale", name: "Whale Alert Trigger", description: "Pauses trading during large whale movements.", icon: "🐋", rarity: "epic", slot: "tertiary", cost: 750, modifier: { type: "volume_filter", value: 300, unit: "percent", direction: "tighter" }, setId: "oracle-blessing" },
  { id: "ob-confidence", name: "Confidence Booster", description: "Only takes signals with >80% AI confidence.", icon: "✅", rarity: "legendary", slot: "mythic", cost: 1800, modifier: { type: "sentiment_gate", value: 80, unit: "percent", direction: "increase" }, setId: "oracle-blessing" },

  // Time Weaver Set
  { id: "tw-session", name: "Session Timer", description: "Restricts trading to optimal market hours.", icon: "🕐", rarity: "common", slot: "primary", cost: 60, modifier: { type: "time_filter", value: 8, unit: "absolute", direction: "tighter" }, setId: "time-weaver" },
  { id: "tw-volatility", name: "Volatility Window", description: "Only trades during moderate volatility periods.", icon: "🌊", rarity: "uncommon", slot: "primary", cost: 140, modifier: { type: "volatility_guard", value: 20, unit: "percent", direction: "tighter" }, setId: "time-weaver" },
  { id: "tw-trend", name: "Trend Follower", description: "Confirms direction with multi-timeframe trend analysis.", icon: "📐", rarity: "rare", slot: "secondary", cost: 400, modifier: { type: "momentum_boost", value: 10, unit: "percent", direction: "increase" }, setId: "time-weaver" },
  { id: "tw-reversion", name: "Mean Reversion Trigger", description: "Detects oversold/overbought conditions for reversal plays.", icon: "🔁", rarity: "epic", slot: "tertiary", cost: 700, modifier: { type: "momentum_boost", value: 20, unit: "percent", direction: "decrease" }, setId: "time-weaver" },
  { id: "tw-news", name: "News Filter", description: "Pauses trading during major news events.", icon: "📰", rarity: "legendary", slot: "mythic", cost: 1500, modifier: { type: "time_filter", value: 30, unit: "absolute", direction: "tighter" }, setId: "time-weaver" },
];

/* ── Helpers ───────────────────────────────────────────────────── */

export function getEnchantmentById(id: string): Enchantment | undefined {
  return ENCHANTMENTS.find((e) => e.id === id);
}

export function getSetById(id: string): EnchantmentSet | undefined {
  return ENCHANTMENT_SETS.find((s) => s.id === id);
}

export function getEnchantmentsBySet(setId: string): Enchantment[] {
  return ENCHANTMENTS.filter((e) => e.setId === setId);
}

export function computeSetBonus(equipped: Partial<Record<EnchantmentSlot, string>>): string | null {
  const equippedIds = Object.values(equipped).filter(Boolean) as string[];
  for (const set of ENCHANTMENT_SETS) {
    const count = equippedIds.filter((id) => set.enchantmentIds.includes(id)).length;
    if (count >= set.requiredPieces) return set.id;
  }
  return null;
}

export function computePowerLevel(equipped: Partial<Record<EnchantmentSlot, string>>): number {
  const equippedIds = Object.values(equipped).filter(Boolean) as string[];
  let power = 0;
  for (const id of equippedIds) {
    const ench = getEnchantmentById(id);
    if (!ench) continue;
    const rarityMultiplier: Record<Rarity, number> = {
      common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8,
    };
    power += ench.modifier.value * (rarityMultiplier[ench.rarity] ?? 1);
  }
  const setBonus = computeSetBonus(equipped);
  if (setBonus) power *= 1.5;
  return Math.round(power);
}

export const SLOT_UNLOCK_COSTS: Record<EnchantmentSlot, number> = {
  primary: 0,
  secondary: 500,
  tertiary: 1000,
  mythic: 3000,
};

export const SLOT_CONFIG: Record<EnchantmentSlot, { label: string; icon: string; color: string }> = {
  primary: { label: "Primary", icon: "🔵", color: "text-blue-400" },
  secondary: { label: "Secondary", icon: "🟢", color: "text-green-400" },
  tertiary: { label: "Tertiary", icon: "🟣", color: "text-purple-400" },
  mythic: { label: "Mythic", icon: "🟡", color: "text-amber-400" },
};
