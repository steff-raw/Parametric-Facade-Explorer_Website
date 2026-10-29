import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Header from "@/components/Header";
import DevDebugMount from "@/components/DevDebugMount";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Parametric Facade Explorer",
    template: "%s · Parametric Facade Explorer",
  },
  description:
    "A gallery of generative, parametric facade design patterns — louvres, perforated screens, brise-soleil, and tessellated panels with live controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Header />
        <main>{children}</main>
        <DevDebugMount />
        <Analytics />
      </body>
    </html>
  );
}
