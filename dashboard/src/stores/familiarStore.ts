import { create } from "zustand";
import type { FamiliarState, FamiliarInsight, CosmeticSlot } from "@/types/familiar";
import {
  createDefaultFamiliar,
  EVOLUTION_XP,
  getNextStage,
  canEvolve,
  computeHappinessDecay,
  computeBondLevel,
} from "@/lib/familiar-utils";

interface FamiliarStore {
  familiar: FamiliarState;
  isExpanded: boolean;
  isAbilitiesOpen: boolean;
  isCustomizerOpen: boolean;
  isEvolving: boolean;
  showEvolutionAnimation: boolean;

  // UI
  toggleExpanded: () => void;
  setAbilitiesOpen: (open: boolean) => void;
  setCustomizerOpen: (open: boolean) => void;

  // Actions
  feedFamiliar: (xpGain: number) => void;
  evolve: () => void;
  unlockAbility: (abilityId: string) => void;
  equipCosmetic: (slot: CosmeticSlot, cosmeticId: string | null) => void;
  setName: (name: string) => void;
  addInsight: (insight: Omit<FamiliarInsight, "id" | "timestamp">) => void;
  clearEvolutionAnimation: () => void;
  updateMood: (mood: FamiliarState["mood"]) => void;
  tickHappiness: () => void;
}

let insightCounter = 0;

export const useFamiliarStore = create<FamiliarStore>((set, get) => ({
  familiar: createDefaultFamiliar(),
  isExpanded: false,
  isAbilitiesOpen: false,
  isCustomizerOpen: false,
  isEvolving: false,
  showEvolutionAnimation: false,

  toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
  setAbilitiesOpen: (open) => set({ isAbilitiesOpen: open }),
  setCustomizerOpen: (open) => set({ isCustomizerOpen: open }),

  feedFamiliar: (xpGain) =>
    set((s) => {
      const newXp = s.familiar.xp + xpGain;
      const happiness = Math.min(100, s.familiar.happiness + 5);
      const newStreak = s.familiar.tradingStreak + 1;
      return {
        familiar: {
          ...s.familiar,
          xp: newXp,
          happiness,
          tradingStreak: newStreak,
          lastFedAt: new Date().toISOString(),
          bondLevel: computeBondLevel(s.familiar.totalInsightsGiven, happiness),
        },
      };
    }),

  evolve: () => {
    const { familiar } = get();
    if (!canEvolve(familiar)) return;

    const nextStage = getNextStage(familiar.stage);
    if (!nextStage) return;

    set({ isEvolving: true, showEvolutionAnimation: true });

    setTimeout(() => {
      set((s) => ({
        isEvolving: false,
        familiar: {
          ...s.familiar,
          stage: nextStage,
          xpToEvolve: EVOLUTION_XP[nextStage],
        },
      }));
    }, 3000);
  },

  clearEvolutionAnimation: () => set({ showEvolutionAnimation: false }),

  unlockAbility: (abilityId) =>
    set((s) => ({
      familiar: {
        ...s.familiar,
        unlockedAbilities: [...s.familiar.unlockedAbilities, abilityId],
      },
    })),

  equipCosmetic: (slot, cosmeticId) =>
    set((s) => ({
      familiar: {
        ...s.familiar,
        equippedCosmetics: {
          ...s.familiar.equippedCosmetics,
          [slot]: cosmeticId ?? undefined,
        },
      },
    })),

  setName: (name) =>
    set((s) => ({
      familiar: { ...s.familiar, name },
    })),

  addInsight: (insight) =>
    set((s) => {
      const newInsight: FamiliarInsight = {
        ...insight,
        id: `insight-${Date.now()}-${++insightCounter}`,
        timestamp: new Date().toISOString(),
      };
      return {
        familiar: {
          ...s.familiar,
          totalInsightsGiven: s.familiar.totalInsightsGiven + 1,
          insights: [newInsight, ...s.familiar.insights].slice(0, 20),
        },
      };
    }),

  updateMood: (mood) =>
    set((s) => ({
      familiar: { ...s.familiar, mood },
    })),

  tickHappiness: () =>
    set((s) => {
      const happiness = computeHappinessDecay(s.familiar.lastFedAt);
      return {
        familiar: {
          ...s.familiar,
          happiness,
          bondLevel: computeBondLevel(s.familiar.totalInsightsGiven, happiness),
        },
      };
    }),
}));
