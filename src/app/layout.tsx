import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const body = Barlow({
  variable: "--font-body-face",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const display = Barlow_Condensed({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "https://contaojogo.club"),
  title: { default: "Conta o Jogo", template: "%s • Conta o Jogo" },
  description:
    "Campeonatos, partidas ao vivo, estatísticas e rankings do futebol da região. Futebol contado em números.",
  applicationName: "Conta o Jogo",
};

export const viewport: Viewport = {
  themeColor: "#090b0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
