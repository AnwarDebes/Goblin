"use client";

import dynamic from "next/dynamic";

const NerveCenterScene = dynamic(
  () => import("@/components/nerve-center/NerveCenterScene"),
  { ssr: false }
);
const NerveCenterHUD = dynamic(
  () => import("@/components/nerve-center/NerveCenterHUD"),
  { ssr: false }
);
const MobileTouchControls = dynamic(
  () => import("@/components/nerve-center/PlayerController").then((m) => ({ default: m.MobileTouchControls })),
  { ssr: false }
);

export default function NerveCenterPage() {
  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden rounded-xl border border-goblin-500/20 sm:rounded-xl sm:border">
      <NerveCenterScene />
      <NerveCenterHUD />
      <MobileTouchControls />
    </div>
  );
}
