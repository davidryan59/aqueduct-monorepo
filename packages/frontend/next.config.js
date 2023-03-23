/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    experimental: { images: { allowFutureImage: true }, externalDir: true, },
};

module.exports = nextConfig;
