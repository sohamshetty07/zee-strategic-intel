/** @type {import('next').NextConfig} */
const nextConfig = {
    // This tells Next.js NOT to bundle these heavy Node.js packages, 
    // allowing them to read their own internal JSON files at runtime.
    serverExternalPackages: ['got-scraping', 'header-generator'],
};

export default nextConfig;