import path from "node:path";
import { pathToFileURL } from "node:url";

export async function importFromTarget<T = unknown>(modulePath: string): Promise<T> {
  const cwd = process.cwd();
  const targetRoot = process.env.EVAL_TARGET ?? path.join(cwd, "solution");
  return import(pathToFileURL(path.join(targetRoot, modulePath)).href) as Promise<T>;
}
