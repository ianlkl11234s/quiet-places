import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{app:'index.html',studio:'tools/studio/index.html'}}}});
