import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import nodePolyfills from "rollup-plugin-polyfill-node";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: "globalThis"
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }),
        NodeModulesPolyfillPlugin()
      ]
    }
  },
  build: {
    rollupOptions: {
      plugins: [
        // Enable rollup polyfills plugin
        // used during production bundling
        nodePolyfills()
      ]
    }
  }
});
