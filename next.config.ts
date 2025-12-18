import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },

  experimental: {
    turbo: {
      resolveAlias: {
        '@ffmpeg/ffmpeg': '@ffmpeg/ffmpeg/dist/esm',
      },
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ffmpeg/ffmpeg': '@ffmpeg/ffmpeg/dist/esm',
    };
    return config;
  },

};

export default nextConfig;
