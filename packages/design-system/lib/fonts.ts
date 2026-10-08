import { cn } from "@repo/design-system/lib/utils";
import { Amiri, Literata, Ubuntu, Ubuntu_Mono } from "next/font/google";
import localFont from "next/font/local";

/**
 * SAL type: Ubuntu (300/400/700) and Ubuntu Mono for the interface; Amiri
 * (Arabic) and Literata (English) for literary text on Journal reading pages.
 *
 * Ubuntu Arabic (400/700) is self-hosted with next/font/local from
 * ../fonts, byte-for-byte copies of brand/fonts (tokens.test.ts checks).
 * Never Noto Kufi or another substitute. It has no Light weight.
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

const ubuntuArabic = localFont({
  display: "swap",
  src: [
    { path: "../fonts/UbuntuArabic-Regular.woff2", style: "normal", weight: "400" },
    { path: "../fonts/UbuntuArabic-Bold.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-ubuntu-arabic",
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
  ubuntuArabic.variable,
  amiri.variable,
  literata.variable,
  "touch-manipulation font-sans antialiased"
);
