import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/public/struk': ['./public/logo-dies-struk.png'],
    '/api/merchandise/preorder/struk': ['./public/logo-dies-struk.png'],
  },
};

export default nextConfig;
