import type { Trade, Signal, Position, PortfolioState, ModelStatus, SentimentData } from "@/types";
import type {
  Rarity,
  RarityConfig,
  StrategyArtifact,
  SignalPack,
  IndicatorIngredient,
  CraftedIndicator,
  Achievement,
  Quest,
  PlayerProfile,
} from "@/types/shop";

/* ── Rarity Config ─────────────────────────────────────────────── */

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  common: {
    label: "Common",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    glowColor: "rgba(156,163,175,0.3)",
    icon: "⚪",
  },
  uncommon: {
    label: "Uncommon",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    glowColor: "rgba(34,197,94,0.3)",
    icon: "🟢",
  },
  rare: {
    label: "Rare",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    glowColor: "rgba(59,130,246,0.4)",
    icon: "🔵",
  },
  epic: {
    label: "Epic",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    glowColor: "rgba(168,85,247,0.5)",
    icon: "🟣",
  },
  legendary: {
    label: "Legendary",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    glowColor: "rgba(251,191,36,0.6)",
    icon: "🟡",
  },
};

/* ── Compute Functions ─────────────────────────────────────────── */

export function computeStrategyRarity(winRate: number, sharpe: number, trades: number): Rarity {
  const score =
    (winRate / 100) * 40 +
    (Math.min(sharpe, 3) / 3) * 40 +
    (Math.min(trades, 500) / 500) * 20;
  if (score >= 85) return "legendary";
  if (score >= 70) return "epic";
  if (score >= 50) return "rare";
  if (score >= 30) return "uncommon";
  return "common";
}

export function computeSignalRarity(accuracy7d: number, avgConfidence: number): Rarity {
  const score = accuracy7d * 0.6 + avgConfidence * 0.4;
  if (score >= 85) return "legendary";
  if (score >= 70) return "epic";
  if (score >= 55) return "rare";
  if (score >= 40) return "uncommon";
  return "common";
}

export function computePriceTier(rarity: Rarity): number {
  const prices: Record<Rarity, number> = {
    common: 10,
    uncommon: 50,
    rare: 200,
    epic: 1000,
    legendary: 5000,
  };
  return prices[rarity];
}

export function computeLevel(xp: number): { level: number; xpToNext: number } {
  let level = 1;
  let remaining = xp;
  while (remaining >= level * 100) {
    remaining -= level * 100;
    level++;
  }
  return { level, xpToNext: level * 100 - remaining };
}

export function computeTier(level: number): PlayerProfile["tier"] {
  if (level >= 50) return "goblin_king";
  if (level >= 30) return "diamond";
  if (level >= 20) return "gold";
  if (level >= 10) return "silver";
  return "bronze";
}

export function computeElement(
  type: StrategyArtifact["type"],
  winRate: number
): StrategyArtifact["element"] {
  if (type === "offensive" && winRate > 60) return "fire";
  if (type === "offensive") return "lightning";
  if (type === "defensive" && winRate > 60) return "ice";
  if (type === "defensive") return "earth";
  return "void";
}

/* ── Strategy Artifact Generator ───────────────────────────────── */

function formatStrategyName(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateStrategyDescription(name: string, winRate: number, _avgReturn: number): string {
  if (winRate > 70)
    return `A legendary artifact forged in the fires of ${Math.round(winRate)}% win rate. Wield with confidence.`;
  if (winRate > 50)
    return `A reliable blade honed through battle. ${Math.round(winRate)}% of strikes land true.`;
  return `An experimental creation still finding its edge. Approach with caution.`;
}

export function generateStrategyArtifacts(
  trades: Trade[],
  models: ModelStatus[],
  _signals: Signal[]
): StrategyArtifact[] {
  const strategyGroups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = trade.strategy || "ml_ensemble";
    if (!strategyGroups.has(key)) strategyGroups.set(key, []);
    strategyGroups.get(key)!.push(trade);
  }

  return Array.from(strategyGroups.entries()).map(([stratName, stratTrades]) => {
    const wins = stratTrades.filter((t) => t.realized_pnl > 0).length;
    const winRate = stratTrades.length > 0 ? (wins / stratTrades.length) * 100 : 0;
    const avgReturn =
      stratTrades.length > 0
        ? stratTrades.reduce((sum, t) => sum + t.pnl_pct, 0) / stratTrades.length
        : 0;
    const returns = stratTrades.map((t) => t.pnl_pct);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (returns.length || 1)
    );
    const sharpe = stdDev > 0 ? meanReturn / stdDev : 0;
    const maxDD = Math.min(...returns, 0);

    const type: StrategyArtifact["type"] =
      avgReturn > 2 ? "offensive" : avgReturn < 0 ? "defensive" : "hybrid";
    const rarity = computeStrategyRarity(winRate, sharpe, stratTrades.length);

    return {
      id: stratName,
      name: formatStrategyName(stratName),
      description: generateStrategyDescription(stratName, winRate, avgReturn),
      type,
      rarity,
      winRate,
      avgReturn,
      totalTrades: stratTrades.length,
      sharpeRatio: sharpe,
      maxDrawdown: maxDD,
      element: computeElement(type, winRate),
      level: Math.min(100, Math.floor(stratTrades.length / 5)),
      priceTier: computePriceTier(rarity),
      isOwned: false,
      isEquipped: false,
    };
  });
}

