import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' data: https://challenges.cloudflare.com https://*.challenges.cloudflare.com https://ca1.cloudflarecaptcha.com https://ca2.cloudflarecaptcha.com",
      "frame-src https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const sharpFiles = ['./node_modules/sharp/**/*', './node_modules/@img/**/*'];

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/api/upload': sharpFiles,
    '/api/pembayaran': sharpFiles,
    '/api/merchandise': sharpFiles,
    '/api/public/struk': ['./public/logo-dies-struk.png'],
    '/api/paket/struk': ['./public/logo-dies-struk.png'],
    '/api/merchandise/preorder/struk': ['./public/logo-dies-struk.png'],
    '/api/ticket/struk': ['./public/logo-dies-struk.png'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
