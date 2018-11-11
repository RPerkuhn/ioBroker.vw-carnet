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

// declaring names for states for currentVehicle data
const state_v_channel = "Vehicle"
const state_v_name = "Vehicle.name"
const state_v_channelSelected = "Vehicle.currentVehicle"
const state_v_lastConnectionTimeStamp   = "Vehicle.currentVehicle.lastConnectionTimeStamp";
const state_v_distanceCovered     = "Vehicle.currentVehicle.distanceCovered";
const state_v_range  = "Vehicle.currentVehicle.range";
const state_v_serviceInspectionData= "Vehicle.currentVehicle.serviceInspectionData";
const state_v_oilInspectionData= "Vehicle.currentVehicle.oilInspectionData";

// creating states for currentVehicle Data
adapter.setObject(state_v_channel, {
    type: 'channel',
    common: {},
    native: {}
});

adapter.setObject(state_v_name, {
    type: 'state',
    common: {
        name: 'Name des Fahrzeugs in VW Car-Net',
        type: 'string',
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_v_channelSelected, {
    type: 'channel',
    common: {},
    native: {}
});
adapter.setObject(state_v_lastConnectionTimeStamp, {
    type: 'state',
    common: {
        name: 'Zeitpunkt der letzten Verbindung zum Fahrzeug',
        type: 'string',
        read: true,
        write: false,
        role: "datetime"
    },
    native: {}
});
adapter.setObject(state_v_distanceCovered, {
    type: 'state',
    common: {
        name: 'Kilomaterstand',
        type: 'number',
        read: true,
        write: false,
        unit: "km",
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_v_range, {
    type: 'state',
    common: {
        name: 'Gesamtreichweite des Fahrzeugs',
        type: 'number',
        read: true,
        write: false,
        unit: "km",
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_v_serviceInspectionData, {
    type: 'state',
    common: {
        name: 'Nächste Inspektion',
        type: 'string',
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_v_oilInspectionData, {
    type: 'state',
    common: {
        name: 'Nächster Ölwechsel-Service',
        type: 'string',
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});

// start here!
adapter.on('ready', function () {
    VWCarNetCheckConnect()
    main();
});

function main() {
	let my_password = decrypt(my_key, adapter.config.password);



    //Set adapter connected status online when login credentials are correct
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