/* ── Signal Pack Generator ─────────────────────────────────────── */

export function generateSignalPacks(
  signals: Signal[],
  sentiment: SentimentData[]
): SignalPack[] {
  const symbolGroups = new Map<string, Signal[]>();
  for (const sig of signals) {
    if (!symbolGroups.has(sig.symbol)) symbolGroups.set(sig.symbol, []);
    symbolGroups.get(sig.symbol)!.push(sig);
  }

  return Array.from(symbolGroups.entries()).map(([symbol, symSignals]) => {
    const buySignals = symSignals.filter((s) => s.action === "BUY");
    const avgConf =
      symSignals.reduce((s, sig) => s + sig.confidence, 0) / (symSignals.length || 1);
    const sentimentEntry = sentiment.find((s) => s.symbol === symbol);

    const channelType: SignalPack["channelType"] =
      symSignals.length > 20
        ? "scalp"
        : symSignals.length > 10
          ? "swing"
          : buySignals.length > symSignals.length * 0.7
            ? "whale"
            : "sniper";

    const accuracy = Math.min(
      95,
      40 + avgConf * 0.5 + (sentimentEntry?.score ?? 50) * 0.1
    );
    const rarity = computeSignalRarity(accuracy, avgConf);

    return {
      id: `signal-${symbol}`,
      name: `${symbol.replace("USDT", "")} Signal Channel`,
      symbol,
      channelType,
      rarity,
      signalCount24h: symSignals.length,
      accuracy7d: accuracy,
      avgConfidence: avgConf,
      latestSignal:
        symSignals.length > 0
          ? {
              action: symSignals[0].action,
              confidence: symSignals[0].confidence,
              timestamp: symSignals[0].timestamp,
            }
          : null,
      subscriptionCost: computePriceTier(rarity),
      isSubscribed: false,
    };
  });
}

/* ── Achievement Generator ─────────────────────────────────────── */

