import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Tell Next.js to skip bundling these server-side packages (Firebase, etc.)
  // This prevents "Module not found" errors on Vercel and local builds.
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "undici",
  ],

  experimental: {
    // Only list exact package names — wildcards are not supported here
    optimizePackageImports: [
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "lucide-react",
    ],
  },

  // Next.js 16: Turbopack is the default bundler.
  // Adding an empty turbopack config tells Next.js that the webpack config
  // below is intentional (used only when --webpack flag is passed explicitly)
  // and prevents the build from erroring with "webpack config but no turbopack config".
  turbopack: {},

  // Allow images from common financial data sources
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.polygon.io" },
      { protocol: "https", hostname: "**.alpaca.markets" },
      { protocol: "https", hostname: "logo.clearbit.com" },
      // Google profile avatars (next-auth)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },

  // Suppress known harmless webpack warnings from Firebase / WS packages
  webpack(config, { isServer }) {
    if (isServer) {
      // Prevent "Critical dependency: the request of a dependency is an expression"
      // warnings from firebase-admin internals
      config.ignoreWarnings = [
        { module: /node_modules\/firebase-admin/ },
        { module: /node_modules\/@firebase/ },
      ];
    }
    return config;
  },
};

export default nextConfig;
