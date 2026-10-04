import { cn } from "@repo/design-system/lib/utils";
import { Amiri, Literata, Ubuntu, Ubuntu_Mono } from "next/font/google";

/**
 * SAL type: Ubuntu (300/400/700) and Ubuntu Mono for the interface; Amiri
 * (Arabic) and Literata (English) for literary text on Waraq reading pages.
 *
 * Ubuntu Arabic (400/700) must be self-hosted from brand/fonts with
 * next/font/local — never Noto Kufi or another substitute. The font files
 * are not in the repo yet (see PROGRESS.md), so --font-ubuntu-arabic names
 * the family and the system falls back until they are added.
 */
const ubuntu = Ubuntu({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ubuntu",
  weight: ["300", "400", "700"],
});

const ubuntuMono = Ubuntu_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ubuntu-mono",
  weight: ["400", "700"],
});

const amiri = Amiri({
  display: "swap",
  subsets: ["arabic"],
  variable: "--font-amiri",
  weight: ["400", "700"],
});

const literata = Literata({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-literata",
});

export const fonts = cn(
  ubuntu.variable,
  ubuntuMono.variable,
  amiri.variable,
  literata.variable,
  "touch-manipulation font-sans antialiased"
);
