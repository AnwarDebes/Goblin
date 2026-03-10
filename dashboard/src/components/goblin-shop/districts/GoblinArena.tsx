"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  generateOpponents,
  simulateBattle,
  RANK_CONFIG,
  computeRank,
} from "@/lib/arena-utils";
import type { ArenaFighter, ArenaBattle, ArenaBattleRound } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";
import RarityBadge from "../shared/RarityBadge";

interface GoblinArenaProps {
  playerWinRate: number;
  playerLevel: number;
  balance: number;
  onSpendGBLN: (amount: number) => void;
  onEarnGBLN: (amount: number) => void;
}

export default function GoblinArena({
  playerWinRate,
  playerLevel,
  balance,
  onSpendGBLN,
  onEarnGBLN,
}: GoblinArenaProps) {
  const [playerElo, setPlayerElo] = useState(1000 + playerLevel * 20);
  const [opponents, setOpponents] = useState<ArenaFighter[]>(() =>
    generateOpponents(playerElo)
  );
  const [selectedOpponent, setSelectedOpponent] = useState<ArenaFighter | null>(null);
  const [wager, setWager] = useState(50);
  const [isBattling, setIsBattling] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [activeBattle, setActiveBattle] = useState<ArenaBattle | null>(null);
  const [battleHistory, setBattleHistory] = useState<ArenaBattle[]>([]);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [tab, setTab] = useState<"fight" | "leaderboard" | "history">("fight");

  const playerFighter: ArenaFighter = {
    id: "player",
    name: "You",
    strategyName: "Your Strategy",
    winRate: playerWinRate,
    elo: playerElo,
    rank: computeRank(playerElo),
    avatar: "🧌",
    wins,
    losses,
    streak,
    isPlayer: true,
  };

  const playerRank = RANK_CONFIG[playerFighter.rank];

  const handleStartBattle = useCallback(() => {
    if (!selectedOpponent || balance < wager) return;
    onSpendGBLN(wager);
    setIsBattling(true);
    setCurrentRound(0);

    const battle = simulateBattle(playerFighter, selectedOpponent, wager);
    setActiveBattle(battle);

    // Animate rounds
    let round = 0;
    const interval = setInterval(() => {
      round++;
      setCurrentRound(round);
      if (round >= 5) {
        clearInterval(interval);
        setTimeout(() => {
          setIsBattling(false);
          setBattleHistory((prev) => [battle, ...prev].slice(0, 20));
          setPlayerElo((prev) => prev + battle.eloChange);

          if (battle.winner === "player") {
            setWins((w) => w + 1);
            setStreak((s) => s + 1);
            onEarnGBLN(wager * 2);
          } else {
            setLosses((l) => l + 1);
            setStreak(0);
          }

          setOpponents(generateOpponents(playerElo + battle.eloChange));
        }, 1500);
      }
    }, 800);
  }, [selectedOpponent, wager, balance, playerFighter, playerElo, onSpendGBLN, onEarnGBLN]);

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            ⚔️ Goblin Arena
          </h2>
          <p className="text-xs text-gray-500">
            Pit your strategies against opponents. Wager GBLN. Rise in the ranks.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl")}>{playerRank.icon}</span>
            <div>
              <div className={cn("text-sm font-bold", playerRank.color)}>
                {playerRank.label}
              </div>
              <div className="text-[10px] text-gray-500">ELO: {playerElo}</div>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            <span className="text-green-400">{wins}W</span>{" "}
            <span className="text-red-400">{losses}L</span>{" "}
            {streak > 0 && (
              <span className="text-amber-400">🔥{streak}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-1">
        {(["fight", "leaderboard", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-t font-medium transition-all",
              tab === t
                ? "text-goblin-400 border-b-2 border-goblin-400"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            {t === "fight" ? "⚔️ Fight" : t === "leaderboard" ? "🏆 Leaderboard" : "📜 History"}
          </button>
        ))}
      </div>

      {/* Battle In Progress */}
      {isBattling && activeBattle && (
        <BattleAnimation
          battle={activeBattle}
          currentRound={currentRound}
          player={playerFighter}
          opponent={selectedOpponent!}
        />
      )}

      {/* Fight Tab */}
      {tab === "fight" && !isBattling && (
        <div className="space-y-4">
          {/* Wager Selector */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-800/50">
            <span className="text-xs text-gray-400">Wager:</span>
            {[25, 50, 100, 250, 500].map((amount) => (
              <button
                key={amount}
                onClick={() => setWager(amount)}
                className={cn(
                  "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-all",
                  wager === amount
                    ? "bg-goblin-500/20 text-goblin-400 border border-goblin-500/30"
                    : "bg-gray-800/50 text-gray-500 border border-transparent hover:text-gray-300",
                  balance < amount && "opacity-40 cursor-not-allowed"
                )}
                disabled={balance < amount}
              >
                <GBLNIcon size={10} /> {amount}
              </button>
            ))}
          </div>

          {/* Opponent Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {opponents.map((opp) => {
              const rankConfig = RANK_CONFIG[opp.rank];
              const isSelected = selectedOpponent?.id === opp.id;
              const eloDiff = opp.elo - playerElo;
              const difficulty =
                eloDiff > 200 ? "Hard" : eloDiff > 0 ? "Medium" : eloDiff > -200 ? "Easy" : "Weak";
              const diffColor =
                difficulty === "Hard"
                  ? "text-red-400"
                  : difficulty === "Medium"
                  ? "text-yellow-400"
                  : "text-green-400";

              return (
                <button
                  key={opp.id}
                  onClick={() => setSelectedOpponent(opp)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    isSelected
                      ? "bg-goblin-500/10 border-goblin-500/40 scale-[1.02]"
                      : "bg-gray-800/30 border-gray-800/50 hover:border-gray-700"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{opp.avatar}</span>
                    <div>
                      <div className="text-xs font-bold text-white">{opp.name}</div>
                      <div className="text-[10px] text-gray-500">{opp.strategyName}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={rankConfig.color}>
                      {rankConfig.icon} {rankConfig.label}
                    </span>
                    <span className={diffColor}>{difficulty}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span className="text-gray-500">ELO: {opp.elo}</span>
                    <span className="text-gray-500">WR: {opp.winRate.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span className="text-gray-500">
                      {opp.wins}W / {opp.losses}L
                    </span>
                    {opp.streak > 2 && (
                      <span className="text-amber-400">🔥{opp.streak}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fight Button */}
          {selectedOpponent && (
            <div className="flex justify-center">
              <button
                onClick={handleStartBattle}
                disabled={balance < wager}
                className={cn(
                  "px-8 py-3 rounded-xl font-bold text-sm transition-all",
                  balance >= wager
                    ? "bg-gradient-to-r from-red-600 to-amber-600 text-white hover:scale-105 shadow-lg shadow-red-500/20"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
                )}
              >
                ⚔️ BATTLE {selectedOpponent.name} for {wager} GBLN
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === "leaderboard" && (
        <div className="space-y-2">
          {[playerFighter, ...opponents]
            .sort((a, b) => b.elo - a.elo)
            .map((fighter, i) => {
              const rankConfig = RANK_CONFIG[fighter.rank];
              return (
                <div
                  key={fighter.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    fighter.isPlayer
                      ? "bg-goblin-500/10 border-goblin-500/30"
                      : "bg-gray-800/20 border-gray-800/50"
                  )}
                >
                  <span className="text-xs font-bold text-gray-500 w-6">#{i + 1}</span>
                  <span className="text-xl">{fighter.avatar}</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">
                      {fighter.name} {fighter.isPlayer && "(You)"}
                    </div>
                    <div className="text-[10px] text-gray-500">{fighter.strategyName}</div>
                  </div>
                  <span className={cn("text-xs font-medium", rankConfig.color)}>
                    {rankConfig.icon} {fighter.elo}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {fighter.winRate.toFixed(0)}% WR
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {battleHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              No battles yet. Choose an opponent and fight!
            </div>
          ) : (
            battleHistory.map((battle) => (
              <div
                key={battle.id}
                className={cn(
                  "p-3 rounded-lg border flex items-center gap-3",
                  battle.winner === "player"
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-red-500/5 border-red-500/20"
                )}
              >
                <span className="text-xl">
                  {battle.winner === "player" ? "🏆" : "💀"}
                </span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white">
                    vs {battle.opponent.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {battle.rounds.filter((r) => r.winner === "player").length} -{" "}
                    {battle.rounds.filter((r) => r.winner === "opponent").length}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      "text-xs font-bold",
                      battle.winner === "player" ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {battle.winner === "player" ? `+${battle.wager}` : `-${battle.wager}`} GBLN
                  </div>
                  <div
                    className={cn(
                      "text-[10px]",
                      battle.eloChange >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {battle.eloChange >= 0 ? "+" : ""}
                    {battle.eloChange} ELO
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Battle Animation ────────────────────────────────────────────── */

function BattleAnimation({
  battle,
  currentRound,
  player,
  opponent,
}: {
  battle: ArenaBattle;
  currentRound: number;
  player: ArenaFighter;
  opponent: ArenaFighter;
}) {
  const visibleRounds = battle.rounds.slice(0, currentRound);
  const playerScore = visibleRounds.filter((r) => r.winner === "player").length;
  const opponentScore = visibleRounds.filter((r) => r.winner === "opponent").length;
  const isFinished = currentRound >= 5;

  const CONDITION_ICONS: Record<string, string> = {
    bull: "📈",
    bear: "📉",
    chop: "〰️",
    crash: "💥",
    moon: "🚀",
  };

  return (
    <div className="p-6 rounded-xl bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 relative overflow-hidden">
      {/* Versus Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl animate-bounce">{player.avatar}</span>
          <div>
            <div className="text-sm font-bold text-white">{player.name}</div>
            <div className="text-[10px] text-gray-500">ELO: {player.elo}</div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-black text-white">
            {playerScore} - {opponentScore}
          </div>
          <div className="text-[10px] text-gray-500">
            {isFinished ? "FINAL" : `Round ${currentRound}/5`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-white">{opponent.name}</div>
            <div className="text-[10px] text-gray-500">ELO: {opponent.elo}</div>
          </div>
          <span className="text-3xl animate-bounce" style={{ animationDelay: "0.2s" }}>
            {opponent.avatar}
          </span>
        </div>
      </div>

      {/* Round Results */}
      <div className="space-y-2">
        {visibleRounds.map((round, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-all animate-fade-in",
              round.winner === "player"
                ? "bg-green-500/10 border border-green-500/20"
                : round.winner === "opponent"
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-gray-800/30 border border-gray-700/30"
            )}
          >
            <span className="text-xs text-gray-500 w-8">R{round.round}</span>
            <span>{CONDITION_ICONS[round.marketCondition]}</span>
            <div className="flex-1 flex items-center justify-between">
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  round.playerReturn >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {round.playerReturn >= 0 ? "+" : ""}
                {round.playerReturn}%
              </span>
              <span className="text-[10px] text-gray-600">vs</span>
              <span
                className={cn(
                  "text-xs font-mono font-bold",
                  round.opponentReturn >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {round.opponentReturn >= 0 ? "+" : ""}
                {round.opponentReturn}%
              </span>
            </div>
            <span className="text-xs">
              {round.winner === "player" ? "✅" : round.winner === "opponent" ? "❌" : "➖"}
            </span>
          </div>
        ))}
      </div>

      {/* Final Result */}
      {isFinished && (
        <div
          className={cn(
            "mt-4 p-4 rounded-xl text-center animate-fade-in",
            battle.winner === "player"
              ? "bg-gradient-to-r from-green-500/20 to-goblin-500/20 border border-green-500/30"
              : "bg-gradient-to-r from-red-500/20 to-gray-800 border border-red-500/30"
          )}
        >
          <div className="text-2xl mb-1">
            {battle.winner === "player" ? "🏆 VICTORY!" : "💀 DEFEAT"}
          </div>
          <div className="text-sm text-gray-300">
            {battle.winner === "player"
              ? `+${battle.wager * 2} GBLN | +${battle.eloChange} ELO`
              : `${battle.eloChange} ELO`}
          </div>
        </div>
      )}
    </div>
  );
}
