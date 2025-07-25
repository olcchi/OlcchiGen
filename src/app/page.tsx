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
      name: "Fade",
      url: "arts/fade",
    },
    {
      id: 4,
      name: "Maze",
      url: "arts/maze",
    },
    {
      id: 5,
      name: "Rust",
      url: "arts/rust",
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
