import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@lib': path.resolve(__dirname, 'src/lib'),
            '@scripts': path.resolve(__dirname, 'src/scripts'),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['src/test/setup.ts'],
        globals: true,
        include: ['src/**/*.test.ts'],
    },
})
