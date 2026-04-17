import type { VcsType } from "../types.js";
import { GitAdapter } from "./git-adapter.js";

/** Git working copy with GitLab origin — local ops identical to Git. */
export class GitLabAdapter extends GitAdapter {
  override readonly name: VcsType = "gitlab";
}

/** Git working copy with Bitbucket origin — local ops identical to Git. */
export class BitbucketAdapter extends GitAdapter {
  override readonly name: VcsType = "bitbucket";
}

/** Git working copy with Gerrit origin — local ops identical to Git. */
export class GerritAdapter extends GitAdapter {
  override readonly name: VcsType = "gerrit";
}
