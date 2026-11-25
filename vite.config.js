import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to IPv4 loopback: every browser's "localhost" falls back to it, and it stays private to this computer.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  // Rebuild the dependency cache on every start so the browser never gets two copies of React.
  optimizeDeps: { force: true },
});
