import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import FacebookSDK from "@/components/FacebookSDK";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard Inteligente POC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <FacebookSDK /> {/* O SDK carrega aqui de forma limpa */}
        </AuthProvider>
      </body>
    </html>
  );
}