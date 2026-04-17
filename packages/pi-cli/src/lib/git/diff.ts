import simpleGit from "simple-git";

export async function getChangedFilesSince(cwd: string, ref = "HEAD"): Promise<string[]> {
  const git = simpleGit({ baseDir: cwd });
  const diff = await git.diff(["--name-only", ref]);
  return diff.split("\n").map((l) => l.trim()).filter(Boolean);
}

export async function getChangedFilesWorkingTree(cwd: string): Promise<string[]> {
  const git = simpleGit({ baseDir: cwd });
  const status = await git.status();
  return [...status.modified, ...status.created, ...status.not_added];
}
