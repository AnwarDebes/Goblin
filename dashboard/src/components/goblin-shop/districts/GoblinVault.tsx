"use client";

import type { StakingPool, GovernanceProposal } from "@/types/shop";
import { useGoblinShopStore } from "../GoblinShopStore";
import PriceTag from "../shared/PriceTag";
import { cn } from "@/lib/utils";

const STAKING_POOLS: StakingPool[] = [
  { id: "bronze", name: "Bronze Pool", description: "Flexible staking", apy: 5.2, lockPeriod: "flexible", totalStaked: 45230, minStake: 10, icon: "🥉", tier: "bronze" },
  { id: "silver", name: "Silver Pool", description: "30-day lock period", apy: 12, lockPeriod: "30d", totalStaked: 128500, minStake: 50, icon: "🥈", tier: "silver" },
  { id: "gold", name: "Gold Pool", description: "90-day lock period", apy: 25, lockPeriod: "90d", totalStaked: 312000, minStake: 200, icon: "🥇", tier: "gold" },
  { id: "diamond", name: "Diamond Pool", description: "365-day lock period", apy: 50, lockPeriod: "365d", totalStaked: 890000, minStake: 1000, icon: "💎", tier: "diamond" },
];

const PROPOSALS: GovernanceProposal[] = [
  { id: "prop-1", title: "Add SOL Trading Pairs", description: "Enable Solana-based trading pairs on the platform for increased diversity.", author: "GoblinDAO", status: "active", votesFor: 1842, votesAgainst: 673, endsAt: new Date(Date.now() + 3 * 86400000).toISOString(), category: "feature" },
  { id: "prop-2", title: "Reduce Risk Threshold to 2%", description: "Lower the per-trade risk threshold from 3% to 2% for improved capital preservation.", author: "RiskCommittee", status: "active", votesFor: 956, votesAgainst: 1123, endsAt: new Date(Date.now() + 5 * 86400000).toISOString(), category: "parameter" },
  { id: "prop-3", title: "Allocate Treasury to AI Model Training", description: "Use 10% of treasury GBLN to fund next-generation AI model development.", author: "TechCouncil", status: "active", votesFor: 2341, votesAgainst: 412, endsAt: new Date(Date.now() + 7 * 86400000).toISOString(), category: "treasury" },
  { id: "prop-4", title: "Partner with MEXC for Deep Liquidity", description: "Establish a strategic partnership with MEXC exchange for improved execution.", author: "BizDev", status: "passed", votesFor: 3120, votesAgainst: 890, endsAt: new Date(Date.now() - 2 * 86400000).toISOString(), category: "partnership" },
];

const TIER_COLORS: Record<StakingPool["tier"], { border: string; text: string; bg: string }> = {
  bronze: { border: "border-orange-700/40", text: "text-orange-400", bg: "bg-orange-500/10" },
  silver: { border: "border-gray-400/40", text: "text-gray-300", bg: "bg-gray-400/10" },
  gold: { border: "border-gold-500/40", text: "text-gold-400", bg: "bg-gold-500/10" },
  diamond: { border: "border-cyan-400/40", text: "text-cyan-400", bg: "bg-cyan-400/10" },
};

const STATUS_STYLES: Record<GovernanceProposal["status"], { label: string; color: string }> = {
  active: { label: "🟢 Active", color: "text-green-400" },
  passed: { label: "✅ Passed", color: "text-blue-400" },
  rejected: { label: "❌ Rejected", color: "text-red-400" },
  pending: { label: "⏳ Pending", color: "text-yellow-400" },
};

export default function GoblinVault() {
  const { toggleStaking, setStakingPool, votes, vote } = useGoblinShopStore();

  return (
    <div className="p-4 space-y-8">
      {/* Staking Pools */}
      <section>
        <h2 className="text-xl font-bold text-white mb-1">Staking Pools</h2>
        <p className="text-sm text-gray-500 mb-4">Lock your GBLN to earn yield</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAKING_POOLS.map((pool) => {
            const colors = TIER_COLORS[pool.tier];
            return (
              <div
                key={pool.id}
                className={cn(
                  "rounded-lg border p-4 bg-gray-900 transition-all hover:scale-[1.02]",
                  colors.border,
                  pool.tier === "diamond" && "shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                )}
              >
                <div className="text-center mb-3">
                  <span className="text-3xl">{pool.icon}</span>
                  <h3 className={cn("text-sm font-bold mt-1", colors.text)}>{pool.name}</h3>
                  <p className="text-[10px] text-gray-500">{pool.description}</p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">APY</span>
                    <span className={cn("font-bold", colors.text)}>{pool.apy}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lock</span>
                    <span className="text-gray-300">{pool.lockPeriod === "flexible" ? "Flexible" : pool.lockPeriod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min</span>
                    <PriceTag price={pool.minStake} size="sm" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Staked</span>
                    <PriceTag price={pool.totalStaked} size="sm" />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStakingPool(pool.id);
                    toggleStaking();
                  }}
                  className={cn(
                    "w-full mt-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
                  )}
                >
                  Stake Now
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Governance */}
      <section>
        <h2 className="text-xl font-bold text-white mb-1">Governance</h2>
        <p className="text-sm text-gray-500 mb-4">Shape the future of the platform with your GBLN</p>
        <div className="space-y-3">
          {PROPOSALS.map((proposal) => {
            const total = proposal.votesFor + proposal.votesAgainst;
            const forPct = total > 0 ? (proposal.votesFor / total) * 100 : 50;
            const status = STATUS_STYLES[proposal.status];
            const userVote = votes[proposal.id];
            const daysLeft = Math.max(0, Math.ceil((new Date(proposal.endsAt).getTime() - Date.now()) / 86400000));

            return (
              <div key={proposal.id} className="rounded-lg border border-gray-800 p-4 bg-gray-900/80">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">📋 {proposal.title}</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">{proposal.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={cn("text-[10px] font-medium", status.color)}>{status.label}</span>
                    {proposal.status === "active" && (
                      <div className="text-[10px] text-gray-500">{daysLeft}d left</div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-gray-500 mb-1">
                  Category: <span className="text-gray-400 capitalize">{proposal.category}</span>
                </div>

                {/* Vote bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-green-400">For: {forPct.toFixed(0)}%</span>
                    <span className="text-red-400">Against: {(100 - forPct).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500/60 transition-all"
                      style={{ width: `${forPct}%` }}
                    />
                    <div
                      className="h-full bg-red-500/60 transition-all"
                      style={{ width: `${100 - forPct}%` }}
                    />
                  </div>
                </div>

                {/* Vote buttons */}
                {proposal.status === "active" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => vote(proposal.id, "for")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        userVote === "for"
                          ? "bg-green-500/30 text-green-400 border border-green-500/50"
                          : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-green-500/10 hover:text-green-400"
                      )}
                    >
                      {userVote === "for" ? "Voted 👍" : "Vote For 👍"}
                    </button>
                    <button
                      onClick={() => vote(proposal.id, "against")}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        userVote === "against"
                          ? "bg-red-500/30 text-red-400 border border-red-500/50"
                          : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-red-500/10 hover:text-red-400"
                      )}
                    >
                      {userVote === "against" ? "Voted 👎" : "Vote Against 👎"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
