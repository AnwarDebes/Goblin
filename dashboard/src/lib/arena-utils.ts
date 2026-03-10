import type {
  ArenaFighter,
  ArenaBattle,
  ArenaBattleRound,
  ArenaRank,
  TreasureMap,
  TreasureWaypoint,
  Guild,
  GuildMember,
  GuildPerk,
  Prophecy,
  DashboardSkin,
  MysteryChest,
  ChestReward,
  BattlePassSeason,
  BattlePassTier,
  ActivityFeedItem,
} from "@/types/arena";
import type { Rarity } from "@/types/shop";
import type { Trade } from "@/types";

/* ── Arena ────────────────────────────────────────────────────────── */

const ARENA_NAMES = [
  "CryptoSamurai", "MoonHunter", "DiamondDegen", "WhaleSlayer", "TrendRider",
  "AlphaGoblin", "NightTrader", "SharpeShooter", "BearCrusher", "VoidWalker",
  "ChartMage", "SignalSage", "OrderFlowKing", "DeltaNeutral", "GammaSqueezer",
  "LiquidityHunter", "FibonacciWizard", "IchimokuMaster", "BollingerBandit", "RSI_Ronin",
];

const ARENA_AVATARS = ["⚔️", "🗡️", "🛡️", "🏹", "🔱", "⚡", "🔥", "❄️", "🌪️", "💀"];

const STRATEGY_NAMES = [
  "Momentum Surge", "Mean Reversion Pro", "Breakout Hunter", "Scalp Master",
  "Trend Follower Elite", "Volatility Crusher", "VWAP Sniper", "Order Flow Alpha",
  "ML Ensemble v3", "Neural Scalper", "Sentiment Surfer", "Whale Tracker",
];

export function computeRank(elo: number): ArenaRank {
  if (elo >= 2400) return "champion";
  if (elo >= 2000) return "diamond";
  if (elo >= 1600) return "platinum";
  if (elo >= 1200) return "gold";
  if (elo >= 800) return "silver";
  return "bronze";
}

