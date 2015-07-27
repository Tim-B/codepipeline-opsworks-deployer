var SDKs = require('./aws_sdks.js');

var codepipeline = SDKs.codepipeline;

var exp = {};

exp.markFail = function(job, message, callback) {
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
        callback();
    });
}

exp.markSuccess = function(job, callback) {
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

module.exports = exp;