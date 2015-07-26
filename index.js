console.log('Loading function');

var actions = {
    handleJob: require('./lib/handle_job.js'),
    monitorJob: require('./lib/monitor_job.js')
};

exports.handler = function (event, context) {
    var message = JSON.parse(event.Records[0].Sns.Message);
    if(typeof message.Action != undefined && typeof message.Action == 'monitorJob') {
        actions.monitorJob(message, context);
    } else {
        actions.handleJob(message, context);
    }
}