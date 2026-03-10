"use client";

import type { Achievement, Quest, PlayerProfile } from "@/types/shop";
import { useGoblinShopStore } from "../GoblinShopStore";
import AchievementBadge from "../cards/AchievementBadge";
import QuestCard from "../cards/QuestCard";
import GBLNIcon from "../shared/GBLNIcon";

interface HallOfChampionsProps {
  achievements: Achievement[];
  quests: Quest[];
  playerProfile: PlayerProfile;
}

const NPC_NAMES = [
  { name: "Grimbold the Wise", icon: "🧙" },
  { name: "Snagtooth", icon: "⚔️" },
  { name: "Wort the Cunning", icon: "🧪" },
  { name: "Goldclaw", icon: "💰" },
  { name: "Thornwick", icon: "🌿" },
  { name: "Bogrot", icon: "🍄" },
  { name: "Skulk the Shadow", icon: "🌑" },
  { name: "Ironfist", icon: "🔨" },
  { name: "Mossbelly", icon: "🐸" },
];

function generateLeaderboard(profile: PlayerProfile) {
  const entries = [
    {
      rank: 1,
      name: profile.goblinsName,
      icon: "👑",
      level: profile.level,
      gbln: profile.gbln_balance,
      achievements: profile.achievementsUnlocked,
      isUser: true,
    },
  ];

  for (let i = 0; i < 9; i++) {
    const npc = NPC_NAMES[i];
    const factor = (9 - i) / 10;
    entries.push({
      rank: i + 2,
      name: npc.name,
      icon: npc.icon,
      level: Math.max(1, Math.floor(profile.level * factor)),
      gbln: Math.max(0, Math.floor(profile.gbln_balance * factor * 0.9)),
      achievements: Math.max(0, Math.floor(profile.achievementsUnlocked * factor)),
      isUser: false,
    });
  }

  return entries;
}

export default function HallOfChampions({ achievements, quests, playerProfile }: HallOfChampionsProps) {
  const { claimedQuests, claimQuest } = useGoblinShopStore();
  const leaderboard = generateLeaderboard(playerProfile);

  return (
    <div className="p-4 space-y-8">
      {/* Achievement Trophy Wall */}
      <section>
        <h2 className="text-xl font-bold text-white mb-1">Achievement Trophy Wall</h2>
        <p className="text-sm text-gray-500 mb-4">
          {achievements.filter((a) => a.isUnlocked).length}/{achievements.length} unlocked
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {achievements.map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
        </div>
      </section>

      {/* Active Quests */}
      <section>
        <h2 className="text-xl font-bold text-white mb-1">Active Quests</h2>
        <p className="text-sm text-gray-500 mb-4">Complete quests to earn GBLN and XP</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quests.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              isClaimed={claimedQuests.includes(q.id)}
              onClaim={claimQuest}
            />
          ))}
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <h2 className="text-xl font-bold text-white mb-1">Leaderboard</h2>
        <p className="text-sm text-gray-500 mb-4">Top traders of the Bazaar</p>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_60px_80px_80px] gap-2 px-3 py-2 bg-gray-800/50 text-[10px] text-gray-500 font-medium">
            <span>#</span>
            <span>Trader</span>
            <span className="text-center">Level</span>
            <span className="text-right">GBLN</span>
            <span className="text-right">Achievements</span>
          </div>
          {leaderboard.map((entry) => (
            <div
              key={entry.rank}
              className={`grid grid-cols-[48px_1fr_60px_80px_80px] gap-2 px-3 py-2.5 text-xs border-t border-gray-800/50 ${
                entry.isUser ? "bg-goblin-500/5" : ""
              }`}
            >
              <span className={`font-bold ${entry.rank <= 3 ? "text-gold-400" : "text-gray-500"}`}>
                #{entry.rank}
              </span>
              <span className="flex items-center gap-1.5 min-w-0">
                <span>{entry.icon}</span>
                <span className={`truncate ${entry.isUser ? "text-goblin-400 font-bold" : "text-gray-300"}`}>
                  {entry.isUser ? `You (${entry.name})` : entry.name}
                </span>
              </span>
              <span className="text-center text-gray-400">Lv.{entry.level}</span>
              <span className="text-right flex items-center justify-end gap-1">
                <GBLNIcon size={12} />
                <span className="text-gold-400">{entry.gbln.toLocaleString()}</span>
              </span>
              <span className="text-right text-gray-400">🏆 {entry.achievements}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
