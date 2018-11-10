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

var request = require('request');

var base      = "https://www.volkswagen-car-net.com";
var authbase  = "https://security.volkswagen.com";
var csrf      = "";
var refUrl    = "";
var viewState = "";
var cookieJar = null;
var urlHeader = null;
var code      = "";
var state     = "";
var unterwegs = "unterwegs - zuletzt:";
var email     = "#####"; // User Car-Net-Account
var password  = "#####"; // Passwort Car-Net-Account
var mapsApiKey= "";                       // API-Key für Google Maps Platform (noch optional)
var errCount  = 0;  // Anzahl zulässige Fehler bis Mail verschickt wird
var defaultHeader = {
    'Accept': 'application/json, text/plain, */*',
	'Content-Type': 'application/json;charset=UTF-8',
	'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; D5803 Build/23.5.A.1.291; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/63.0.3239.111 Mobile Safari/537.36'
};
var stateBatterieProz = "emanager.batteryPercentage";
var stateLadevorgang  = "emanager.chargingState";
var stateLadedauer    = "emanager.chargingRemaining";
var stateReichweite   = "emanager.electricRange";
var stateMinLadung    = "emanager.minChargeLimit";
var stateletzteVerb   = "vehicle.lastConnectionTimeStamp";
var stateGesamtKm     = "vehicle.distanceCovered";
var stateReichweiteV  = "vehicle.range";
var stateServiceTermin= "vehicle.serviceInspectionData";
var statePosBreite    = "location.lat";
var statePosLaenge    = "location.lng";
var statePosAdresse   = "location.address";

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