var async = require('async');
var jobHelper = require('./job_functions.js');
var SDKs = require('./aws_sdks.js');
var opsworks = SDKs.opsworks;
var jobHelper = require('./job_functions.js');

module.exports = function (message, context) {

    var deployID = message.DeploymentId;

    var getDeployStatus = function (deployID, callback) {
        var params = {
            DeploymentIds: [deployID]
        };
        opsworks.describeDeployments(params, function (err, data) {
            if (err) {
                console.log('Could not check deploy status.');
                console.log(err);
                jobHelper.markFail(job, 'Could not check deploy statusc.', callback);
                return;
            }

            if (data.Deployments.length > 0) {
                var deployStatus = data.Deployments[0].Status;
                switch (deployStatus) {
                    case 'successful':
                        console.log('Deploy succeeded');
                        jobHelper.markSuccess(message.Job, callback);
                        break;
                    case 'failed':
                        console.log('Deploy failed');
                        jobHelper.markFail(message.Job, 'OpsWorks deploy failed', callback);
                        break;
                    default:
                        console.log('Deploy still running');
                        context.fail("Still waiting");
                        return;
                }
            } else {
                callback();
            }
        });
    }

    getDeployStatus(deployID, function () {
        context.succeed("Status updated");
    });

}