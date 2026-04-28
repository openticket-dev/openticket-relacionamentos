import type { NextConfig } from "next";

// Em staging, roda com basePath /relacionamentos pra landingpage proxy-rewrite
// dev.openticket.com.br/relacionamentos -> este app. Setar NEXT_PUBLIC_BASE_PATH no Railway.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Three.js / WebGPU: transpile pra evitar SSR issues com modulos ESM
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  async rewrites() {
    const shellAuth = process.env.SHELL_AUTH_URL || "http://localhost:3000";
    const apiGateway = process.env.API_GATEWAY_URL || "http://localhost:4000";
    return [
      {
        source: "/api/auth/:path*",
        destination: `${shellAuth}/api/auth/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiGateway}/:path*`,
      },
    ];
  },
};

export default nextConfig;
