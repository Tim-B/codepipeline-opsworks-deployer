var buildProvider = 'OpsWorks-Via-Lambda';
var monitorARN = 'arn:aws:sns:us-east-1:608866947342:test';

var AWS = require('aws-sdk');
var async = require('async');
var jobHelper = require('./job_functions.js');
var SDKs = require('./aws_sdks.js');

module.exports = function (message, topicARN, minsElapsed, context) {

    var key = message.Records[0].s3.object.key;
    var bucket = message.Records[0].s3.bucket.name;

    var codepipeline = SDKs.codepipeline;
    var s3 = SDKs.s3;
    var opsworks = SDKs.opsworks;
    var sns = SDKs.sns;

    var publishMonitorMessage = function(job, deployment, callback) {

        var message = JSON.stringify({
            Action: 'monitorJob',
            DeploymentId: deployment.DeploymentId,
            Job: job
        });

        var params = {
            Message: message,
            Subject: 'Monitor OpsWorks Deployment',
            TargetArn: monitorARN
        };
        sns.publish(params, function(err, data) {
            if(err) {
                console.log('Could not publish to monitoring topic.');
                console.log(err);
                jobHelper.markFail(job, 'Could not publish to monitoring topic.', callback);
                return;
            }
            console.log('Published to monitoring topic');
            callback();
        });
    }

    var getLayerInstances = function(job, stackID, callback) {
        var params = {
            StackId: stackID
        };
        opsworks.describeInstances(params, function(err, data) {
            if(err) {
                console.log('Could not list instances.');
                console.log(err);
                jobHelper.markFail(job, 'Could not list instances.', callback);
                return;
            }

            var returnArr = [];

            data.Instances.forEach(function(item) {
                returnArr.push(item.InstanceId);
            });

            callback(returnArr);
        });
    }

    var deployOpsworks = function(job, actionConfig, callback) {
        getLayerInstances(job, actionConfig['OpsWorks-Stack-ID'], function(instances) {
            opsworks.createDeployment({
                Command: {
                    Name : 'deploy'
                },
                StackId: actionConfig['OpsWorks-Stack-ID'],
                AppId: actionConfig['OpsWorks-App-ID'],
                InstanceIds: instances
            }, function(err, data) {
                if(err) {
                    console.log('Deployment to OpsWorks failed.');
                    console.log(err);
                    jobHelper.markFail(job, 'Deploying to OpsWorks failed.', callback);
                    return;
                }
                console.log('OpsWorks deployment triggered.');
                publishMonitorMessage(job, data, callback);
            });
        });
    }

    var copyArtifact = function (jobS3, actionConfig) {
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
                    Bucket: actionConfig['Deploy-Bucket'],
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

    var handleArtifacts = function (job, jobS3, actionConfig, callback) {
        async.each(job.data.inputArtifacts, copyArtifact(jobS3, actionConfig), function (err) {
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
        var actionConfig = job.data.actionConfiguration.configuration;

        async.series([
                function (callback) {
                    ackJob(job, callback);
                },
                function (callback) {
                    handleArtifacts(job, jobS3, actionConfig, callback);
                },
                function (callback) {
                    deployOpsworks(job, actionConfig, callback);
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

        console.log(data.jobs.length + " jobs waiting.");
        async.each(data.jobs, dispatchJob, function (err) {
            if (err) {
                console.log(err);
            }

            if(data.jobs.length === 0) {
                context.fail("No messages");
            } else {
                context.succeed("Done");
            }
        });
    }

    codepipeline.pollForJobs({
        actionTypeId: {
            category: 'Deploy',
            owner: 'Custom',
            provider: buildProvider,
            version: '1'
        },
        maxBatchSize: 1
    }, pollResults);

};