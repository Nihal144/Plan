import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google account avatars come back on this host after OAuth sign-in.
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
