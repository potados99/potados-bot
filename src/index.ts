import { Application } from 'probot'

export = (app: Application) => {
  app.log.info('App started!');

  app.on('issues.opened', async (context) => {

    if (context.payload.issue.user.login === 'potados99') {
      return;
    }

    const issueComment = context.issue({ body: '이슈 남겨주셔서 감사합니다!' });
    await context.octokit.issues.createComment(issueComment)
  })

  app.on('create', async (context) => {
    if (context.payload.ref_type === 'tag') {
      const drafter = new ReleaseDrafter(context);
      await drafter.draftRelease();
    }
  });

}

class ReleaseDrafter {
  private context: any;

  constructor(context: any) {
    this.context = context;
  }

  async draftRelease() {
    this.log(`New tag: ${this.context.payload.ref}`);

    const latestReleaseCommitSha = await this.getLatestReleaseCommitSha();
    this.log(`Latest release(tag)'s commit SHA: '${latestReleaseCommitSha}'`);

    const newCommits = await this.getCommitsSinceLastRelease(latestReleaseCommitSha);
    this.log(`New commits from then: '${newCommits.map((c: any) => c.sha.substring(0, 7)).join(', ')}'`);

    const commitDescriptions = this.createCommitDescriptions(newCommits);

    const releaseBody = this.generateReleaseBody(commitDescriptions);
    this.log(`Release content: '${releaseBody}`);

    await this.pushRelease(releaseBody);
  }

  private getRepoAndOwner() {
    const repoName = this.context.payload.repository.name;
    const ownerName = this.context.payload.repository.owner.login;

    return {repoName, ownerName};
  }

  private async getLatestReleaseCommitSha() {
    const {repoName, ownerName} = this.getRepoAndOwner();

    let latestRelease;
    try {
      latestRelease = await this.context.octokit.repos.getLatestRelease({
        owner: ownerName,
        repo: repoName,
      });
    } catch (e) {
      return null;
    }

    const latestTagName = latestRelease.data.tag_name;

    const latestTagRef = await this.context.octokit.git.getRef({
      owner: ownerName,
      repo: repoName,
      ref: `tags/${latestTagName}`
    });

    const latestTagRefObject = latestTagRef.data.object;

    // 태그 ref가 담는 대상이 커밋이 아니라 태그일 수도 있읍니다...
    // 그거슨 object의 type이 'tag'인 것으로 나타납니다...

    if (latestTagRefObject.type === 'commit') {
      // 커밋이면 바로 sha를 반환해 줍니다.
      return latestTagRefObject.sha;
    }

    if (latestTagRefObject.type !== 'tag') {
      // 커밋도 아니고 태그도 아니다..!?
      // 밴!!
      console.warn('What is this?? Not a commit, nor tag?');
      return null;
    }

    const latestTag = await this.context.octokit.git.getTag({
      owner: ownerName,
      repo: repoName,
      tag_sha: latestTagRefObject.sha
    })

    return latestTag.data.object.sha;
  }

  private async getCommitsSinceLastRelease(lastReleaseSha: string) {
    if (!lastReleaseSha) {
      return [];
    }

    const {repoName, ownerName} = this.getRepoAndOwner();

    const comparedResultFromLatestTagWithHead = await this.context.octokit.repos.compareCommits({
      owner: ownerName,
      repo: repoName,
      base: lastReleaseSha,
      head: 'HEAD'
    })

    return comparedResultFromLatestTagWithHead.data.commits;
  }

  private createCommitDescriptions(commits: [any]) {
    return (commits.length > 0) ?
        commits.reverse().map((c) => `[\`${c.sha.substring(0, 7)}\`](${c.html_url}) ${c.commit.message.split('\n')[0]}`).join('    \n') :
        '처음 릴리즈!';
  }

  private generateReleaseBody(commitDescriptions: string) {
    return `## 변경 사항🥳 \n\n${commitDescriptions}`;
  }

  private async pushRelease(body: string) {
    const {repoName, ownerName} = this.getRepoAndOwner();
    const newTagName = this.context.payload.ref;

    await this.context.octokit.repos.createRelease({
      owner: ownerName,
      repo: repoName,
      tag_name: newTagName,
      name: newTagName,
      body: body,
    });
  }

  private log(any: any) {
    this.context.log.info(any);
  }
}
