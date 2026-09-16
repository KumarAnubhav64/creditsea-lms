/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Dev convenience: same-origin /api and /uploads so the browser never
    // needs CORS — requests are proxied to the Express backend.
    const backend = process.env.BACKEND_URL ?? 'http://localhost:5000';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
    ];
  },
};

module.exports = nextConfig;
