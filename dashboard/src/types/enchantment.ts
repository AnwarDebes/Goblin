import type { Rarity } from "./shop";

export type EnchantmentSlot = "primary" | "secondary" | "tertiary" | "mythic";

export type ModifierType =
  | "stop_loss"
  | "take_profit"
  | "volume_filter"
  | "correlation_filter"
  | "sentiment_gate"
  | "time_filter"
  | "position_size"
  | "cooldown"
  | "momentum_boost"
  | "volatility_guard";

export interface EnchantmentModifier {
  type: ModifierType;
  value: number;
  unit: "percent" | "absolute" | "multiplier";
  direction: "tighter" | "wider" | "increase" | "decrease";
}

export interface Enchantment {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  slot: EnchantmentSlot;
  cost: number;
  modifier: EnchantmentModifier;
  setId: string;
}

export interface EnchantmentSet {
  id: string;
  name: string;
  icon: string;
  description: string;
  requiredPieces: number;
  enchantmentIds: string[];
  bonusDescription: string;
  bonusModifier: EnchantmentModifier;
  color: string;
}

export interface EnchantedStrategy {
  strategyId: string;
  enchantments: Partial<Record<EnchantmentSlot, string>>;
  activeSetBonus: string | null;
  powerLevel: number;
}
