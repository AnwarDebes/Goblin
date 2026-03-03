import { create } from "zustand";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "hero", label: "Hero Section", visible: true },
  { id: "portfolio", label: "Portfolio Value", visible: true },
  { id: "metrics", label: "Metric Cards", visible: true },
  { id: "treemap", label: "Portfolio Treemap", visible: true },
  { id: "positions", label: "Open Positions", visible: true },
  { id: "trades", label: "Trade History", visible: true },
  { id: "health", label: "System Health", visible: true },
];

interface LayoutState {
  widgets: WidgetConfig[];
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  toggleWidget: (id: string) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  saveLayout: () => void;
  resetLayout: () => void;
  loadLayout: () => void;
}

const STORAGE_KEY = "goblin-dashboard-layout";

export const useLayoutStore = create<LayoutState>((set, get) => ({
  widgets: DEFAULT_WIDGETS,
  editMode: false,

  setEditMode: (v) => set({ editMode: v }),

  toggleWidget: (id) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      ),
    })),

  reorderWidgets: (fromIndex, toIndex) =>
    set((state) => {
      const widgets = [...state.widgets];
      const [moved] = widgets.splice(fromIndex, 1);
      widgets.splice(toIndex, 0, moved);
      return { widgets };
    }),

  saveLayout: () => {
    const { widgets } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch {}
    set({ editMode: false });
  },

  resetLayout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    set({ widgets: DEFAULT_WIDGETS, editMode: false });
  },

  loadLayout: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ widgets: parsed });
        }
      }
    } catch {}
  },
}));
