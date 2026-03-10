import { create } from "zustand";
import type { CraftedIndicator } from "@/types/shop";

export type District =
  | "forge"
  | "oracle"
  | "alchemist"
  | "champions"
  | "vault"
  | "familiar"
  | "enchantment"
  | "arena"
  | "treasure"
  | "guild"
  | "skins"
  | "prophecy"
  | "chests"
  | "wheel"
  | "battlepass";

interface GoblinShopState {
  activeDistrict: District;
  setDistrict: (d: District) => void;

  // Modals
  selectedStrategyId: string | null;
  selectStrategy: (id: string | null) => void;
  showCrafting: boolean;
  toggleCrafting: () => void;
  showStaking: boolean;
  toggleStaking: () => void;
  stakingPoolId: string | null;
  setStakingPool: (id: string | null) => void;
  showPurchase: { type: string; id: string; name: string; price: number } | null;
  setPurchase: (p: GoblinShopState["showPurchase"]) => void;

  // Crafting state
  craftingIngredients: string[];
  addIngredient: (id: string) => void;
  removeIngredient: (id: string) => void;
  clearIngredients: () => void;
  craftedIndicators: CraftedIndicator[];
  addCraftedIndicator: (indicator: CraftedIndicator) => void;

  // Filters
  rarityFilter: string | null;
  setRarityFilter: (r: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Ownership / Economy
  ownedStrategies: string[];
  subscribedSignals: string[];
  claimedQuests: string[];
  spentGBLN: number;
  votes: Record<string, "for" | "against">;

  purchaseItem: (type: string, id: string, price: number) => void;
  claimQuest: (id: string) => void;
  vote: (proposalId: string, direction: "for" | "against") => void;
}

export const useGoblinShopStore = create<GoblinShopState>((set, get) => ({
  activeDistrict: "forge",
  setDistrict: (d) => set({ activeDistrict: d }),

  selectedStrategyId: null,
  selectStrategy: (id) => set({ selectedStrategyId: id }),
  showCrafting: false,
  toggleCrafting: () => set((s) => ({ showCrafting: !s.showCrafting })),
  showStaking: false,
  toggleStaking: () => set((s) => ({ showStaking: !s.showStaking })),
  stakingPoolId: null,
  setStakingPool: (id) => set({ stakingPoolId: id }),
  showPurchase: null,
  setPurchase: (p) => set({ showPurchase: p }),

  craftingIngredients: [],
  addIngredient: (id) =>
    set((s) => {
      if (s.craftingIngredients.length >= 3) return s;
      if (s.craftingIngredients.includes(id)) return s;
      return { craftingIngredients: [...s.craftingIngredients, id] };
    }),
  removeIngredient: (id) =>
    set((s) => ({
      craftingIngredients: s.craftingIngredients.filter((i) => i !== id),
    })),
  clearIngredients: () => set({ craftingIngredients: [] }),
  craftedIndicators: [],
  addCraftedIndicator: (indicator) =>
    set((s) => ({ craftedIndicators: [...s.craftedIndicators, indicator] })),

  rarityFilter: null,
  setRarityFilter: (r) => set({ rarityFilter: r }),
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  ownedStrategies: [],
  subscribedSignals: [],
  claimedQuests: [],
  spentGBLN: 0,
  votes: {},

  purchaseItem: (type, id, price) =>
    set((s) => {
      const newState: Partial<GoblinShopState> = { spentGBLN: s.spentGBLN + price, showPurchase: null };
      if (type === "strategy") {
        newState.ownedStrategies = [...s.ownedStrategies, id];
      } else if (type === "signal") {
        newState.subscribedSignals = [...s.subscribedSignals, id];
      }
      return newState as GoblinShopState;
    }),

  claimQuest: (id) =>
    set((s) => ({
      claimedQuests: [...s.claimedQuests, id],
    })),

  vote: (proposalId, direction) =>
    set((s) => ({
      votes: { ...s.votes, [proposalId]: direction },
    })),
}));
