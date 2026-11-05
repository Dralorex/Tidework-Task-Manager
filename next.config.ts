import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LocalTunnel / similar hosts to load Next.js assets in dev
  allowedDevOrigins: [
    "red-loops-join.loca.lt",
    "*.loca.lt",
    "localhost",
    "127.0.0.1",
  ],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
