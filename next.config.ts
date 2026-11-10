import type { NextConfig } from "next";

// Cabeçalhos de segurança (auditoria 03/11/2026). Até aqui o site só tinha o HSTS da Vercel.
// A CSP desta leva cobre enquadramento, plugins e <base>: não restringe script/conexão/imagem,
// porque isso exige nonce nos scripts do Next e a lista de CDNs da Meta/WhatsApp (avatares,
// mídia do Direct) — próximo passo, testado tela por tela. Os tokens ficam no localStorage,
// então a CSP de script é a que mais protege quando vier.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // O celular precisa pegar o service worker novo a cada deploy, nunca uma cópia guardada.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
