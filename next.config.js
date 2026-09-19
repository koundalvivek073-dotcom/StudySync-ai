/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow jsPDF and html2canvas to work client-side
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
