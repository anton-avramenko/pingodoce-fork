/**
 * Next.js configuration for a fully static export (deployable to Vercel,
 * Netlify, GitHub Pages or any static file host).
 *
 * Set NEXT_PUBLIC_BASE_PATH when hosting under a sub-path
 * (e.g. GitHub Pages project sites: NEXT_PUBLIC_BASE_PATH=/pingodoce-fork).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: {
    // next/image optimization requires a server; disable it for static export
    unoptimized: true,
  },
};

export default nextConfig;
