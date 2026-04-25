import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Prefer correct CSS ordering over fewer requests; reduces wrong-order / late-apply flashes.
    cssChunking: "strict",
  },
};

export default nextConfig;
