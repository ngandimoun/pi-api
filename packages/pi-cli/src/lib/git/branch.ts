import simpleGit from "simple-git";

export async function getCurrentBranchName(cwd: string): Promise<string | undefined> {
  try {
    const git = simpleGit({ baseDir: cwd });
    const b = await git.revparse(["--abbrev-ref", "HEAD"]);
    const name = b.trim();
    return name || undefined;
  } catch {
    return undefined;
  }
}
