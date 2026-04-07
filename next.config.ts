import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  serverExternalPackages: ["postgres-shift"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fonts.gstatic.com",
        pathname: "/s/e/notoemoji/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
