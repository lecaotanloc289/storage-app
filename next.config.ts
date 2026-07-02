import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100MB",
    },
  },
  /* config options here */
  // Files are now served from the app's own origin (`/api/files/...`) and
  // avatars are inlined data URIs — both are allowed by `next/image` without any
  // `remotePatterns` entry, so no external image hosts are configured.
};

export default nextConfig;

// Enables Cloudflare bindings (D1, R2, KV, etc.) during `next dev` via OpenNext.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
