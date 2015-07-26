var targetPrefix = 'test-pipeline/opsworks/';
var buildProvider = 'My-Build-Provider-Name';
var destinationBucket = 'opsworks-artifacts';
var stackID = 'd7cfb2ab-c02c-4290-b5ed-c55b020096df';
var appID = '57f1cf18-7160-4d29-b504-a5896ea32827';
var monitorARN = 'arn:aws:sns:us-east-1:608866947342:test';

var AWS = require('aws-sdk');
var async = require('async');

AWS.config.update({
    region: 'us-east-1',
    apiVersions: {
        codepipeline: '2015-07-09',
        s3: '2006-03-01'
    },
    S3Config: {
        UseSignatureVersion4: true
    }
});

module.exports = function (message, context) {
    var key = message.Records[0].s3.object.key;
    var bucket = message.Records[0].s3.bucket.name;

    if (key.substring(0, targetPrefix.length) != targetPrefix) {
        console.log('Skipping artifact.');
        context.succeed("Skipping artifact");
        return;
    }

    var codepipeline = new AWS.CodePipeline();
    var s3 = new AWS.S3({
        signatureVersion: 'v4'
    });
    var opsworks = new AWS.OpsWorks();
    var sns = new AWS.SNS();

    var markFail = function(job, message, callback) {
        var params = {
            jobId: job.id,
            failureDetails: {
                message: message,
                type: 'JobFailed',
                externalExecutionId: '1'
            }
        };
        codepipeline.putJobFailureResult(params, function(err, data) {
            if (err) {
                console.log('Marking fail failed.');
                console.log(err);
                callback();
                return;
            }
            console.log('Task marked as failed');
            context.succeed("Done");
            callback();
        });
    }

    var markSuccess = function(job, callback) {
        var params = {
            jobId: job.id,
            currentRevision: {
                changeIdentifier: '1',
                revision: '1'
            },
            executionDetails: {
                externalExecutionId: '1',
                percentComplete: 100,
                summary: 'Deployed to OpsWorks'
            }
        };
        codepipeline.putJobSuccessResult(params, function(err, data) {
            if (err) {
                console.log('Marking done failed.');
                console.log(err);
                callback();
                return;
            }
            console.log('Task marked as succeeded');
            callback();
        });
    }

    var publishMonitorMessage = function(job, deployment, callback) {

        var message = JSON.stringify({
            Action: 'monitorJob',
            DeploymentId: deployment.DeploymentId,
            jobId: job.id
        });

        var params = {
            Message: message,
            MessageStructure: 'json',
            Subject: 'Monitor OpsWorks Deployment',
            TargetArn: monitorARN
        };
        sns.publish(params, function(err, data) {
            if(err) {
                console.log('Could not publish to monitoring topic.');
                console.log(err);
                markFail(job, 'Could not publish to monitoring topic.', callback);
                return;
            }
            console.log('Published to monitoring topic');
            callback();
        });
    }

    var getLayerInstances = function(job, callback) {
        var params = {
            StackId: stackID
        };
        opsworks.describeInstances(params, function(err, data) {
            if(err) {
                console.log('Could not list instances.');
                console.log(err);
                markFail(job, 'Could not list instances.', callback);
                return;
            }

            var returnArr = [];

            data.Instances.forEach(function(item) {
                returnArr.push(item.InstanceId);
            });

            callback(returnArr);
        });
    }

    var deployOpsworks = function(job, callback) {
        getLayerInstances(job, function(instances) {
            opsworks.createDeployment({
                Command: {
                    Name : 'deploy'
                },
                StackId: stackID,
                AppId: appID,
                InstanceIds: instances
            }, function(err, data) {
                if(err) {
                    console.log('Deployment to OpsWorks failed.');
                    console.log(err);
                    markFail(job, 'Deploying to OpsWorks failed.', callback);
                    return;
                }
                console.log('OpsWorks deployment triggered.');
                publishMonitorMessage(job, data, callback);
            });
        });
    }

    var copyArtifact = function (jobS3) {
        return function (artifact, callback) {
            var artifactBucket = artifact.location.s3Location.bucketName;
            var artifactKey = artifact.location.s3Location.objectKey;
            var artifactName = artifact.name;

            jobS3.getObject({
                Bucket: artifactBucket,
                Key: artifactKey
            }, function (err, data) {
                if (err) {
                    console.log(err);
                    callback(err);
                    return;
                }

                var body = data.Body;
                var artifactKey = artifactName + '.zip';
                s3.putObject({
                    Bucket: destinationBucket,
                    Key: artifactKey,
                    Body: body
                }, function (err, data) {
                    if (err) {
                        console.log('Upload error: ' + err);
                        callback(err);
                        return;
                    }
                    console.log('Uploaded ' + artifactKey);
                    callback();
                });
            });
        }
    }

    var ackJob = function (job, callback) {
        codepipeline.acknowledgeJob({
            jobId: job.id,
            nonce: job.nonce
        }, function (err, data) {
            if (err) {
                console.log('Job ack failed.');
                console.log(err);
            }
            callback();
        });
    }

    var handleArtifacts = function (job, jobS3, callback) {
        async.each(job.data.inputArtifacts, copyArtifact(jobS3), function (err) {
            if (err) {
                console.log(err);
            }
            callback();
        });
    }

    var dispatchJob = function (job, callback) {
        var credentials = job.data.artifactCredentials;
        var jobS3 = new AWS.S3({
            signatureVersion: 'v4',
            credentials: credentials
        });

        async.series([
                function (callback) {
                    ackJob(job, callback);
                },
                function (callback) {
                    handleArtifacts(job, jobS3, callback);
                },
                function (callback) {
                    deployOpsworks(job, callback);
                },
                function (callback) {
                    markSuccess(job, callback);
                }
            ],
            function (err, results) {
                callback();
            }
        );
    }

    var pollResults = function (err, data) {
        if (err) {
            console.log(err);
            context.fail("Could not poll results");
            return;
        }

        console.log(data);

        console.log(data.jobs.length + " jobs waiting.");
        async.each(data.jobs, dispatchJob, function (err) {
            if (err) {
                console.log(err);
            }
            context.succeed("Done");
        });
    }

    codepipeline.pollForJobs({
        actionTypeId: {
            category: 'Build',
            owner: 'Custom',
            provider: buildProvider,
            version: '1'
        },
        maxBatchSize: 1
    }, pollResults);

};