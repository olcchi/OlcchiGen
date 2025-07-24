import type { Metadata } from "next";
import { Geist, Noto_Sans_Mono } from "next/font/google";
import { Star } from "@/components/ui/star";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const NotoSansMono = Noto_Sans_Mono({
  variable: "--font-noto-sans-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "olcchi Gen",
  description: "olcchi Gen",
};

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
            <p className="text-xs font-mono font-bold">olcchi Gen</p>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
