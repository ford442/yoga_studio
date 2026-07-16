import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: './',
  trailingSlash: true,
  turbopack: {
    root: '/root/yoga_studio',
  },
};

export default nextConfig;
