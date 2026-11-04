import { readFileSync } from "node:fs";
import { parseRiskyToolsConfig, type RiskyToolsConfig } from "./config";

/** Node-only helper (kept out of the main entry so the core works in browsers). */
export function loadRiskyToolsConfig(path: string): RiskyToolsConfig {
  return parseRiskyToolsConfig(readFileSync(path, "utf8"));
}
