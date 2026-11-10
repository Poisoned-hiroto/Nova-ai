import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOVA AI — Think it through",
  description: "A focused AI workspace for thinking, research, and problem solving.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
