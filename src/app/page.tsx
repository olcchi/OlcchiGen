import * as React from "react"
import { ArtList } from "@/components/art-list"
export default function Home() {
  const arts = [
    {
      id: 1,
      name: "Thermal motion",
      url: "arts/thermal-motion",
    },
    {
      id: 2,
      name: "Circle Loop",
      url: "arts/circle-loop",
    },
    {
      id: 3,
      name: "Memory Fade",
      url: "arts/memory-fade",
    },
  ]
  return (
    <div className="font-sans h-[100dvh] flex items-center justify-center bg-white p-8">
      <main className="">
        <ArtList arts={arts} />
      </main>
    </div>
  );
}
