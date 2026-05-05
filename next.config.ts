import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Performance ────────────────────────────────────────────────────────────
  compress: true,
  "devIndicators" : false, // Disable the "Development" indicator in the browser during development.
  "productionBrowserSourceMaps": false, // Disable source maps in production for better performance and security.
  
  // ── Images ─────────────────────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // ── Turbopack (Next.js 16 default bundler) ─────────────────────────────────
  // Empty config silences the "webpack config but no turbopack config" warning.
  // socket.io / socket.io-client are server-only — they don't need client bundling.
  turbopack: {},

  // ── Security headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
