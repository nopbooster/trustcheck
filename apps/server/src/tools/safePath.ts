import { existsSync } from "node:fs";
import path from "node:path";

/** Resolves `name` inside one of `dirs`. Returns null for anything that isn't a plain file name. */
export function resolveDemoFile(name: string, dirs: string[]): string | null {
  if (!/^[\w][\w.-]*$/.test(name)) return null; // no slashes, no "..", no leading dot
  for (const dir of dirs) {
    const full = path.join(dir, name);
    if (path.dirname(full) === dir && existsSync(full)) return full;
  }
  return null;
}
