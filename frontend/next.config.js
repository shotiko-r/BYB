const { validateApiUrl } = require('./api-config.cjs');
if (process.env.NODE_ENV === 'production') validateApiUrl(process.env.NEXT_PUBLIC_API_URL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@byb/shared'],
};

module.exports = nextConfig;