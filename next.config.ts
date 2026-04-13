import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  deploymentId: process.env.DEPLOYMENT_VERSION?.trim() || undefined,
  experimental: {
    authInterrupts: true,
  },
  serverExternalPackages: ["postgres-shift"],
  images: {
    formats: ["image/webp"],
    qualities: [60, 75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fonts.gstatic.com",
        pathname: "/s/e/notoemoji/**",
      },
    ],
  },
  redirects() {
    return [
      {
        source: "/apply",
        destination: "https://forms.hackclub.com/t/f9JVqAtU5bus",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
