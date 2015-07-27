
var AWS = require('aws-sdk');

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
var exp = {};

exp.codepipeline = new AWS.CodePipeline();
exp.opsworks = new AWS.OpsWorks();
exp.s3 = new AWS.S3({
    signatureVersion: 'v4'
});
exp.sns = new AWS.SNS();

module.exports = exp;