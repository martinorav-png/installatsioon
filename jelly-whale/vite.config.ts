import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: 'three-r170-importmap',
    enforce: 'pre',
    transform(code, id, options) {
      if (options?.ssr || command !== 'serve' || !id.includes('/src/') || !/\.[tj]sx?$/.test(id)) return;
      return code.replace(/from ['"](three(?:\/addons\/[^'"]+)?)['"]/g, (_, name: string) => {
        const url = name === 'three' ? 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js' : name.replace('three/addons/', 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/');
        return `from '${url}'`;
      });
    },
  }],
  build: { rollupOptions: { external: /^three(?:\/|$)/ } },
  optimizeDeps: { exclude: ['three'] },
  test: { include: ['src/**/*.test.ts'] },
}));
