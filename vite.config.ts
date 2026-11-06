import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{outDir:'dist/web',rollupOptions:{input:{options:'options.html',demo:'index.html',reader:'reader.html'}}},test:{environment:'jsdom',include:['tests/**/*.test.ts']}});
