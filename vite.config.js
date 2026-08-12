import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        pitagora: resolve(__dirname, "pitagora.html"),
        codeBattle: resolve(__dirname, "code-battle.html"),
      },
    },
  },
});
