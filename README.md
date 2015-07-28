# CodePipeline OpsWorks Deployer

## What is this?

This is a Lambda function which allows you to deploy to OpsWorks using [CodePipeline](http://aws.amazon.com/codepipeline/) by
implementing a [custom action](http://docs.aws.amazon.com/codepipeline/latest/userguide/how-to-create-custom-action.html).
 
**You can find a full guide on setting it up [on my blog](http://hipsterdevblog.com/blog/2015/07/28/deploying-from-codepipeline-to-opsworks-using-a-custom-action-and-lambda/)**

When configured you can use it just like the inbuilt stage actions: 
![Diagram](http://hipsterdevblog.com/images/posts/opsworks_codepipeline/actionopts.png)
 
## How does it work?

It uses S3 put notifications to trigger the Lambda function, then SNS retries to implement polling.

Here's a general diagram of how it works:

![Diagram](http://hipsterdevblog.com/images/posts/opsworks_codepipeline/codepipelineopsworks-diagram.png)

## How do I develop on this?

You might find the following two grunt functions useful:

`grunt lambda_invoke_monitor`
`grunt lambda_invoke_task`

You may also want to monitor the two event_something.json files to reference resources within your own account.

Finally, if you're using this as a base for another action you might want to change the `buildProvider` variable in
`lib/handle_job.js` to a different name.