import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."), // points to the monorepo root, one level up
  },
  /* config options here */
};

export default nextConfig;
