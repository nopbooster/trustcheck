import { parse } from "yaml";
import { z } from "zod";

const RiskyToolsSchema = z.record(
  z.string(),
  z.object({ check: z.array(z.string()).min(1) }),
);

/** tool name -> the argument names that must be checked */
export type RiskyToolsConfig = z.infer<typeof RiskyToolsSchema>;

export function parseRiskyToolsConfig(yamlText: string): RiskyToolsConfig {
  const raw = parse(yamlText) ?? {};
  return RiskyToolsSchema.parse(raw);
}
