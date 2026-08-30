import { defineConfig } from "vite";
import { yamlPlugin } from "./vite-plugins";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/life-of-cupra/" : "/",
  plugins: [yamlPlugin()],
  publicDir: "public",
});
