import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LeagueDataProvider } from "@/lib/DataContext";
import StatsChat from "@/components/StatsChat";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parish League Stats — Liga Parroquial de Baloncesto",
  description:
    "Estadísticas, clasificaciones y resultados de la Liga Parroquial de Baloncesto de Madrid. Sin publicidad, sin engorros.",
  keywords: [
    "baloncesto",
    "liga parroquial",
    "estadísticas",
    "parish league",
    "basketball",
    "madrid",
  ],
  openGraph: {
    title: "Parish League Stats",
    description: "Estadísticas de la Liga Parroquial de Baloncesto",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <LeagueDataProvider>
          <Navbar />
          <main>{children}</main>
          <StatsChat />
        </LeagueDataProvider>
      </body>
    </html>
  );
}
