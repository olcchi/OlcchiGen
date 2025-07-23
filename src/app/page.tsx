import * as React from "react"
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator"
export default function Home() {
  const tags = Array.from({ length: 50 }).map(
    (_, i, a) => `HALO.${a.length - i}`
  )
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <ScrollArea className="h-72 px-3 w-48 font-mono! rounded-md border custom-scrollbar!">
          {tags.map((tag) => (
            <React.Fragment key={tag}>
              <div className="text-sm">{tag}</div>
              <Separator className="my-1" />
            </React.Fragment>
          ))}
        </ScrollArea>

      </main>
    </div>
  );
}
