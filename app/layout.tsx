import type { Metadata } from "next";
import { Inter, Manrope, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import FacebookSDK from "@/components/FacebookSDK";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });
// Títulos e rótulos do visual Cromalex (globals.css: h1/h2 e .eyebrow).
const manrope = Manrope({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono-cx" });

export const metadata: Metadata = {
  title: "Cortex Growth",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className={`${inter.className} ${manrope.variable} ${geistMono.variable}`}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
            <FacebookSDK />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}