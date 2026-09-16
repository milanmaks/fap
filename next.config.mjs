/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["avsc", "snappyjs"],
  },
};

export default nextConfig;
