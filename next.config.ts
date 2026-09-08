import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js Image component to load from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  // pg-boss, voyageai, and pdfjs-dist include Node.js native modules
  // that must not be bundled by webpack for the client
  serverExternalPackages: ["voyageai", "pdf-parse"],

  // Webpack config for PDF.js worker
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  // Turbopack config for PDF.js worker (Next 16+)
  turbopack: {},
};

export default nextConfig;
