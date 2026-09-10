import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/', destination: '/guide/what-is-cloak', permanent: false },
      { source: '/quickstart', destination: '/sdk/quickstart', permanent: true },
    ];
  },
};

export default withMDX(config);
