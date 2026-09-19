/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 uses Turbopack by default
  turbopack: {},

  // better-sqlite3 is a native Node module — must stay server-side only
  serverExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;
