"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const SHORTCUTS = [
  { keys: "Ctrl+K / Cmd+K", description: "Open command palette" },
  { keys: "?", description: "Show keyboard shortcuts" },
  { keys: "Esc", description: "Close modals & panels" },
  { keys: "D", description: "Go to Dashboard" },
  { keys: "T", description: "Go to Trading" },
  { keys: "S", description: "Toggle sound" },
  { keys: "F", description: "Toggle fullscreen" },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-300">{s.description}</span>
              <div className="flex gap-1">
                {s.keys.split(" / ").map((k) => (
                  <kbd key={k} className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-400 font-mono">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
