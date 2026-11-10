import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMARTY AI — One workspace. Many minds.",
  description: "A multi-model AI workspace powered by OpenRouter.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
