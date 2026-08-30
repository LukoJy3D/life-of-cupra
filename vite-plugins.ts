import yaml from "js-yaml";
import type { Plugin } from "vite";

export function yamlPlugin(): Plugin {
  return {
    name: "yaml",
    transform(code, id) {
      if (!id.endsWith(".yaml") && !id.endsWith(".yml")) return;
      const data = yaml.load(code);
      return {
        code: `export default ${JSON.stringify(data)};`,
        map: null,
      };
    },
  };
}
