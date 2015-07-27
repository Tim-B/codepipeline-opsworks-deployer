console.log('Loading function');

var actions = {
    handleJob: require('./lib/handle_job.js'),
    monitorJob: require('./lib/monitor_job.js')
};

exports.handler = function (event, context) {
    var message = JSON.parse(event.Records[0].Sns.Message);
    if(typeof message.Action == 'undefined') {
        message.Action = 'handleJob';
    }

    if(typeof actions[message.Action] != 'undefined') {
        actions[message.Action](message, context);
    }
}