import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Public routes; keep in sync with src/data/navigation.ts. */
const ROUTES = ['/', '/features', '/how-it-works', '/about', '/contact', '/privacy-policy', '/terms-and-conditions'];

/** Emits sitemap.xml and robots.txt using VITE_SITE_URL so the domain is configured in one place. */
function seoFiles(siteUrl: string): Plugin {
  const origin = siteUrl.replace(/\/$/, '');
  return {
    name: 'flint-seo-files',
    apply: 'build',
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);
      const urls = ROUTES.map(
        (path) =>
          `  <url>\n    <loc>${origin}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${path === '/' ? '1.0' : '0.7'}</priority>\n  </url>`,
      ).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), seoFiles(env.VITE_SITE_URL || 'https://flint.dating')],
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
            if (id.includes('/motion') || id.includes('framer-motion')) return 'motion';
            if (id.includes('react')) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
