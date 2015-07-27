var grunt = require('grunt');
grunt.loadNpmTasks('grunt-aws-lambda');

grunt.initConfig({
    lambda_invoke: {
        default: {
            options: {
                event: 'event_handle.json'
            }
        },
        monitor: {
            options: {
                event: 'event_monitor.json'
            }
        }
    },
    lambda_deploy: {
        default: {
            arn: 'arn:aws:lambda:us-east-1:608866947342:function:codepipeline-to-opsworks'
        }
    },
    lambda_package: {
        default: {
        }
    }
});

grunt.registerTask('deploy', ['lambda_package', 'lambda_deploy']);
grunt.registerTask('lambda_invoke_monitor', ['lambda_invoke:monitor']);