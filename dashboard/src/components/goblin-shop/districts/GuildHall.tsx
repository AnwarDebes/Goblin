"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { generateGuilds } from "@/lib/arena-utils";
import type { Guild, GuildMember, GuildPerk } from "@/types/arena";
import GBLNIcon from "../shared/GBLNIcon";

export default function GuildHall() {
  const [guilds] = useState(() => generateGuilds());
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [joinedGuildId, setJoinedGuildId] = useState<string | null>(null);
  const [tab, setTab] = useState<"browse" | "my-guild">("browse");

  const joinedGuild = guilds.find((g) => g.id === joinedGuildId);

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🏰 Guild Hall
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Join a guild to unlock perks, collaborate on quests, and dominate the leaderboard.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-1">
        <button
          onClick={() => setTab("browse")}
          className={cn(
            "text-xs px-3 py-1.5 font-medium transition-all",
            tab === "browse"
              ? "text-goblin-400 border-b-2 border-goblin-400"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          🏰 Browse Guilds
        </button>
        <button
          onClick={() => setTab("my-guild")}
          className={cn(
            "text-xs px-3 py-1.5 font-medium transition-all",
            tab === "my-guild"
              ? "text-goblin-400 border-b-2 border-goblin-400"
              : "text-gray-500 hover:text-gray-300"
          )}
        >
          ⚔️ My Guild {joinedGuild && `(${joinedGuild.tag})`}
        </button>
      </div>

      {tab === "browse" && !selectedGuild && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              onClick={() => setSelectedGuild(guild)}
              className="p-4 rounded-xl bg-gray-800/30 border border-gray-800/50 hover:border-gray-700 text-left transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{guild.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{guild.name}</h3>
                    <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
                      [{guild.tag}]
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">Level {guild.level}</div>
                </div>
                {guild.isRecruiting ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    Recruiting
                  </span>
                ) : (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    Full
                  </span>
                )}
              </div>

              <p className="text-[10px] text-gray-500 mb-3">{guild.description}</p>

              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniStat label="Members" value={`${guild.members.length}/${guild.maxMembers}`} />
                <MiniStat label="Treasury" value={`${(guild.treasury / 1000).toFixed(1)}K`} icon="💰" />
                <MiniStat label="Win Rate" value={`${guild.totalWinRate.toFixed(0)}%`} color="text-green-400" />
                <MiniStat label="Weekly XP" value={`${(guild.weeklyXP / 1000).toFixed(0)}K`} icon="⭐" />
              </div>

              {/* Active perks */}
              <div className="flex gap-1 mt-3">
                {guild.perks
                  .filter((p) => p.level > 0)
                  .map((perk) => (
                    <span
                      key={perk.id}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400"
                      title={`${perk.name} Lv.${perk.level}`}
                    >
                      {perk.icon} {perk.level}
                    </span>
                  ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "browse" && selectedGuild && (
        <GuildDetail
          guild={selectedGuild}
          isJoined={joinedGuildId === selectedGuild.id}
          onJoin={() => {
            setJoinedGuildId(selectedGuild.id);
            setTab("my-guild");
          }}
          onBack={() => setSelectedGuild(null)}
        />
      )}

      {tab === "my-guild" && (
        joinedGuild ? (
          <GuildDashboard guild={joinedGuild} />
        ) : (
          <div className="text-center py-12 text-gray-600">
            <span className="text-4xl block mb-3">🏰</span>
            <p className="text-sm">You haven&apos;t joined a guild yet.</p>
            <button
              onClick={() => setTab("browse")}
              className="mt-3 text-xs text-goblin-400 hover:text-goblin-300"
            >
              Browse guilds →
            </button>
          </div>
        )
      )}
    </div>
  );
}

function GuildDetail({
  guild,
  isJoined,
  onJoin,
  onBack,
}: {
  guild: Guild;
  isJoined: boolean;
  onJoin: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Back
      </button>

      <div className="flex items-center gap-4">
        <span className="text-5xl">{guild.icon}</span>
        <div>
          <h3 className="text-xl font-bold text-white">
            {guild.name}{" "}
            <span className="text-gray-500 text-sm">[{guild.tag}]</span>
          </h3>
          <p className="text-xs text-gray-400">{guild.description}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            Level {guild.level} • Min Level: {guild.minLevel} •{" "}
            {guild.members.length}/{guild.maxMembers} members
          </p>
        </div>
        {!isJoined && guild.isRecruiting && (
          <button
            onClick={onJoin}
            className="ml-auto px-4 py-2 rounded-lg bg-goblin-500/20 text-goblin-400 hover:bg-goblin-500/30 text-sm font-bold transition-all"
          >
            Join Guild
          </button>
        )}
      </div>

      {/* Perks */}
      <div>
        <h4 className="text-sm font-bold text-white mb-2">Guild Perks</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {guild.perks.map((perk) => (
            <PerkCard key={perk.id} perk={perk} />
          ))}
        </div>
      </div>

      {/* Members */}
      <div>
        <h4 className="text-sm font-bold text-white mb-2">Members</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {guild.members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GuildDashboard({ guild }: { guild: Guild }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-4xl">{guild.icon}</span>
        <div>
          <h3 className="text-lg font-bold text-white">
            {guild.name} [{guild.tag}]
          </h3>
          <p className="text-xs text-gray-400">Level {guild.level}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Treasury" value={`${guild.treasury.toLocaleString()}`} icon="💰" />
        <StatCard label="Members" value={`${guild.members.length}/${guild.maxMembers}`} icon="👥" />
        <StatCard label="Win Rate" value={`${guild.totalWinRate.toFixed(1)}%`} icon="📊" />
        <StatCard label="Weekly XP" value={`${guild.weeklyXP.toLocaleString()}`} icon="⭐" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-bold text-white mb-2">Guild Perks</h4>
          <div className="space-y-2">
            {guild.perks.map((perk) => (
              <PerkCard key={perk.id} perk={perk} />
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-2">Online Members</h4>
          <div className="space-y-1.5">
            {guild.members
              .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0))
              .slice(0, 10)
              .map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerkCard({ perk }: { perk: GuildPerk }) {
  return (
    <div className="p-2.5 rounded-lg bg-gray-800/30 border border-gray-800/50">
      <div className="flex items-center gap-2">
        <span className="text-lg">{perk.icon}</span>
        <div className="flex-1">
          <div className="text-xs font-bold text-white">{perk.name}</div>
          <div className="text-[10px] text-gray-500">{perk.effect} per level</div>
        </div>
        <span className="text-xs text-goblin-400 font-mono">
          Lv.{perk.level}/{perk.maxLevel}
        </span>
      </div>
      <div className="h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
        <div
          className="h-full bg-goblin-500 rounded-full"
          style={{ width: `${(perk.level / perk.maxLevel) * 100}%` }}
        />
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: GuildMember }) {
  const roleColors: Record<string, string> = {
    leader: "text-amber-400",
    officer: "text-blue-400",
    member: "text-gray-400",
  };
  const roleIcons: Record<string, string> = {
    leader: "👑",
    officer: "⭐",
    member: "",
  };
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/20">
      <div className="relative">
        <span className="text-lg">{member.avatar}</span>
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900",
            member.isOnline ? "bg-green-500" : "bg-gray-600"
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white truncate">
          {roleIcons[member.role]} {member.name}
        </div>
        <div className="text-[10px] text-gray-500">
          Lv.{member.level} • {member.contribution.toLocaleString()} contrib
        </div>
      </div>
      <span className={cn("text-[10px] font-medium capitalize", roleColors[member.role])}>
        {member.role}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon?: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className={cn("text-xs font-bold", color || "text-white")}>
        {icon && <span className="mr-0.5">{icon}</span>}
        {value}
      </div>
      <div className="text-[9px] text-gray-600">{label}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800/50 text-center">
      <span className="text-lg">{icon}</span>
      <div className="text-sm font-bold text-white mt-1">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
