'use strict';
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('vw-carnet');
const my_key = 'Zgfr56gFe87jJOM'

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
	let my_password = decrypt(my_key, adapter.config.password);
    adapter.setState('info.connection', {val: VWCarNet_Connected});
    //adapter.log.info('Connecion to VW car-net: ' + adapter.config.password + ' - ' + my_password);

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

function decrypt(key, value) {
	var result = '';
	for(var i = 0; i < value.length; i++) {
		result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
	}
	return result;
}


function VWCarNetCheckConnect() {
    VWCarNet_Connected=true
}