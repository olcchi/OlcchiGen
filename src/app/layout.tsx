import type { Metadata } from "next";
import { Geist, Noto_Sans_Mono } from "next/font/google";
import { Star } from "@/components/ui/star";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const NotoSansMono = Noto_Sans_Mono({
  variable: "--font-noto-sans-mono",
  subsets: ["latin"],
});

// Dynamic metadata generation based on URL
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || '/'

  // Check if we're in an arts route
  if (pathname.startsWith('/arts/')) {
    const pathSegments = pathname.split('/')
    const projectName = pathSegments[2] || 'Arts'

    // Capitalize first letter and replace hyphens with spaces
    const formattedTitle = projectName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    return {
      title: `${formattedTitle} - olcchi Gen`,
      description: `${formattedTitle} art project by olcchi`,
    }
  }

  // Default metadata for other routes
  return {
    title: "olcchi Gen",
    description: "olcchi Gen",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${NotoSansMono.variable} antialiased`}
      >
        <main className="h-[100dvh]">
          <div className="fixed top-4 left-4 flex items-center gap-4 w-40 h-10">
            <Star className="w-6 h-6 hover:rotate-90 transition-all ease-in-out" />
            <p className="text-xs font-mono font-bold select-none">olcchi Gen</p>
          </div>
          {children}
          <div className="fixed bottom-4 right-4">
            <a
              href="https://github.com/olcchi/OlcchiGen"
              target="_blank"
              rel="noopener noreferrer"
              className=" text-xs font-mono font-bold hover:underline transition-opacity"
            >
              Source code
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
