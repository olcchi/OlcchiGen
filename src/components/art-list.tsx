import * as React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface ArtListProps {
  arts: {
    name: string
    url: string
  }[]
  className?: string
}

/**
 * ArtList component displays a scrollable list of art pieces with separators
 * @param arts - Array of art objects to display
 * @param className - Optional additional CSS classes
 */
export function ArtList({ arts, className = "" }: ArtListProps) {
  return (
    <ScrollArea className={`h-72 w-48 font-mono ${className}`}>
      {arts.map((art, index) => (
        <React.Fragment key={`${art.name}-${art.url}`}>
          <div className="text-xs font-mono font-bold px-2"><a className="hover:opacity-40 transition-opacity ease-in-out duration-500" href={art.url}>{index + 1}.{art.name}</a></div>
          <Separator className="my-1 bg-black" />
        </React.Fragment>
      ))}
    </ScrollArea>
  )
}