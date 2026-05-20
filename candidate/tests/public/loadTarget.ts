import path from "node:path";
import { pathToFileURL } from "node:url";

export async function importFromTarget<T = unknown>(modulePath: string): Promise<T> {
  const cwd = process.cwd();
  const targetRoot =
    process.env.EVAL_TARGET ??
    (path.basename(cwd) === "candidate" || path.basename(cwd) === "main" || path.basename(cwd) === "solution"
      ? cwd
      : path.join(cwd, "candidate"));
  const resolved = path.join(targetRoot, modulePath);
  return import(pathToFileURL(resolved).href) as Promise<T>;
}
