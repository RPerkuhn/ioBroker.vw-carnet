'use strict';
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('vw-carnet');

let VWCarNet_Connected = false;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        VWCarNet_Connected = false
        adapter.setState('info.connection', {val: VWCarNet_Connected}); //connection to Threema gateway not established
        adapter.log.info('VW CarNet adater stopped - cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// Some message was sent to adapter instance over message box.
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // sendto command 'send' received
        }
    }
});

// start here!
adapter.on('ready', function () {
    VWCarNetCheckConnect()
    main();
});

function main() {

    adapter.setState('info.connection', {val: VWCarNet_Connected});
    adapter.log.info('Connecion to VW car-net: ');

/*
    adapter.setObject('testVariable', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'boolean',
            role: 'indicator'
        },
        native: {}
    });
*/

}

function VWCarNetCheckConnect() {
    VWCarNet_Connected=true
}