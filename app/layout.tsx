import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marga · AI road guide for India",
  description: "Navigate India with a voice-first guide that understands your route and surroundings.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
