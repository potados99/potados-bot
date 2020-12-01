import { Application } from 'probot'

export = (app: Application) => {
  app.log.info('App started!');

  app.on('issues.opened', async (context) => {
    const issueComment = context.issue({ body: 'Thanks for opening this issue!' })
    await context.octokit.issues.createComment(issueComment)
  })

  app.on('issue_comment.created', async (context) => {
     context.log.info(`issue commented!: ${context.payload.comment.body}`)
  })

  app.on('pull_request.opened', async (context) => {
    context.log.info(`pr opened!: ${context.payload}`)
  });

  app.on('pull_request.reopened', async (context) => {
    context.log.info(`pr reopened!: ${context.payload}`)
  });

  app.on('pull_request.closed', async (context) => {
    context.log.info(`pr reopened!: ${context.payload}`)
  });

}