export const RANK_CONFIG: Record<ArenaRank, { label: string; icon: string; color: string; bgColor: string }> = {
  bronze: { label: "Bronze", icon: "🥉", color: "text-orange-400", bgColor: "bg-orange-500/10" },
  silver: { label: "Silver", icon: "🥈", color: "text-gray-300", bgColor: "bg-gray-500/10" },
  gold: { label: "Gold", icon: "🥇", color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  platinum: { label: "Platinum", icon: "💠", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  diamond: { label: "Diamond", icon: "💎", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  champion: { label: "Champion", icon: "👑", color: "text-amber-400", bgColor: "bg-amber-500/10" },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateOpponents(playerElo: number, count: number = 8): ArenaFighter[] {
  const rand = seededRandom(Date.now());
  return Array.from({ length: count }, (_, i) => {
    const eloVariance = (rand() - 0.5) * 600;
    const elo = Math.max(400, Math.round(playerElo + eloVariance));
    const winRate = 40 + rand() * 30;
    const totalGames = Math.floor(20 + rand() * 200);
    const wins = Math.floor(totalGames * (winRate / 100));
    return {
      id: `opp-${i}`,
      name: ARENA_NAMES[Math.floor(rand() * ARENA_NAMES.length)],
      strategyName: STRATEGY_NAMES[Math.floor(rand() * STRATEGY_NAMES.length)],
      winRate,
      elo,
      rank: computeRank(elo),
      avatar: ARENA_AVATARS[Math.floor(rand() * ARENA_AVATARS.length)],
      wins,
      losses: totalGames - wins,
      streak: Math.floor(rand() * 8),
    };
  }).sort((a, b) => b.elo - a.elo);
}

const MARKET_CONDITIONS: ArenaBattleRound["marketCondition"][] = [
  "bull", "bear", "chop", "crash", "moon",
];

export function simulateBattle(
  player: ArenaFighter,
  opponent: ArenaFighter,
  wager: number
): ArenaBattle {
  const rand = seededRandom(Date.now());
  const rounds: ArenaBattleRound[] = [];
  let playerScore = 0;
  let opponentScore = 0;

  for (let i = 0; i < 5; i++) {
    const condition = MARKET_CONDITIONS[Math.floor(rand() * MARKET_CONDITIONS.length)];
    const playerSkill = (player.winRate / 100) * 0.7 + rand() * 0.3;
    const opponentSkill = (opponent.winRate / 100) * 0.7 + rand() * 0.3;

    const baseReturn = condition === "moon" ? 5 : condition === "bull" ? 3 : condition === "crash" ? -3 : condition === "bear" ? -1 : 0.5;
    const playerReturn = +(baseReturn * playerSkill * (1 + rand())).toFixed(2);
    const opponentReturn = +(baseReturn * opponentSkill * (1 + rand())).toFixed(2);

    const winner = playerReturn > opponentReturn ? "player" : playerReturn < opponentReturn ? "opponent" : "draw";
    if (winner === "player") playerScore++;
    if (winner === "opponent") opponentScore++;

    rounds.push({ round: i + 1, playerReturn, opponentReturn, marketCondition: condition, winner });
  }

  const winner = playerScore > opponentScore ? "player" : playerScore < opponentScore ? "opponent" : "draw";
  const eloDiff = opponent.elo - player.elo;
  const expected = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const actual = winner === "player" ? 1 : winner === "draw" ? 0.5 : 0;
  const eloChange = Math.round(32 * (actual - expected));

  return {
    id: `battle-${Date.now()}`,
    player,
    opponent,
    rounds,
    winner,
    wager,
    eloChange,
    timestamp: new Date().toISOString(),
  };
}

/* ── Treasure Maps ───────────────────────────────────────────────── */

const MAP_TEMPLATES: Array<{
  name: string;
  rarity: Rarity;
  icon: string;
  description: string;
  waypointCount: number;
  baseReward: number;
}> = [
  { name: "Goblin's First Haul", rarity: "common", icon: "🗺️", description: "A simple map for aspiring treasure hunters.", waypointCount: 3, baseReward: 50 },
  { name: "Merchant's Route", rarity: "uncommon", icon: "📜", description: "Follow the old trade routes to find hidden caches.", waypointCount: 4, baseReward: 150 },
  { name: "Dragon's Trail", rarity: "rare", icon: "🐉", description: "A dangerous path leading to a dragon's hoard.", waypointCount: 5, baseReward: 500 },
  { name: "Void Labyrinth", rarity: "epic", icon: "🌀", description: "Navigate the twisting corridors of the Void.", waypointCount: 6, baseReward: 1500 },
  { name: "King's Treasure", rarity: "legendary", icon: "👑", description: "The legendary treasure of the Goblin King himself.", waypointCount: 7, baseReward: 5000 },
];

const CHALLENGE_TEMPLATES: Array<{
  type: TreasureWaypoint["challenge"]["type"];
  name: string;
  icon: string;
  unit: string;
  targets: Record<Rarity, number>;
}> = [
  { type: "profit_target", name: "Profit Gate", icon: "💰", unit: "$", targets: { common: 10, uncommon: 50, rare: 100, epic: 500, legendary: 1000 } },
  { type: "win_streak", name: "Win Streak Trial", icon: "🔥", unit: "wins", targets: { common: 2, uncommon: 3, rare: 4, epic: 5, legendary: 7 } },
  { type: "trade_count", name: "Trade Marathon", icon: "⚔️", unit: "trades", targets: { common: 3, uncommon: 5, rare: 10, epic: 15, legendary: 25 } },
  { type: "hold_duration", name: "Diamond Hands Trial", icon: "💎", unit: "hours", targets: { common: 1, uncommon: 4, rare: 12, epic: 24, legendary: 48 } },
  { type: "low_drawdown", name: "Shield Wall", icon: "🛡️", unit: "% max DD", targets: { common: 10, uncommon: 7, rare: 5, epic: 3, legendary: 1 } },
  { type: "high_sharpe", name: "Precision Strike", icon: "🎯", unit: "Sharpe", targets: { common: 0.5, uncommon: 1, rare: 1.5, epic: 2, legendary: 3 } },
];

export function generateTreasureMaps(trades: Trade[]): TreasureMap[] {
  const rand = seededRandom(trades.length * 31 + 42);

  return MAP_TEMPLATES.map((template, mapIdx) => {
    const waypoints: TreasureWaypoint[] = Array.from(
      { length: template.waypointCount },
      (_, i) => {
        const challengeTemplate = CHALLENGE_TEMPLATES[Math.floor(rand() * CHALLENGE_TEMPLATES.length)];
        const target = challengeTemplate.targets[template.rarity];

        let current = 0;
        if (challengeTemplate.type === "trade_count") current = Math.min(target, trades.length);
        if (challengeTemplate.type === "profit_target") current = Math.min(target, Math.max(0, trades.reduce((s, t) => s + t.realized_pnl, 0)));
        if (challengeTemplate.type === "win_streak") current = Math.min(target, Math.floor(rand() * (target + 1)));

        return {
          id: `wp-${mapIdx}-${i}`,
          name: `${challengeTemplate.name} ${i + 1}`,
          description: `${challengeTemplate.name}: Reach ${target} ${challengeTemplate.unit}`,
          icon: challengeTemplate.icon,
          challenge: {
            type: challengeTemplate.type,
            target,
            current,
            unit: challengeTemplate.unit,
            description: `Reach ${target} ${challengeTemplate.unit}`,
          },
          isCompleted: current >= target,
          reward: { gbln: Math.round(template.baseReward / template.waypointCount), xp: 50 * (i + 1) },
        };
      }
    );

    const completedCount = waypoints.filter((w) => w.isCompleted).length;

    return {
      id: `map-${mapIdx}`,
      name: template.name,
      rarity: template.rarity,
      description: template.description,
      icon: template.icon,
      waypoints,
      reward: { gbln: template.baseReward, xp: template.baseReward * 2 },
      expiresAt: new Date(Date.now() + (mapIdx + 1) * 86400000 * 3).toISOString(),
      isCompleted: completedCount === waypoints.length,
      currentWaypoint: Math.min(completedCount, waypoints.length - 1),
    };
  });
}

/* ── Guilds ────────────────────────────────────────────────────────── */

const GUILD_PERKS: GuildPerk[] = [
  { id: "gbln-boost", name: "GBLN Boost", description: "+10% GBLN from all sources per level", icon: "💰", level: 0, maxLevel: 5, cost: 500, effect: "+10% GBLN" },
  { id: "xp-boost", name: "XP Boost", description: "+5% XP from all sources per level", icon: "⭐", level: 0, maxLevel: 5, cost: 300, effect: "+5% XP" },
  { id: "quest-slots", name: "Extra Quests", description: "+1 daily quest slot per level", icon: "📋", level: 0, maxLevel: 3, cost: 1000, effect: "+1 quest slot" },
  { id: "chest-luck", name: "Chest Luck", description: "+5% rare drop chance per level", icon: "🍀", level: 0, maxLevel: 5, cost: 800, effect: "+5% luck" },
  { id: "arena-shield", name: "Arena Shield", description: "Reduce ELO loss by 10% per level", icon: "🛡️", level: 0, maxLevel: 3, cost: 1200, effect: "-10% ELO loss" },
];

export function generateGuilds(): Guild[] {
  return [
    {
      id: "guild-1",
      name: "Diamond Degens",
      tag: "DDG",
      icon: "💎",
      level: 12,
      members: generateGuildMembers(18),
      maxMembers: 25,
      treasury: 45000,
      totalWinRate: 62.4,
      weeklyXP: 125000,
      perks: GUILD_PERKS.map((p) => ({ ...p, level: Math.min(p.maxLevel, Math.floor(Math.random() * (p.maxLevel + 1))) })),
      description: "Elite traders united. We never sell the bottom.",
      isRecruiting: true,
      minLevel: 10,
    },
    {
      id: "guild-2",
      name: "Goblin Horde",
      tag: "GBH",
      icon: "🧌",
      level: 8,
      members: generateGuildMembers(12),
      maxMembers: 20,
      treasury: 22000,
      totalWinRate: 58.1,
      weeklyXP: 78000,
      perks: GUILD_PERKS.map((p) => ({ ...p, level: Math.min(p.maxLevel, Math.floor(Math.random() * p.maxLevel)) })),
      description: "The original goblin gang. Strength in numbers.",
      isRecruiting: true,
      minLevel: 5,
    },
    {
      id: "guild-3",
      name: "Moon Syndicate",
      tag: "MNS",
      icon: "🌙",
      level: 15,
      members: generateGuildMembers(24),
      maxMembers: 25,
      treasury: 89000,
      totalWinRate: 67.8,
      weeklyXP: 210000,
      perks: GUILD_PERKS.map((p) => ({ ...p, level: p.maxLevel })),
      description: "We don't just see the moon — we trade on it.",
      isRecruiting: false,
      minLevel: 20,
    },
    {
      id: "guild-4",
      name: "Whale Watchers",
      tag: "WHL",
      icon: "🐋",
      level: 6,
      members: generateGuildMembers(8),
      maxMembers: 15,
      treasury: 12000,
      totalWinRate: 55.3,
      weeklyXP: 42000,
      perks: GUILD_PERKS.map((p) => ({ ...p, level: Math.min(p.maxLevel, 1) })),
      description: "Follow the whales, find the profits.",
      isRecruiting: true,
      minLevel: 1,
    },
  ];
}

function generateGuildMembers(count: number): GuildMember[] {
  const rand = seededRandom(count * 17);
  return Array.from({ length: count }, (_, i) => ({
    id: `member-${i}`,
    name: ARENA_NAMES[Math.floor(rand() * ARENA_NAMES.length)],
    role: (i === 0 ? "leader" : i < 3 ? "officer" : "member") as GuildMember["role"],
    level: Math.floor(5 + rand() * 40),
    contribution: Math.floor(rand() * 10000),
    joinedAt: new Date(Date.now() - rand() * 90 * 86400000).toISOString(),
    isOnline: rand() > 0.6,
    avatar: ARENA_AVATARS[Math.floor(rand() * ARENA_AVATARS.length)],
  }));
}

/* ── Prophecies ─────────────────────────────────────────────────── */

export function generateProphecies(): Prophecy[] {
  const symbols = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"];
  const basePrices: Record<string, number> = { BTC: 68000, ETH: 3500, SOL: 180, BNB: 600, XRP: 0.62, DOGE: 0.15 };

  return symbols.flatMap((symbol, i) => {
    const base = basePrices[symbol];
    return [
      {
        id: `prophecy-${symbol}-up`,
        question: `Will ${symbol} reach $${(base * 1.1).toLocaleString()} within 7 days?`,
        symbol,
        targetPrice: base * 1.1,
        currentPrice: base,
        direction: "above" as const,
        deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        totalPool: 5000 + i * 2000,
        yesPool: 3000 + i * 1000,
        noPool: 2000 + i * 1000,
        status: "active" as const,
        author: ARENA_NAMES[i],
        category: "price" as const,
      },
      {
        id: `prophecy-${symbol}-down`,
        question: `Will ${symbol} drop below $${(base * 0.9).toLocaleString()} within 3 days?`,
        symbol,
        targetPrice: base * 0.9,
        currentPrice: base,
        direction: "below" as const,
        deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
        totalPool: 3000 + i * 1500,
        yesPool: 1200 + i * 500,
        noPool: 1800 + i * 1000,
        status: "active" as const,
        author: ARENA_NAMES[i + 6],
        category: "price" as const,
      },
    ];
  });
}

/* ── Skins ─────────────────────────────────────────────────────── */

export function generateSkins(): DashboardSkin[] {
  return [
    { id: "skin-neon", name: "Neon Cyberpunk", description: "Electric neon accents on dark steel", preview: "🌃", rarity: "rare", cost: 300, category: "theme", isOwned: false, isEquipped: false },
    { id: "skin-gold", name: "Golden Throne", description: "Luxurious gold and deep burgundy", preview: "👑", rarity: "legendary", cost: 5000, category: "theme", isOwned: false, isEquipped: false },
    { id: "skin-ice", name: "Frozen Tundra", description: "Cool ice blue with crystalline effects", preview: "❄️", rarity: "epic", cost: 1000, category: "theme", isOwned: false, isEquipped: false },
    { id: "skin-blood", name: "Blood Moon", description: "Deep crimson with lunar accents", preview: "🌑", rarity: "epic", cost: 1200, category: "theme", isOwned: false, isEquipped: false },
    { id: "skin-matrix", name: "Matrix Rain", description: "Green rain falling across all panels", preview: "💚", rarity: "rare", cost: 500, category: "theme", isOwned: false, isEquipped: false },
    { id: "chart-candle", name: "Candlelight Charts", description: "Warm amber and cream chart colors", preview: "🕯️", rarity: "uncommon", cost: 100, category: "chart", isOwned: false, isEquipped: false },
    { id: "chart-ocean", name: "Ocean Depth Charts", description: "Deep sea blue gradient charts", preview: "🌊", rarity: "uncommon", cost: 100, category: "chart", isOwned: false, isEquipped: false },
    { id: "chart-fire", name: "Inferno Charts", description: "Red-orange fire gradient charts", preview: "🔥", rarity: "rare", cost: 250, category: "chart", isOwned: false, isEquipped: false },
    { id: "cursor-sword", name: "Sword Cursor", description: "Your cursor becomes a tiny goblin sword", preview: "⚔️", rarity: "rare", cost: 200, category: "cursor", isOwned: false, isEquipped: false },
    { id: "cursor-wand", name: "Magic Wand Cursor", description: "Trail sparkles wherever you point", preview: "🪄", rarity: "epic", cost: 800, category: "cursor", isOwned: false, isEquipped: false },
    { id: "sound-medieval", name: "Medieval Pack", description: "Trumpet fanfares and coin jingles", preview: "🎺", rarity: "uncommon", cost: 150, category: "sound", isOwned: false, isEquipped: false },
    { id: "sound-retro", name: "Retro Arcade", description: "8-bit sound effects for trades", preview: "🕹️", rarity: "rare", cost: 300, category: "sound", isOwned: false, isEquipped: false },
    { id: "frame-dragon", name: "Dragon Frame", description: "Fiery dragon border for your profile", preview: "🐉", rarity: "epic", cost: 600, category: "frame", isOwned: false, isEquipped: false },
    { id: "frame-crown", name: "Royal Frame", description: "Ornate gold crown border", preview: "👑", rarity: "legendary", cost: 2000, category: "frame", isOwned: false, isEquipped: false },
  ];
}

/* ── Mystery Chests ──────────────────────────────────────────────── */

export const CHEST_TIERS: MysteryChest[] = [
  {
    id: "chest-wooden",
    tier: "wooden",
    cost: 25,
    icon: "📦",
    glowColor: "rgba(139,90,43,0.4)",
    openAnimation: "shake",
    possibleRewards: [
      { type: "gbln", name: "GBLN Coins", value: 10, rarity: "common", icon: "💰" },
      { type: "gbln", name: "GBLN Coins", value: 25, rarity: "uncommon", icon: "💰" },
      { type: "xp", name: "XP Boost", value: 50, rarity: "common", icon: "⭐" },
      { type: "cosmetic", name: "Random Cosmetic", value: 1, rarity: "common", icon: "🎨" },
    ],
  },
  {
    id: "chest-iron",
    tier: "iron",
    cost: 100,
    icon: "🗃️",
    glowColor: "rgba(148,163,184,0.4)",
    openAnimation: "glow",
    possibleRewards: [
      { type: "gbln", name: "GBLN Coins", value: 50, rarity: "uncommon", icon: "💰" },
      { type: "gbln", name: "GBLN Coins", value: 100, rarity: "rare", icon: "💰" },
      { type: "xp", name: "XP Boost", value: 200, rarity: "uncommon", icon: "⭐" },
      { type: "enchantment", name: "Random Enchantment", value: 1, rarity: "uncommon", icon: "✨" },
      { type: "cosmetic", name: "Rare Cosmetic", value: 1, rarity: "rare", icon: "🎨" },
    ],
  },
  {
    id: "chest-gold",
    tier: "gold",
    cost: 500,
    icon: "💰",
    glowColor: "rgba(251,191,36,0.5)",
    openAnimation: "explode",
    possibleRewards: [
      { type: "gbln", name: "GBLN Coins", value: 200, rarity: "rare", icon: "💰" },
      { type: "gbln", name: "GBLN Coins", value: 500, rarity: "epic", icon: "💰" },
      { type: "enchantment", name: "Epic Enchantment", value: 1, rarity: "epic", icon: "✨" },
      { type: "strategy", name: "Strategy Artifact", value: 1, rarity: "rare", icon: "⚔️" },
      { type: "chest", name: "Diamond Chest", value: 1, rarity: "epic", icon: "💎" },
    ],
  },
  {
    id: "chest-diamond",
    tier: "diamond",
    cost: 2000,
    icon: "💎",
    glowColor: "rgba(96,165,250,0.6)",
    openAnimation: "shatter",
    possibleRewards: [
      { type: "gbln", name: "GBLN Coins", value: 1000, rarity: "epic", icon: "💰" },
      { type: "gbln", name: "GBLN Coins", value: 2500, rarity: "legendary", icon: "💰" },
      { type: "enchantment", name: "Legendary Enchantment", value: 1, rarity: "legendary", icon: "✨" },
      { type: "strategy", name: "Epic Strategy", value: 1, rarity: "epic", icon: "⚔️" },
      { type: "cosmetic", name: "Legendary Cosmetic", value: 1, rarity: "legendary", icon: "🎨" },
    ],
  },
  {
    id: "chest-legendary",
    tier: "legendary",
    cost: 10000,
    icon: "🏆",
    glowColor: "rgba(251,191,36,0.8)",
    openAnimation: "supernova",
    possibleRewards: [
      { type: "gbln", name: "GBLN Jackpot", value: 5000, rarity: "legendary", icon: "💰" },
      { type: "strategy", name: "Legendary Strategy", value: 1, rarity: "legendary", icon: "⚔️" },
      { type: "enchantment", name: "Mythic Enchantment", value: 1, rarity: "legendary", icon: "✨" },
      { type: "cosmetic", name: "Exclusive Cosmetic", value: 1, rarity: "legendary", icon: "👑" },
    ],
  },
];

export function openChest(chest: MysteryChest): ChestReward {
  const roll = Math.random();
  const rewards = chest.possibleRewards;
  // Higher roll = rarer reward
  const rarityWeights: Record<Rarity, number> = { common: 0.4, uncommon: 0.3, rare: 0.18, epic: 0.09, legendary: 0.03 };
  let cumulative = 0;
  for (const reward of rewards) {
    cumulative += rarityWeights[reward.rarity] || 0.2;
    if (roll <= cumulative / rewards.length || reward === rewards[rewards.length - 1]) {
      return reward;
    }
  }
  return rewards[0];
}

/* ── Battle Pass ─────────────────────────────────────────────────── */

export function generateBattlePass(): BattlePassSeason {
  const tiers: BattlePassTier[] = Array.from({ length: 30 }, (_, i) => {
    const level = i + 1;
    const xpRequired = level * 200;
    const freeReward = level % 3 === 0
      ? { type: "gbln", name: `${level * 10} GBLN`, icon: "💰", value: level * 10 }
      : level % 5 === 0
      ? { type: "xp", name: `${level * 50} XP`, icon: "⭐", value: level * 50 }
      : undefined;

    const premiumReward = {
      type: level % 10 === 0 ? "cosmetic" : level % 7 === 0 ? "enchantment" : level % 4 === 0 ? "chest" : "gbln",
      name: level === 30 ? "Legendary Season Skin" : level === 20 ? "Epic Enchantment" : `${level * 25} GBLN`,
      icon: level === 30 ? "👑" : level === 20 ? "✨" : level % 7 === 0 ? "✨" : "💰",
      value: level * 25,
      rarity: (level >= 25 ? "legendary" : level >= 15 ? "epic" : level >= 8 ? "rare" : "uncommon") as Rarity,
    };

    return { level, xpRequired, freeReward, premiumReward, isClaimed: false };
  });

  return {
    id: "season-1",
    name: "Season of the Goblin King",
    number: 1,
    theme: "goblin_king",
    icon: "👑",
    startDate: new Date(Date.now() - 15 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 75 * 86400000).toISOString(),
    tiers,
    currentXP: 0,
    isPremium: false,
    premiumCost: 5000,
  };
}

/* ── Activity Feed ───────────────────────────────────────────────── */

const ACTIVITY_TEMPLATES: Array<{
  type: ActivityFeedItem["type"];
  messages: string[];
  icons: string[];
  rarities: Rarity[];
}> = [
  {
    type: "purchase",
    messages: ["acquired a {rarity} strategy!", "bought an enchantment!", "purchased a skin!"],
    icons: ["⚔️", "✨", "🎨"],
    rarities: ["common", "uncommon", "rare", "epic", "legendary"],
  },
  {
    type: "craft",
    messages: ["brewed a {rarity} potion!", "crafted a new indicator!"],
    icons: ["⚗️", "🧪"],
    rarities: ["uncommon", "rare", "epic"],
  },
  {
    type: "achievement",
    messages: ["unlocked '{name}'!", "earned a new badge!"],
    icons: ["🏆", "🎖️"],
    rarities: ["rare", "epic", "legendary"],
  },
  {
    type: "battle",
    messages: ["won an Arena battle!", "defeated {opponent}!", "reached {rank} rank!"],
    icons: ["⚔️", "🏅", "💎"],
    rarities: ["uncommon", "rare", "epic"],
  },
  {
    type: "chest",
    messages: ["opened a {tier} chest!", "found a legendary item!", "hit the jackpot!"],
    icons: ["📦", "💎", "🏆"],
    rarities: ["common", "rare", "epic", "legendary"],
  },
  {
    type: "prophecy",
    messages: ["predicted correctly!", "won a prophecy bet!", "became a top prophet!"],
    icons: ["🔮", "📈", "🏅"],
    rarities: ["uncommon", "rare", "epic"],
  },
];

export function generateActivityFeed(count: number = 20): ActivityFeedItem[] {
  const rand = seededRandom(Date.now());
  return Array.from({ length: count }, (_, i) => {
    const template = ACTIVITY_TEMPLATES[Math.floor(rand() * ACTIVITY_TEMPLATES.length)];
    const message = template.messages[Math.floor(rand() * template.messages.length)];
    const rarity = template.rarities[Math.floor(rand() * template.rarities.length)];
    return {
      id: `activity-${i}`,
      type: template.type,
      playerName: ARENA_NAMES[Math.floor(rand() * ARENA_NAMES.length)],
      message: message.replace("{rarity}", rarity).replace("{tier}", "gold"),
      icon: template.icons[Math.floor(rand() * template.icons.length)],
      rarity,
      timestamp: new Date(Date.now() - i * 30000 - rand() * 60000).toISOString(),
    };
  });
}

/* ── Wheel of Fortune ────────────────────────────────────────────── */

export interface WheelSegment {
  label: string;
  icon: string;
  value: number;
  type: "gbln" | "xp" | "chest" | "enchantment" | "nothing";
  color: string;
  probability: number;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: "5 GBLN", icon: "💰", value: 5, type: "gbln", color: "#6b7280", probability: 0.25 },
  { label: "10 GBLN", icon: "💰", value: 10, type: "gbln", color: "#22c55e", probability: 0.20 },
  { label: "25 GBLN", icon: "💰", value: 25, type: "gbln", color: "#3b82f6", probability: 0.15 },
  { label: "50 GBLN", icon: "💰", value: 50, type: "gbln", color: "#a855f7", probability: 0.10 },
  { label: "100 XP", icon: "⭐", value: 100, type: "xp", color: "#eab308", probability: 0.12 },
  { label: "Wooden Chest", icon: "📦", value: 1, type: "chest", color: "#92400e", probability: 0.08 },
  { label: "Iron Chest", icon: "🗃️", value: 1, type: "chest", color: "#64748b", probability: 0.05 },
  { label: "Nothing", icon: "💨", value: 0, type: "nothing", color: "#1f2937", probability: 0.03 },
  { label: "500 GBLN!", icon: "🤑", value: 500, type: "gbln", color: "#f59e0b", probability: 0.02 },
];

export function spinWheel(): WheelSegment {
  const roll = Math.random();
  let cumulative = 0;
  for (const segment of WHEEL_SEGMENTS) {
    cumulative += segment.probability;
    if (roll <= cumulative) return segment;
  }
  return WHEEL_SEGMENTS[0];
}
