import * as React from "react"
import { ArtList } from "@/components/art-list"
export default function Home() {
  const arts = [
    {
      name: "Thermal motion",
      url: "arts/thermal-motion",
    },
    {
      name: "Circle loop",
      url: "arts/circle-loop",
    },
    {
      name: "Fade",
      url: "arts/fade",
    },
    {
      name: "Maze",
      url: "arts/maze",
    },
    {
      name: "Rust diffusion",
      url: "arts/rust-diffusion",
    },
    {
      name: "Ripples",
      url: "arts/ripples",
    },
    {
      name: "Vertigo",
      url: "arts/vertigo",
    },
    {
      name: "Maybe pop art",
      url: "arts/maybe-pop-art",
    },
    
  ]
  return (
    <main className="font-sans h-[100dvh] flex items-center justify-center bg-white p-8">
      <ArtList arts={arts} />
    </main>
  );
}
