import { ReactNode } from 'react'
import Link from 'next/link'

interface ArtsLayoutProps {
  children: ReactNode
}

/**
 * Layout for all /arts/* routes
 * Provides basic navigation back to catalog
 */
export default function ArtsLayout({ children }: ArtsLayoutProps) {
  return (
    <div className="h-full w-full flex justify-center items-center">
      <div className="w-200 max-w-screen flex flex-col justify-center">
        <div className=" mb-6 px-5">
          <Link 
            href="/"
            className="text-xs font-mono font-bold italic hover:underline"
          >
            ← Catalog
          </Link>
        </div>
        
        <div className="text-center w-full h-full">
          <main className="w-full flex flex-col gap-5 justify-center items-center">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}