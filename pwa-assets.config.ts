import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Generates the PWA icons in public/ from one square source: `npm run generate-pwa-assets`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: '#10b981' } },
    apple: { ...preset.apple, resizeOptions: { background: '#10b981' } },
  },
  images: ['public/icon.svg'],
});
