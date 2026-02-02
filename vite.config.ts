import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { scripts } from './scripts.config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptName = process.env.SCRIPT || 'husqvarna-skripte';
const scriptConfig = scripts[scriptName];

if (!scriptConfig) {
  throw new Error(`Unknown script: ${scriptName}. Available: ${Object.keys(scripts).join(', ')}`);
}

export default defineConfig({
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@scripts': path.resolve(__dirname, 'src/scripts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
  plugins: [
    monkey({
      entry: scriptConfig.entry,
      userscript: {
        ...(scriptConfig.userscript as any),
        require: [
          'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js',
        ],
      },
      build: {
        externalGlobals: scriptConfig.externalGlobals as Record<string, string> ?? {},
        fileName: scriptConfig.outputFileName,
      },
    }),
  ],
});
