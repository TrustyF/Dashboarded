import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone: a pruned server bundle that doesn't need the
  // full node_modules tree copied into the runtime Docker image. This is
  // the single biggest lever for keeping the deployed image small on a Pi.
  output: "standalone",
};

export default nextConfig;
