import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Performance ────────────────────────────────────────────────────────────
  compress: true,
  devIndicators: false,
  productionBrowserSourceMaps: false,

  // ── Images ─────────────────────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // ── Turbopack (Next.js 16 default bundler) ─────────────────────────────────
  turbopack: {},

  // ── Security & performance headers ────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options",    value: "nosniff" },
          // Block iframe embedding (clickjacking)
          { key: "X-Frame-Options",            value: "DENY" },
          // Legacy XSS filter (belt-and-braces)
          { key: "X-XSS-Protection",           value: "1; mode=block" },
          // Limit referrer leakage
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          // Restrict browser feature access
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
          // Strict transport security -1 year, include subdomains
          { key: "Strict-Transport-Security",  value: "max-age=31536000; includeSubDomains; preload" },
          // Content-Security-Policy -tightened for SentinelRoute
          // - default-src: self only
          // - script-src: self + Next.js inline scripts (sha256 nonce approach via unsafe-inline
          //   is acceptable for Next.js 16 which uses script nonces via middleware in prod)
          // - style-src: self + unsafe-inline needed by Tailwind CSS-in-JS runtime
          // - img-src: self + data URIs + CDN tiles + Leaflet marker images
          // - connect-src: self + Firebase Auth + Firestore APIs
          // - font-src: self (all fonts are self-hosted via next/font)
          // - frame-ancestors: none (reinforces X-Frame-Options)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://unpkg.com https://*.tile.openstreetmap.org",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://ws.sentinel-route.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Prevent caching of API responses by default
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Robots-Tag",  value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
