import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const deploymentId = process.env.DEPLOYMENT_VERSION?.trim();

const nextConfig: NextConfig = {
  deploymentId: deploymentId !== undefined && deploymentId !== "" ? deploymentId : undefined,
  experimental: {
    authInterrupts: true,
  },
  serverExternalPackages: ["postgres-shift"],
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1536, 1920, 2560],
    formats: ["image/avif", "image/webp"],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
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
