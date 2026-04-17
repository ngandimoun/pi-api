import path from "node:path";

export function getProjectRoot(): string {
  return process.cwd();
}

export function piDir(root = getProjectRoot()): string {
  return path.join(root, ".pi");
}

export function piCacheDir(root = getProjectRoot()): string {
  return path.join(piDir(root), ".cache");
}

export function piRoutinesDir(root = getProjectRoot()): string {
  return path.join(piDir(root), "routines");
}

export function systemStylePath(root = getProjectRoot()): string {
  return path.join(piDir(root), "system-style.json");
}
