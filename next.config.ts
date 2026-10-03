import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev only: let another computer or a phone on the same home network open the dev server
  // (e.g. http://192.168.1.113:3010); Next blocks other origins from its dev assets by default
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
