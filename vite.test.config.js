import { mergeConfig, defineConfig } from 'vite';
import baseConfig from './vite.config.js';
import { resolve } from 'node:path';

export default mergeConfig(baseConfig, defineConfig({
  build: {
    outDir: '.test-dist',
    emptyOutDir: true,
    lib: {
      entry: resolve('tests/keygen-entry.js'),
      formats: ['es'],
      fileName: 'keygen-test'
    }
  }
}));