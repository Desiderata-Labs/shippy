import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Shippy assets
      {
        protocol: 'https',
        hostname: 'localhost.shippy.sh',
      },
      {
        protocol: 'https',
        hostname: 'assets.shippy.sh',
      },
      // OAuth provider avatars
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
}

export default nextConfig