function computeConsecutiveWins(trades: Trade[]): number {
  let max = 0;
  let current = 0;
  for (const t of [...trades].reverse()) {
    if (t.realized_pnl > 0) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

function computeLongestHold(positions: Position[]): number {
  if (positions.length === 0) return 0;
  return Math.max(
    ...positions.map((p) => (Date.now() - new Date(p.opened_at).getTime()) / 1000)
  );
}

export function generateAchievements(
  portfolio: PortfolioState,
  trades: Trade[],
  positions: Position[],
  _signals: Signal[],
  models: ModelStatus[]
): Achievement[] {
  const totalPnl = trades.reduce((s, t) => s + t.realized_pnl, 0);
  const consecutiveWins = computeConsecutiveWins(trades);
  const uniqueSymbols = new Set(trades.map((t) => t.symbol)).size;

  return [
    {
      id: "first-blood",
      name: "First Blood",
      description: "Execute your first trade",
      icon: "⚔️",
      rarity: "common" as Rarity,
      category: "trading",
      progress: Math.min(100, trades.length > 0 ? 100 : 0),
      isUnlocked: trades.length > 0,
      reward: 10,
    },
    {
      id: "centurion",
      name: "The Centurion",
      description: "Execute 100 trades",
      icon: "🏛️",
      rarity: "rare" as Rarity,
      category: "trading",
      progress: Math.min(100, (trades.length / 100) * 100),
      isUnlocked: trades.length >= 100,
      reward: 500,
    },
    {
      id: "winning-streak",
      name: "Unstoppable",
      description: "Win 5 trades in a row",
      icon: "🔥",
      rarity: "epic" as Rarity,
      category: "trading",
      progress: Math.min(100, (consecutiveWins / 5) * 100),
      isUnlocked: consecutiveWins >= 5,
      reward: 1000,
    },
    {
      id: "profit-master",
      name: "Profit Master",
      description: "Reach $1,000 total realized profit",
      icon: "💰",
      rarity: "epic" as Rarity,
      category: "trading",
      progress: Math.min(100, (Math.max(0, totalPnl) / 1000) * 100),
      isUnlocked: totalPnl >= 1000,
      reward: 2000,
    },
    {
      id: "diversifier",
      name: "The Diversifier",
      description: "Trade 5 different symbols",
      icon: "🌐",
      rarity: "uncommon" as Rarity,
      category: "explorer",
      progress: Math.min(100, (uniqueSymbols / 5) * 100),
      isUnlocked: uniqueSymbols >= 5,
      reward: 100,
    },
    {
      id: "diamond-hands",
      name: "Diamond Hands",
      description: "Hold a position for over 24 hours",
      icon: "💎",
      rarity: "rare" as Rarity,
      category: "diamond_hands",
      progress: Math.min(
        100,
        computeLongestHold(positions) >= 86400
          ? 100
          : (computeLongestHold(positions) / 86400) * 100
      ),
      isUnlocked: computeLongestHold(positions) >= 86400,
      reward: 300,
    },
    {
      id: "ai-whisperer",
      name: "AI Whisperer",
      description: "Have all AI models in active status",
      icon: "🧠",
      rarity: "legendary" as Rarity,
      category: "strategy",
      progress: Math.min(
        100,
        (models.filter((m) => m.status === "active").length / Math.max(1, models.length)) * 100
      ),
      isUnlocked: models.length > 0 && models.every((m) => m.status === "active"),
      reward: 5000,
    },
    {
      id: "goblin-king",
      name: "The Goblin King",
      description: "Reach $10,000 portfolio value",
      icon: "👑",
      rarity: "legendary" as Rarity,
      category: "trading",
      progress: Math.min(100, (portfolio.total_value / 10000) * 100),
      isUnlocked: portfolio.total_value >= 10000,
      reward: 10000,
    },
  ];
}

/* ── Quest Generator ───────────────────────────────────────────── */

export function generateQuests(
  trades: Trade[],
  signals: Signal[],
  portfolio: PortfolioState
): Quest[] {
  const todayTrades = trades.filter(
    (t) => new Date(t.closed_at).toDateString() === new Date().toDateString()
  );
  const todaySignals = signals.filter(
    (s) => new Date(s.timestamp).toDateString() === new Date().toDateString()
  );

  return [
    {
      id: "daily-trader",
      name: "The Daily Grind",
      description: "Execute 3 trades today",
      type: "daily",
      icon: "⚔️",
      objectives: [{ label: "Trades executed", current: todayTrades.length, target: 3 }],
      reward: 25,
      xpReward: 50,
      isCompleted: todayTrades.length >= 3,
      isClaimed: false,
    },
    {
      id: "daily-profit",
      name: "Gold Rush",
      description: "End the day with positive P&L",
      type: "daily",
      icon: "💰",
      objectives: [
        { label: "Daily P&L", current: Math.max(0, portfolio.daily_pnl), target: 1 },
      ],
      reward: 50,
      xpReward: 100,
      isCompleted: portfolio.daily_pnl > 0,
      isClaimed: false,
    },
    {
      id: "daily-signal-watcher",
      name: "Signal Scout",
      description: "Observe 5 AI signals",
      type: "daily",
      icon: "📡",
      objectives: [{ label: "Signals observed", current: todaySignals.length, target: 5 }],
      reward: 15,
      xpReward: 30,
      isCompleted: todaySignals.length >= 5,
      isClaimed: false,
    },
    {
      id: "weekly-warrior",
      name: "Weekly Warrior",
      description: "Execute 20 trades this week",
      type: "weekly",
      icon: "🛡️",
      objectives: [
        { label: "Trades this week", current: Math.min(20, trades.length), target: 20 },
      ],
      reward: 200,
      xpReward: 500,
      isCompleted: trades.length >= 20,
      isClaimed: false,
    },
    {
      id: "weekly-winrate",
      name: "Sharpshooter",
      description: "Maintain 60%+ win rate over 10 trades",
      type: "weekly",
      icon: "🎯",
      objectives: [
        {
          label: "Win rate",
          current:
            trades.length >= 10
              ? Math.round(
                  (trades.filter((t) => t.realized_pnl > 0).length / trades.length) * 100
                )
              : 0,
          target: 60,
        },
      ],
      reward: 300,
      xpReward: 600,
      isCompleted:
        trades.length >= 10 &&
        trades.filter((t) => t.realized_pnl > 0).length / trades.length >= 0.6,
      isClaimed: false,
    },
    {
      id: "monthly-legend",
      name: "Legend of the Bazaar",
      description: "Accumulate $500 in realized profit",
      type: "monthly",
      icon: "🏆",
      objectives: [
        {
          label: "Total profit",
          current: Math.max(0, Math.round(trades.reduce((s, t) => s + t.realized_pnl, 0))),
          target: 500,
        },
      ],
      reward: 2000,
      xpReward: 5000,
      isCompleted: trades.reduce((s, t) => s + t.realized_pnl, 0) >= 500,
      isClaimed: false,
    },
  ];
}

/* ── Ingredients ───────────────────────────────────────────────── */

export const INGREDIENTS: IndicatorIngredient[] = [
  { id: "rsi", name: "RSI Essence", category: "momentum", icon: "📊", description: "Relative Strength Index — overbought/oversold detector", color: "#22c55e" },
  { id: "macd", name: "MACD Elixir", category: "trend", icon: "📈", description: "Moving Average Convergence Divergence — trend momentum", color: "#3b82f6" },
  { id: "bollinger", name: "Bollinger Dust", category: "volatility", icon: "🌪️", description: "Bollinger Bands — volatility envelope", color: "#a855f7" },
  { id: "ema", name: "EMA Crystal", category: "trend", icon: "💎", description: "Exponential Moving Average — trend direction", color: "#06b6d4" },
  { id: "stochastic", name: "Stochastic Powder", category: "momentum", icon: "⚡", description: "Stochastic Oscillator — momentum reversals", color: "#f59e0b" },
  { id: "atr", name: "ATR Flames", category: "volatility", icon: "🔥", description: "Average True Range — volatility measurement", color: "#ef4444" },
  { id: "obv", name: "OBV Nectar", category: "volume", icon: "🧪", description: "On-Balance Volume — volume-price relationship", color: "#10b981" },
  { id: "vwap", name: "VWAP Serum", category: "volume", icon: "💧", description: "Volume-Weighted Avg Price — institutional levels", color: "#6366f1" },
  { id: "williams", name: "Williams' Tear", category: "momentum", icon: "💀", description: "Williams %R — extreme overbought/oversold", color: "#dc2626" },
  { id: "keltner", name: "Keltner Silk", category: "volatility", icon: "🕸️", description: "Keltner Channels — volatility-based channels", color: "#8b5cf6" },
  { id: "sma", name: "SMA Stone", category: "trend", icon: "🪨", description: "Simple Moving Average — baseline trend", color: "#64748b" },
  { id: "mfi", name: "MFI Essence", category: "volume", icon: "🌊", description: "Money Flow Index — volume-weighted RSI", color: "#0ea5e9" },
];

/* ── Crafting Logic ────────────────────────────────────────────── */

const CRAFTING_NAMES: Record<string, string> = {
  "momentum+trend": "Momentum Convergence Elixir",
  "momentum+volatility": "Storm Surge Tonic",
  "momentum+volume": "Flow Force Potion",
  "trend+volatility": "Trend Tempest Brew",
  "trend+volume": "Current Rider Serum",
  "volatility+volume": "Chaos Distillate",
  "momentum+trend+volatility": "Arcane Fusion Extract",
  "momentum+trend+volume": "Triple Force Elixir",
  "momentum+volatility+volume": "Elemental Storm Brew",
  "trend+volatility+volume": "Market Oracle Tonic",
  "momentum+trend+volatility+volume": "Philosopher's Stone",
};

export function computeCraftedIndicator(ingredientIds: string[]): CraftedIndicator {
  const ingredients = ingredientIds
    .map((id) => INGREDIENTS.find((i) => i.id === id))
    .filter(Boolean) as IndicatorIngredient[];

  const categories = new Set(ingredients.map((i) => i.category));
  const sortedCats = Array.from(categories).sort();
  const catKey = sortedCats.join("+");

  const name = CRAFTING_NAMES[catKey] || `Custom ${ingredients.map((i) => i.name.split(" ")[0]).join("-")} Brew`;

  // Effectiveness: more diverse categories = better, same-category redundancy = worse
  const diversityBonus = categories.size * 20;
  const redundancyPenalty = Math.max(0, (ingredients.length - categories.size) * 10);
  // Known good synergies
  const hasMomentumTrend = categories.has("momentum") && categories.has("trend");
  const hasVolatilityVolume = categories.has("volatility") && categories.has("volume");
  const synergyBonus = (hasMomentumTrend ? 15 : 0) + (hasVolatilityVolume ? 15 : 0);

  const effectiveness = Math.min(100, Math.max(10, diversityBonus - redundancyPenalty + synergyBonus + 10));

  // Rarity from ingredient count + diversity
  const rarityScore = ingredients.length * 15 + categories.size * 20;
  let rarity: Rarity = "common";
  if (rarityScore >= 90) rarity = "legendary";
  else if (rarityScore >= 75) rarity = "epic";
  else if (rarityScore >= 55) rarity = "rare";
  else if (rarityScore >= 35) rarity = "uncommon";

  return {
    id: `craft-${ingredientIds.sort().join("-")}-${Date.now()}`,
    name,
    ingredients: ingredientIds,
    rarity,
    effectiveness,
    createdAt: new Date().toISOString(),
    priceTier: computePriceTier(rarity),
  };
}
