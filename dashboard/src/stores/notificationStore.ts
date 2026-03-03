import { create } from "zustand";

export type NotificationType = "trade" | "position" | "price" | "sentiment" | "system" | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  read: boolean;
  color: "green" | "red" | "gold" | "blue" | "gray";
  pnlPercent?: number;
}

interface NotificationState {
  notifications: AppNotification[];
  soundEnabled: boolean;
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markAllRead: () => void;
  clearAll: () => void;
  toggleSound: () => void;
}

let idCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  soundEnabled: false,
  unreadCount: 0,

  addNotification: (n) => {
    const notification: AppNotification = {
      ...n,
      id: `notif-${Date.now()}-${++idCounter}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));
