/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ← デプロイ時にLintエラー無視
  },
};

module.exports = nextConfig;
