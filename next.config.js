/** @type {import('next').NextConfig} */
module.exports = {
  // Local only: parallel dev servers each get their own build folder (NEXT_DIST_DIR=.next-3141).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560, 2880, 3200],
    imageSizes: [256, 384, 512, 768],
    qualities: [75, 82, 90],
    minimumCacheTTL: 31536000,
  },
}
