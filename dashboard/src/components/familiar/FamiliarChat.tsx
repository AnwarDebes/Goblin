"use client";

import { useFamiliarStore } from "@/stores/familiarStore";
import { MOOD_CONFIG, STAGE_CONFIG } from "@/lib/familiar-utils";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES = {
  info: "border-blue-500/30 bg-blue-500/5",
  warning: "border-yellow-500/30 bg-yellow-500/5",
  critical: "border-red-500/30 bg-red-500/5",
  positive: "border-green-500/30 bg-green-500/5",
};

const SEVERITY_ICONS = {
  info: "💡",
  warning: "⚠️",
  critical: "🚨",
  positive: "✅",
};

export default function FamiliarChat() {
  const { familiar } = useFamiliarStore();
  const moodConfig = MOOD_CONFIG[familiar.mood];
  const stageConfig = STAGE_CONFIG[familiar.stage];

  return (
    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto scrollbar-thin px-1">
      {/* Current status */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
        <span className="text-lg">{stageConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white truncate">{familiar.name}</span>
            <span className={cn("text-[10px]", moodConfig.color)}>
              {moodConfig.icon} {moodConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-red-400 rounded-full transition-all"
                style={{ width: `${familiar.happiness}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-500">❤️ {familiar.happiness}%</span>
          </div>
        </div>
      </div>

      {/* Insights feed */}
      {familiar.insights.length === 0 ? (
        <div className="text-center py-4">
          <span className="text-2xl">{stageConfig.icon}</span>
          <p className="text-xs text-gray-500 mt-1">
            {familiar.stage === "egg"
              ? "The egg is warm... keep trading to hatch it!"
              : `${familiar.name} is watching the markets...`}
          </p>
        </div>
      ) : (
        familiar.insights.slice(0, 10).map((insight) => (
          <div
            key={insight.id}
            className={cn(
              "p-2 rounded-lg border text-xs",
              SEVERITY_STYLES[insight.severity]
            )}
          >
            <div className="flex items-start gap-1.5">
              <span>{SEVERITY_ICONS[insight.severity]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{insight.title}</p>
                <p className="text-gray-400 mt-0.5 leading-relaxed">{insight.message}</p>
                <p className="text-gray-600 text-[9px] mt-1">
                  {new Date(insight.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
