import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Artifact and upload URLs are short-lived fal CDN links, so the UI uses
  // plain <img> tags instead of the Next image optimizer.
  reactStrictMode: true,
};

export default nextConfig;
