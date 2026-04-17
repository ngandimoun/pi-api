import { GitAdapter } from "./git-adapter.js";

/** Git working copy with GitLab origin — local ops identical to Git. */
export class GitLabAdapter extends GitAdapter {
  override readonly name = "gitlab";
}

/** Git working copy with Bitbucket origin — local ops identical to Git. */
export class BitbucketAdapter extends GitAdapter {
  override readonly name = "bitbucket";
}

/** Git working copy with Gerrit origin — local ops identical to Git. */
export class GerritAdapter extends GitAdapter {
  override readonly name = "gerrit";
}
