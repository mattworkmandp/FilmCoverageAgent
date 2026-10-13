import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Coverage — Dialogue Scene Shot Agent",
  description:
    "Drop in cast and location photos; get a blocked dialogue-scene coverage set with overhead diagrams and WS/MS/CU shots compared across three image models. Powered by the fal Agent SDK.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-[#0a0a0b] font-sans text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
