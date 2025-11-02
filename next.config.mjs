/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/manifest',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019a422f-0215-74a0-0ed1-6821223b7267',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
