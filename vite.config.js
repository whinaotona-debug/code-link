import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/code-link/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        codeBattle: resolve(__dirname, "code-battle.html"),
      },
    },
  },
});
