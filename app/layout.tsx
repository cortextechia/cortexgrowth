import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import FacebookSDK from "@/components/FacebookSDK";
import { AuthProvider } from "@/context/AuthContext";
import PwaSetup from "@/components/PwaSetup";

const inter = Inter({ subsets: ["latin"] });
// Títulos e rótulos do visual Cromalex (globals.css: h1/h2 e .eyebrow).
const manrope = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono-cx" });

export const metadata: Metadata = {
  title: "Cromalex Growth",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  // iPhone: aberto pela tela de início, roda em tela cheia com este nome embaixo do ícone.
  appleWebApp: { capable: true, title: "Cromalex", statusBarStyle: "default" },
};

// viewport-fit=cover libera o env(safe-area-inset-*) (barra do iPhone embaixo).
// A cor da barra do sistema acompanha o tema no PwaSetup.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0d0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={`${inter.className} ${manrope.variable} ${geistMono.variable}`}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
            <FacebookSDK />
            <PwaSetup />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}