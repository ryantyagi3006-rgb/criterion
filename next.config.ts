import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM packages used for PDF rendering and diagram cropping.
  serverExternalPackages: ["mupdf", "sharp"],
};

export default nextConfig;
