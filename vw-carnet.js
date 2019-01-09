//version 0.1.6

/*jshint esversion: 6 */
/*jshint sub:true*/

// 'use strict';
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('vw-carnet');

const my_key = 'Zgfr56gFe87jJOM';

//var ioBroker_Settings
var ioBroker_Language = 'en';

adapter.getForeignObject('system.config', function(err, ioBroker_Settings) {
    if (err) {

    } else {
        //ioBroker_Language = ioBroker_Settings.common.language;
        switch (ioBroker_Settings.common.language){
            case 'de':
                ioBroker_Language = 'de';
                break;
            default:
                ioBroker_Language = 'en';
        }
    }
});

var VWCarNet_CredentialsAreValid = false;
var VWCarNet_VINIsValid = false;
var VWCarNet_Connected = false;
var myLastCarNetAnswer = '';
var VWCarNet_GetClimater = true;
var VWCarNet_GetEManager = true;
var VWCarNet_GetLocation = true;
var myCarNetDoors={'doors':'dummy'};
var myCarNetWindows={'windows':'dummy'};
var myLoggingEnabled=false;

var myToken = '';
var myVIN = '';
var myTmp;

var request = require('request');

// Fake the VW CarNet mobile app headers
var myHeaders = { 'Accept': 'application/json',
    'X-App-Name': 'eRemote',
    'X-App-Version': '4.6.1',
    'User-Agent': 'okhttp/2.3.0' };
var myAuthHeaders = myHeaders;

var myGoogleMapsAPIKey = '';
var myGoogleDefaulHeader = {
    'Accept': 'application/json, ' + 'text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; D5803 Build/23.5.A.1.291; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/63.0.3239.111 Mobile Safari/537.36'};

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        VWCarNet_Connected = false;
        adapter.setState('connection', {val: VWCarNet_Connected, ack: true}); //connection to Threema gateway not established
        adapter.log.info('VW CarNet adapter stopped - cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// Some message was sent to adapter instance over message box.
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        adapter.log.info('Received message in VW CarNet adapter :' + obj.command);
        if (obj.command === 'update') {
            VWCarNetReadData(); // sendto command 'update' received
        }
        if (obj.command === 'activateLogging') {
            myLoggingEnabled=true;
            adapter.log.info('Logging mode activated');
        }
        if (obj.command === 'deactivateLogging') {
            myLoggingEnabled=false;
            adapter.log.info('Logging mode deactivated');
        }
        if (obj.command === 'CarSendData') {
            VWCarNetForceCarToSendData(); // sendto command 'update' received
        }
    }
});

adapter.on('ready', function () {
    var myTmp;
    //adapter.log.info(ioBroker_Language)
    CreateStates_common(function(myTmp){});
    myGoogleMapsAPIKey = adapter.config.GoogleAPIKey;
    VWCarNet_GetClimater = adapter.config.adapterGetClimater;
    VWCarNet_GetEManager = adapter.config.adapterGetEManager;
    VWCarNet_GetLocation = adapter.config.adapterGetLocation;
    CreateStates_Status(function(myTmp){});
    CreateStates_climater(function(myTmp){});
    CreateStates_eManager(function(myTmp){});
    CreateStates_location(function(myTmp){});
    main();
});

//##############################################################################################################
// declaring names for states for Vehicle data
const channel_v = {'label':'Vehicle', 'en':'selected vehicle', 'de':'Fahrzeug'};
const state_v_name = {'label':'Vehicle.name', 'en':'name in VW Car-Net', 'de':'Name des Fahrzeuges in VW Car-Net'};
const state_v_VIN = {'label':'Vehicle.VIN', 'en':'vehicle identification number', 'de':'Fahrgestellnummer'};

//##############################################################################################################
// declaring names for states for status data
const channel_s = {'label':'Vehicle.Status', 'en': 'Status of vehicle', 'de': 'Fahrzeugstatus'};
const state_s_lastConnectionTimeStamp   = {'label':'Vehicle.Status.lastConnectionTimeStamp', 'en': 'Last connection timestamp', 'de': 'Zeitpunkt der letzten Verbindung'};
const state_s_distanceCovered     = {'label':'Vehicle.Status.distanceCovered', 'en': 'Distance covered', 'de': 'Kilometerstand'};
const state_s_hybridRange  = {'label':'Vehicle.Status.hybridRange', 'en': 'total range', 'de': 'Gesamtreichweite'};
const state_s_serviceInspectionDistance= {'label':'Vehicle.Status.serviceInspectionDistance', 'en': 'Distance until next service inspection', 'de': 'Entfernung bis zur nächsten Inspektion'};
const state_s_serviceInspectionTime= {'label':'Vehicle.Status.serviceInspectionTime', 'en': 'Time until next service inspecton', 'de': 'Zeit bis zur nächsten Inspektion', 'unit_de':'Tag(e)', 'unit_en':'day(s)'};
const state_s_oilInspectionDistance= {'label':'Vehicle.Status.oilInspectionDistance', 'en': 'Distance until next oil inspection', 'de': 'Entfernung bis zum nächsten Ölwechsel'};
const state_s_oilInspectionTime= {'label':'Vehicle.Status.oilInspectionTime', 'en': 'Time until next oil inspecton', 'de': 'Zeit bis zum nächsten Ölwechsel', 'unit_de':'Tag(e)', 'unit_en':'day(s)'};
const state_s_adBlueInspectionDistance= {'label':'Vehicle.Status.adBlueInspectionDistance', 'en': 'Distance until next ad blue inspection', 'de': 'Entfernung bis zur nächsten AdBlue-Füllung'};
const state_s_parkingLights = {'label':'Vehicle.Status.ParkingLights', 'en': 'Parking lights', 'de': 'Parklichter / Standlicht'};
const state_s_parkingBrake = {'label':'Vehicle.Status.ParkingBrake', 'en': 'Parking brake', 'de': 'Parkbremse'};
const state_s_carCentralLock = {'label':'Vehicle.Status.CentralLock', 'en': 'Central lock', 'de': 'Zentralverriegelung'};
const state_s_fuelType  = {'label':'Vehicle.Status.fuelType', 'en': 'Motor type', 'de': 'Kraftstoff-Typ'}; // XXX
const state_s_fuelLevel = {'label':'Vehicle.Status.fuelLevel', 'en': 'fuel level', 'de': 'Kraftstoff-Füllstand'};
const state_s_fuelRange = {'label':'Vehicle.Status.fuelRange', 'en': 'fuel range', 'de': 'Kraftstoff-Reichweite'};
const state_s_batteryLevel = {'label':'Vehicle.Status.batteryLevel', 'en': 'battery level', 'de': 'Batterie-Füllstand'};
const state_s_batteryRange = {'label':'Vehicle.Status.batteryRange', 'en': 'battery range', 'de': 'Batterie-Reicheweite'};
const channel_dw_DoorsAndWindows = {'label':'Vehicle.Status.DoorsAndWindows', 'en': 'doors and windows', 'de': 'Türen und Fenster'};
const state_dw_Doors = {'label':'Vehicle.Status.DoorsAndWindows.doorsJSON', 'en': 'JSON objekt with windowstates', 'de': 'JSON Objekt Status Türen'};
const state_dw_Windows = {'label':'Vehicle.Status.DoorsAndWindows.windowsJSON', 'en': 'JSON object with doorstates', 'de': 'JSON Objekt Status Fenster'};

//##############################################################################################################
// declaring names for states for climater data
const channel_c = {'label':'Vehicle.climater', 'en': 'heating / air condition / climater', 'de': 'Heizung / Klimaanlage / Lüftung'};
const state_c_climatisationWithoutHVPower = {'label':'Vehicle.climater.climatisationWithoutHVPower', 'en': 'Allow air condition in e-mode', 'de': 'Klimaanlage über Batterie zulassen'};
const state_c_targetTemperature = {'label':'Vehicle.climater.targetTemperature', 'en': 'Target temperature', 'de': 'Zieltemperatur'};
const state_c_heaterSource = {'label':'Vehicle.climater.heaterSource', 'en': 'Heater source', 'de': 'Heizungs-Quelle'};
const state_c_climatisationReason = {'label':'Vehicle.climater.climatisationReason', 'en': 'Climatisation reason', 'de': 'Heizungsbetrieb'};
const state_c_windowHeatingStateFront = {'label':'Vehicle.climater.windowHeatingStateFront', 'en': 'State of window heating front', 'de': 'Zustand der Windschutzscheibenheizung'};
const state_c_windowHeatingStateRear = {'label':'Vehicle.climater.windowHeatingStateRear', 'en': 'State of window heating rear', 'de': 'Zustand der Heckscheibenheizung'};
const state_c_outdoorTemperature = {'label':'Vehicle.climater.outdoorTemperature', 'en': 'Outdoor temperature', 'de': 'Außentemperatur'};
const state_c_vehicleParkingClock = {'label':'Vehicle.climater.vehicleParkingClock', 'en': 'Parking timestamp', 'de': 'Parkzeit'};
const state_c_climatisationState = {'label':'Vehicle.climater.climatisationState', 'en': 'State of climatisation', 'de': 'Zustand der Standheizung'};
const state_c_remainingClimatisationTime = {'label':'Vehicle.climater.remainingClimatisationTime', 'en': 'Remaining climatisation time', 'de': 'Verbleibende Dauer bis Zieltemperatur'};

//##############################################################################################################
// declaring names for states for eManager data
const channel_e = {'label':'Vehicle.eManager', 'en': 'e-manager', 'de': 'e-Manager'};
const state_e_stateOfCharge = {'label':'Vehicle.eManager.stateOfCharge', 'en': 'Charging state main battery', 'de': 'Ladezustand der Hauptbatterie'};
const state_e_remainingChargingTimeTargetSOC = {'label':'Vehicle.eManager.remainingChargingTimeTargetSOC', 'en': 'Remaining charging time until SOC', 'de': 'Verbleibende Ladedauer untere Batterie-Ladegrenze'};
const state_e_chargingMode = {'label':'Vehicle.eManager.chargingMode', 'en': 'Charging mode', 'de': 'Lademodus'};
const state_e_chargingState = {'label':'Vehicle.eManager.chargingState', 'en': 'Charging state', 'de': 'Zustand des Ladevorgangs'};
const state_e_chargingReason = {'label':'Vehicle.eManager.chargingReason', 'en': 'Charging reason', 'de': 'Ladebetrieb'};
const state_e_remainingChargingTime = {'label':'Vehicle.eManager.remainingChargingTime', 'en': 'Remaining charging time until 100%', 'de': 'Verbleibende Ladedauer bis 100%'};
const state_e_maxChargeCurrent = {'label':'Vehicle.eManager.maxChargeCurrent', 'en': 'Maximun charging current', 'de': 'Maximaler Ladestrom'};
const state_e_plugState = {'label':'Vehicle.eManager.plugState', 'en': 'Charging cable plugged', 'de': 'Status Ladestecker'};
const state_e_lockState = {'label':'Vehicle.eManager.lockState', 'en': 'Charging cable locked', 'de': 'Verriegelung Ladestecker'};
const state_e_extPowerSupplyState = {'label':'Vehicle.eManager.externalPowerSupplyState', 'en': 'External power supply state', 'de': 'Status externe Stromversorgung'};

//##############################################################################################################
// declaring names for states for location data
const channel_l = {'label':'Vehicle.location', 'en': 'Location', 'de': 'Ortungsdaten Fahrzeug'};
const state_l_lat = {'label':'Vehicle.location.latitude', 'en': 'Latitude', 'de': 'Breitengrad'};
const state_l_lng = {'label':'Vehicle.location.longitude', 'en': 'Longitude', 'de': 'Längengrad'};
const state_l_parkingTime = {'label':'Vehicle.location.parkingTimeUTC', 'en': 'Parking timestamp', 'de': 'Parkzeit'};
const state_l_address = {'label':'Vehicle.location.parkingAddress', 'en': 'Parking address', 'de': 'Parkadresse'};

function CreateStates_common(callback){
    // creating channel/states for Vehicle Data
    adapter.setObject(channel_v.label, {
        type: 'object',
        common: {name: channel_v[ioBroker_Language]},
        native: {}
    });
    adapter.setObject(state_v_name.label, {
        type: 'state',
        common: {name: state_v_name[ioBroker_Language], type: 'string', read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_v_VIN.label, {
        type: 'state',
        common: {name: state_v_VIN[ioBroker_Language], type: 'string', read: true, write: false, role: 'value'},
        native: {}
    });
    return callback(true);
}


function CreateStates_Status(callback){
    // creating channel/states for selectedVehicle Data
    adapter.setObject(channel_s.label, {
        type: 'channel',
        common: {name: channel_s[ioBroker_Language]},
        native: {}
    });
    adapter.setObject(state_s_lastConnectionTimeStamp.label, {
        type: 'state',
        common: {name: state_s_lastConnectionTimeStamp[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime'},
        native: {}
    });
    adapter.setObject(state_s_distanceCovered.label, {
        type: 'state',
        common: {name: state_s_distanceCovered[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value'},
        native: {}
    });

    adapter.setObject(state_s_hybridRange.label, {
        type: 'state',
        common: {name: state_s_hybridRange[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_serviceInspectionDistance.label, {
        type: 'state',
        common: {name: state_s_serviceInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_serviceInspectionTime.label, {
        type: 'state',
        common: {name: state_s_serviceInspectionTime[ioBroker_Language], type: 'number', unit: state_s_serviceInspectionTime['unit_' + ioBroker_Language], read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_adBlueInspectionDistance.label, {
        type: 'state',
        common: {name: state_s_adBlueInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_oilInspectionDistance.label, {
        type: 'state',
        common: {name: state_s_oilInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_oilInspectionTime.label, {
        type: 'state',
        common: {name: state_s_oilInspectionTime[ioBroker_Language], type: 'number', unit: state_s_oilInspectionTime['unit_' + ioBroker_Language], read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_parkingLights.label, {
        type: 'state',
        common: {name: state_s_parkingLights[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_parkingBrake.label, {
        type: 'state',
        common: {name: state_s_parkingBrake[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_carCentralLock.label, {
        type: 'state',
        common: {name: state_s_carCentralLock[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_fuelType.label, {
        type: 'state',
        common: {name: state_s_fuelType[ioBroker_Language], type: 'string', read: true, write: false, def: '', role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_fuelLevel.label, {
        type: 'state',
        common: {name: state_s_fuelLevel[ioBroker_Language], type: "number", unit: "%", read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_fuelRange.label, {
        type: 'state',
        common: {name: state_s_fuelRange[ioBroker_Language], type: "number", unit: "km", read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_batteryLevel.label, {
        type: 'state',
        common: {name: state_s_batteryLevel[ioBroker_Language], type: "number", unit: "%", read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_batteryRange.label, {
        type: 'state',
        common: {name: state_s_batteryRange[ioBroker_Language], type: "number", unit: "km", read: true, write: false, def: 0, role: 'value'},
        native: {}
    });
    adapter.setObject(channel_dw_DoorsAndWindows.label, {
        type: 'channel',
        common: {name: channel_dw_DoorsAndWindows[ioBroker_Language]},
        native: {}
    });
    adapter.setObject(state_dw_Doors.label, {
        type: 'state',
        common: {name: state_dw_Doors[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_dw_Windows.label, {
        type: 'state',
        common: {name: state_dw_Windows[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    return callback(true);
}

function CreateStates_climater(callback){
    if (VWCarNet_GetClimater === false){
        return callback(true);
    }
    // creating channel/states for climater Data
    adapter.setObject(channel_c.label, {
        type: 'channel',
        common: {name: channel_c[ioBroker_Language]},
        native: {}
    });
    adapter.setObject(state_c_climatisationWithoutHVPower.label, {
        type: 'state',
        common: {name: state_c_climatisationWithoutHVPower[ioBroker_Language], type: "boolean", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_targetTemperature.label, {
        type: 'state',
        common: {name: state_c_targetTemperature[ioBroker_Language], type: "number", unit: "°C", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_heaterSource.label, {
        type: 'state',
        common: {name: state_c_heaterSource[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_climatisationReason.label, {
        type: 'state',
        common: {name: state_c_climatisationReason[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_windowHeatingStateFront.label, {
        type: 'state',
        common: {name: state_c_windowHeatingStateFront[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_windowHeatingStateRear.label, {
        type: 'state',
        common: {name: state_c_windowHeatingStateRear[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_outdoorTemperature.label, {
        type: 'state',
        common: {name: state_c_outdoorTemperature[ioBroker_Language], type: "number", unit: "°C", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_vehicleParkingClock.label, {
        type: 'state',
        common: {name: state_c_vehicleParkingClock[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime'},
        native: {}
    });
    adapter.setObject(state_c_climatisationState.label, {
        type: 'state',
        common: {name: state_c_climatisationState[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_c_remainingClimatisationTime.label, {
        type: 'state',
        common: {name: state_c_remainingClimatisationTime[ioBroker_Language], type: "number", unit: "Min", read: true, write: false, role: 'value'},
        native: {}
    });
    return callback(true);
}

function CreateStates_eManager(callback){
    if (VWCarNet_GetEManager === false){
        return callback(true);
    }
    // creating channel/states for eManager Data
    adapter.setObject(channel_e.label, {
        type: 'channel',
        common: {name: channel_e[ioBroker_Language]},
        native: {}
    });
    adapter.setObject(state_e_stateOfCharge.label, {
        type: 'state',
        common: {name: state_e_stateOfCharge[ioBroker_Language], type: "number", unit: "%", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_remainingChargingTimeTargetSOC.label, {
        type: 'state',
        common: {name: state_e_remainingChargingTimeTargetSOC[ioBroker_Language], type: "number", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_chargingMode.label, {
        type: 'state',
        common: {name: state_e_chargingMode[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_chargingState.label, {
        type: 'state',
        common: {name: state_e_chargingState[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_chargingReason.label, {
        type: 'state',
        common: {name: state_e_chargingReason[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_remainingChargingTime.label, {
        type: 'state',
        common: {name: state_e_remainingChargingTime[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_maxChargeCurrent.label, {
        type: 'state',
        common: {name: state_e_maxChargeCurrent[ioBroker_Language], type: "number", unit: "A", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_plugState.label, {
        type: 'state',
        common: {name: state_e_plugState[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_lockState.label, {
        type: 'state',
        common: {name: state_e_lockState[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_e_extPowerSupplyState.label, {
        type: 'state',
        common: {name: state_e_extPowerSupplyState[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    return callback(true);
}

function CreateStates_location(callback){
    if (VWCarNet_GetLocation === false){
        return callback(true);
    }
    // creating channel/states for location Data
    adapter.setObject(channel_l.label, {
        type: 'channel',
        common: {name: channel_l[ioBroker_Language]},
        native: {}
    });
    adapter.setObject(state_l_lat.label, {
        type: 'state',
        common: {name: state_l_lat[ioBroker_Language], type: "number", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_l_lng.label, {
        type: 'state',
        common: {name: state_l_lng[ioBroker_Language], type: "number", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_l_parkingTime.label, {
        type: 'state',
        common: {name: state_l_parkingTime[ioBroker_Language], type: "string", read: true, write: false, role: 'datetime'},
        native: {}
    });
    if (myGoogleMapsAPIKey !== '') {
        adapter.setObject(state_l_address.label, {
            type: 'state',
            common: {name: state_l_address[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
            native: {}
        });
    }
    return callback(true);
}

// ############################################# start here! ###################################################

function main() {
    CarNetLogon(function(myTmp){
        VWCarNet_CredentialsAreValid=myTmp;
        myCarNetDoors['FL']={'closed':false,'locked':true,'safe':false};
        myCarNetDoors['RL']={'closed':false,'locked':true,'safe':false};
        myCarNetDoors['FR']={'closed':false,'locked':true,'safe':false};
        myCarNetDoors['RR']={'closed':false,'locked':true,'safe':false};
        myCarNetDoors['hood']={'closed':false};
        myCarNetDoors['rear']={'closed':false,'locked':false,};
        delete myCarNetDoors['doors']; //remove dummy entry
        myCarNetWindows['FL']={'closed':false, 'level':0};
        myCarNetWindows['RL']={'closed':false, 'level':0};
        myCarNetWindows['FR']={'closed':false, 'level':0};
        myCarNetWindows['RR']={'closed':false, 'level':0};
        myCarNetWindows['roof']={'closed':false, 'level':0};
        delete myCarNetWindows['windows']; //remove dummy entry
        //adapter.log.info('Credentials valid?: ' +  VWCarNet_CredentialsAreValid);
        if (VWCarNet_CredentialsAreValid){
            //adapter.log.info('Credentials valid - starting adapter')
            RetrieveVehicles(function(myTmp){
                RetrieveVehicleData_VINValid(function(myTmp){
                    VWCarNet_VINIsValid=myTmp;
                    if (myLoggingEnabled) { adapter.log.info('VIN valid?: ' + VWCarNet_VINIsValid); }
                    VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
                    adapter.setState('connection', {val: VWCarNet_Connected, ack: true});
                    if(VWCarNet_VINIsValid){
                        var mySuccefulUpdate = true;
                        adapter.setState(state_v_VIN.label, {val: myVIN, ack: true});
                    } else {
                        adapter.setState(state_v_VIN.label, {val: '', ack: true});
                    }
                    if (VWCarNet_Connected){
                        RetrieveVehicleData_Status(function(myTmp){
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp;
                        });

                        RetrieveVehicleData_Location(function(myTmp){
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp;
                        });

                        RetrieveVehicleData_eManager(function(myTmp) {
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp;
                        });

                        RetrieveVehicleData_Climater(function(myTmp){
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp;
                        });

                    }
                    //adapter.log.info('VW Car-Net connected?: ' + VWCarNet_Connected);
                    if (mySuccefulUpdate) {
                        var myDate = Date.now();
                        adapter.setState('lastUpdate', {val: myDate, ack: true});
                    };
                });
            });
        }
    });
}

function decrypt(key, value) {
    var result = '';
    for(var i = 0; i < value.length; i++) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

String.prototype.Capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};


function VWCarNetReadData(){
    var mySuccefulUpdate = true;
    CarNetLogon(function(myTmp){
        VWCarNet_CredentialsAreValid=myTmp;
        VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
        if (myLoggingEnabled) {adapter.log.info('Are credentials valid: ' + VWCarNet_CredentialsAreValid);}
        if (VWCarNet_Connected){
            RetrieveVehicleData_Status(function(myTmp){
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp;
            });

            RetrieveVehicleData_Location(function(myTmp){
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp;
            });

            RetrieveVehicleData_eManager(function(myTmp) {
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp;
            });

            RetrieveVehicleData_Climater(function(myTmp){
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp;
            });

            //adapter.log.info(myLastCarNetAnswer);
            if (mySuccefulUpdate){
                var myDate = Date.now();
                adapter.setState('lastUpdate', {val: myDate, ack: true});
            }
        }
    });
}

function VWCarNetForceCarToSendData(){
    var mySuccefulUpdate = true;
    CarNetLogon(function(myTmp){
        VWCarNet_CredentialsAreValid=myTmp;
        VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
        //adapter.log.info(VWCarNet_CredentialsAreValid);
        if (VWCarNet_Connected){
            requestCarSendData2CarNet(function(myTmp){
                //adapter.log.info(myTmp);
                // mySuccefulUpdate = mySuccefulUpdate && myTmp
            });
        }
    });
}

function CarNetLogon(callback) { //retrieve Token for the respective user
    var responseData;
    var myConnected=false;
    var myUrl = 'https://msg.volkswagen.de/fs-car/core/auth/v1/VW/DE/token';
    var myFormdata = {'grant_type': 'password',
        'username': adapter.config.email,
        'password': adapter.config.password};
    //'password': decrypt(my_key, adapter.config.password)};
    request.post({url: myUrl, form: myFormdata, headers: myHeaders, json: true}, function(error, response, responseData){
        //adapter.log.info(response.statusCode);
        switch(response.statusCode){
            case 200:
                //adapter.log.info("Answer fom Car-Net: 200 - connection successful");
                myConnected=true;  //connection to VW Car-Net successful established
                myLastCarNetAnswer='200 - connection successful';
                break;
            case 401:
                adapter.log.error("Answer fom Car-Net: 401 - Username or PW are incorrect");
                myConnected=false;  //connection to VW Car-Net not established
                myLastCarNetAnswer='401 - Username or PW are incorrect';
                break;
            default:
                //adapter.log.info("000 - undefined");
                myConnected=false;  //connection to VW Car-Net not established
                myLastCarNetAnswer='Answer fom Car-Net: ' + response.statusCode + ' undefined';
        }
        //responseData = JSON.parse(result);
        myAuthHeaders.Authorization = 'AudiAuth 1 ' + responseData.access_token;
        myToken = responseData.access_token;
        return callback(myConnected);
    });
}

function RetrieveVehicles(callback){ //retrieve VIN of the first vehicle (Fahrgestellnummer)
    var responseData;
    var myVehicleID = 0;
    var myUrl = 'https://msg.volkswagen.de/fs-car/usermanagement/users/v1/VW/DE/vehicles';

    if (VWCarNet_CredentialsAreValid===false){
        return callback('not authenticated');
    }
    if (adapter.config.VIN === ''){
        request.get({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, responseData){
            //adapter.log.debug(JSON.stringify(responseData));
            myVIN = responseData.userVehicles.vehicle[myVehicleID];
            //adapter.log.info(responseData.userVehicles.vehicle.length);
            return callback('Count: ' + responseData.userVehicles.vehicle.length);
        });
    } else {
        myVIN = adapter.config.VIN;
        return callback('default');
    }
}

function RetrieveVehicleData_VINValid(callback){
    var responseData;
    var myVINIsValid=false;
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/VW/DE/vehicles/' + myVIN + '/status';
    request.get({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, responseData){
        //adapter.log.info(JSON.stringify(responseData));
        //adapter.log.info(response.statusCode);
        try {
            //adapter.log.info(responseData.StoredVehicleDataResponse.vin);
            if(responseData.StoredVehicleDataResponse.vin===myVIN){
                return callback(true);
            }
        }
        catch (ex) {
            adapter.log.error(responseData.error.errorCode + ': ' + responseData.error.description);
            return callback(false);
        }
    });
}

function RetrieveVehicleData_Status(callback){
    var responseData;
    var myData = 0;
    var myField = 0;
    var myReceivedDataKey;
    var myParkingLight;
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/VW/DE/vehicles/' + myVIN + '/status';
    if (VWCarNet_Connected===false) { return callback(false); }
    try{
        request.get({url: myUrl, headers: myAuthHeaders}, function (error, response, result){
            try {
                responseData = JSON.parse(result);
            } catch (err) {
                adapter.log.error(responseData.error.errorCode + ': ' + responseData.error.description);
                return callback(false);
            }

            if (responseData.error !== undefined) {
                adapter.log.error(JSON.stringify(responseData.error));
                return callback(false);
            }

            // if (myLoggingEnabled) {
            //     responseData.StoredVehicleDataResponse.vin = 'ANONYMIZED_VIN_FOR_LOGGING';
            //     adapter.log.info('received status data:' + JSON.stringify(responseData));
            // }

            var vehicleData = responseData.StoredVehicleDataResponse.vehicleData;
            //adapter.log.info(vehicleData.data[myData].field[myField].tsCarSentUtc);
            adapter.setState(state_s_lastConnectionTimeStamp.label, {val: vehicleData.data[myData].field[myField].tsCarSentUtc, ack: true});

            var vdj = JSON.stringify(vehicleData.data);
            for (myData in vehicleData.data) {
                for (myField in vehicleData.data[myData].field) {
                    myReceivedDataKey = vehicleData.data[myData].field[myField];
                    //adapter.log.info(vehicleData.data[myData].id + "." + vehicleData.data[myData].field[myField].id)
                    switch(vehicleData.data[myData].id + "." + vehicleData.data[myData].field[myField].id){
                        case '0x0101010002.0x0101010002': //distanceCovered
                            adapter.setState(state_s_distanceCovered.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info(myReceivedDataKey.value);
                            break;
                        case '0x0204FFFFFF.0x02040C0001': //adBlueInspectionData_km
                            adapter.setState(state_s_adBlueInspectionDistance.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info(myOilInspectionKm + myReceivedDataKey.unit);
                            break;
                        case '0x0203FFFFFF.0x0203010001': //oilInspectionData_km
                            adapter.setState(state_s_oilInspectionDistance.label, {val: myReceivedDataKey.value *-1, ack: true});
                            //adapter.log.info(myOilInspectionKm + myReceivedDataKey.unit);
                            break;
                        case '0x0203FFFFFF.0x0203010002': //oilInspectionData_days
                            adapter.setState(state_s_oilInspectionTime.label, {val: myReceivedDataKey.value *-1, ack: true});
                            //adapter.log.info(myOilInspectionDays);
                            break;
                        case '0x0203FFFFFF.0x0203010003': //serviceInspectionData_km
                            adapter.setState(state_s_serviceInspectionDistance.label, {val: myReceivedDataKey.value * -1, ack: true});
                            //adapter.log.info(myServiceInspectionKm + myReceivedDataKey.unit);
                            break;
                        case '0x0203FFFFFF.0x0203010004': //serviceInspectionData_days
                            adapter.setState(state_s_serviceInspectionTime.label, {val: myReceivedDataKey.value *-1, ack: true});
                            //adapter.log.info(myServiceInspectionDays);
                            break;
                        case '0x030101FFFF.0x0301010001': //status_parking_light_off
                            //adapter.log.info('ParkingLight: ' + myReceivedDataKey.value);
                            myParkingLight = myReceivedDataKey.value;
                            break;
                        case '0x030103FFFF.0x0301030001': //parking brake
                            adapter.setState(state_s_parkingBrake.label, {val: 'textId' in myReceivedDataKey ? myReceivedDataKey.textId : myReceivedDataKey.value, ack: true});
                            //adapter.log.info('ParkingBrake: ' + myReceivedDataKey.value);
                            break;
                        case '0x030103FFFF.0x0301030007': //fuel type
                            adapter.setState(state_s_fuelType.label, {val: 'textId' in myReceivedDataKey ? myReceivedDataKey.textId.replace('engine_type_','').replace('unsupported','-').Capitalize() : myReceivedDataKey.value, ack: true});
                            //adapter.log.info('PrimaryEngineType: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x030103000A': //fuel level
                            adapter.setState(state_s_fuelLevel.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('FuelLevel: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030006': //fuel range
                            adapter.setState(state_s_fuelRange.label, {val: 'value' in myReceivedDataKey ? myReceivedDataKey.value * 1 : 0, ack: true});
                            //adapter.setState(state_s_fuelRange.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('FuelRange: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030009': //secondary_typ - erst ab Modelljahr 2018
                            var secondaryType = 'textId' in myReceivedDataKey ? myReceivedDataKey.textId.replace('engine_type_','').replace('unsupported','-').Capitalize() : myReceivedDataKey.value;
                            //adapter.log.info('SecondaryEngineType: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030002': //soc_ok
                            adapter.setState(state_s_batteryLevel.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('BatteryLevel: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030008': //secondary_range - erst ab Modelljahr 2018
                            adapter.setState(state_s_batteryRange.label, {val: 'value' in myReceivedDataKey ? myReceivedDataKey.value * 1 : 0, ack: true});
                            //adapter.setState(state_s_batteryRange.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('BatteryRange: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030005': //hybrid_range - erst ab Modelljahr 2018
                            adapter.setState(state_s_hybridRange.label, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('HybridRange: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        //door1 - front/left
                        case '0x030104FFFF.0x0301040001':
                            myCarNetDoors.FL.locked = myReceivedDataKey.value === '2';
                            break;
                        case '0x030104FFFF.0x0301040002':
                            myCarNetDoors.FL.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030104FFFF.0x0301040003':
                            myCarNetDoors.FL.safe = myReceivedDataKey.value === '2';
                            break;
                        //door2
                        case '0x030104FFFF.0x0301040004':
                            myCarNetDoors.RL.locked = myReceivedDataKey.value === '2';
                            break;
                        case '0x030104FFFF.0x0301040005':
                            myCarNetDoors.RL.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030104FFFF.0x0301040006':
                            myCarNetDoors.RL.safe = myReceivedDataKey.value === '2';
                            break;
                        //door3 - front/right
                        case '0x030104FFFF.0x0301040007':
                            myCarNetDoors.FR.locked = myReceivedDataKey.value === '2';
                            break;
                        case '0x030104FFFF.0x0301040008':
                            myCarNetDoors.FR.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030104FFFF.0x0301040009':
                            myCarNetDoors.FR.safe = myReceivedDataKey.value === '2';
                            break;
                        //door4
                        case '0x030104FFFF.0x030104000A':
                            myCarNetDoors.RR.locked = myReceivedDataKey.value === '2';
                            break;
                        case '0x030104FFFF.0x030104000B':
                            myCarNetDoors.RR.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030104FFFF.0x030104000C':
                            myCarNetDoors.RR.safe = myReceivedDataKey.value === '2';
                            break;
                        //door5 rear
                        case '0x030104FFFF.0x030104000D':
                            myCarNetDoors.rear.locked = myReceivedDataKey.value === '2';
                            break;
                        case '0x030104FFFF.0x030104000E':
                            myCarNetDoors.rear.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030104FFFF.0x030104000F':
                            //myCarNetDoors.RR.safe = myReceivedDataKey.value === '2';
                            break;
                        //door6 hood
                        case '0x030104FFFF.0x0301040010':
                            //myCarNetDoors.RR.locked = myReceivedDataKey.value === '2';
                            break;
                        case '0x030104FFFF.0x0301040011':
                            myCarNetDoors.hood.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030104FFFF.0x0301040012':
                            //myCarNetDoors.RR.safe = myReceivedDataKey.value === '2';
                            break;
                        //window1 - front/left
                        case '0x030105FFFF.0x0301050001':
                            myCarNetWindows.FL.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030105FFFF.0x0301050002':
                            myCarNetWindows.FL.level = myReceivedDataKey.value;
                            break;
                        //window2 - rear/left
                        case '0x030105FFFF.0x0301050003':
                            myCarNetWindows.RL.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030105FFFF.0x0301050004':
                            myCarNetWindows.RL.level = myReceivedDataKey.value;
                            break;
                        //window3 - front/right
                        case '0x030105FFFF.0x0301050005':
                            myCarNetWindows.FR.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030105FFFF.0x0301050006':
                            myCarNetWindows.FR.level = myReceivedDataKey.value;
                            break;
                        //window4 - rear/right
                        case '0x030105FFFF.0x0301050007':
                            myCarNetWindows.RR.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030105FFFF.0x0301050008':
                            myCarNetWindows.RR.level = myReceivedDataKey.value;
                            break;
                        case '0x030105FFFF.0x030105000B':
                            myCarNetWindows.roof.closed = myReceivedDataKey.value === '3';
                            break;
                        case '0x030105FFFF.0x030105000C':
                            myCarNetWindows.roof.level = myReceivedDataKey.value;
                            break;
                        case '2':
                            break;
                        default: //this should not be possible
                    }
                }
            }

            adapter.setState(state_dw_Doors.label, {val: JSON.stringify(myCarNetDoors), ack: true});
            //adapter.log.info(JSON.stringify(myCarNetDoors));

            adapter.setState(state_dw_Windows.label, {val: JSON.stringify(myCarNetWindows), ack: true});
            //adapter.log.info(JSON.stringify(myCarNetWindows));

            adapter.setState(state_s_carCentralLock.label, {val: myCarNetDoors.FL.locked && myCarNetDoors.FR.locked, ack: true});

            switch (myParkingLight) {
                case '3':
                    adapter.setState(state_s_parkingLights.label, {val: 'left=on, right=off', ack: true});
                    break;
                case '4':
                    adapter.setState(state_s_parkingLights.label, {val: 'left=off, right=on', ack: true});
                    break;
                case '5':
                    adapter.setState(state_s_parkingLights.label, {val: 'left=on, right=on', ack: true});
                    break;
                default:
                    adapter.setState(state_s_parkingLights.label, {val: 'off', ack: true});
            }
            return callback(true);
        });
    } catch (err) {
        adapter.log.error('Fehler bei der Auswertung im status Modul');
        return callback(false);
    }
}

function RetrieveVehicleData_Climater(callback){
    if (VWCarNet_GetClimater === false){
        return callback(true);
    }

    var myTemperatureCelsius = 0;
    if (VWCarNet_Connected===false) { return callback(false); }
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/climatisation/v1/VW/DE/vehicles/' + myVIN + '/climater';
    request.get({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, responseData){
        if (myLoggingEnabled) { adapter.log.info('received climater data:' + JSON.stringify(responseData)); }

        var climaterSettings = responseData.climater.settings;
        if (climaterSettings !== null) {
            if (isNaN(climaterSettings.targetTemperature.content)) {
                myTemperatureCelsius = 999;
            } else {
                myTemperatureCelsius = parseFloat((climaterSettings.targetTemperature.content)/10) - 273;
            }
            adapter.setState(state_c_targetTemperature.label, {val: myTemperatureCelsius.toFixed(1), ack: true});
            myTemperatureCelsius = null;
            adapter.setState(state_c_climatisationWithoutHVPower.label, {val: climaterSettings.climatisationWithoutHVpower.content, ack: true});
            adapter.setState(state_c_heaterSource.label, {val: climaterSettings.heaterSource.content.toUpperCase(), ack: true});
        }

        var climatisationStatusData = responseData.climater.status.climatisationStatusData;
        if (climatisationStatusData !== undefined) {
            adapter.setState(state_c_climatisationState.label, {val: climatisationStatusData.climatisationState.content.toUpperCase(), ack: true});
            //adapter.log.info(climatisationStatusData.climatisationStateErrorCode.content);

            var myRemainingTime = climatisationStatusData.remainingClimatisationTime.content;
            //var myRemainingTimeStr = Math.floor( myRemainingTime / 60 ) + ':' + ('00' + Math.floor( myRemainingTime%60 )).substr(-2);
            var myRemainingTimeStr = myRemainingTime;
            if (myRemainingTime <0 ){ myRemainingTimeStr = null; }
            adapter.setState(state_c_remainingClimatisationTime.label, {val: myRemainingTimeStr, ack: true});
            adapter.setState(state_c_climatisationReason.label, {val: climatisationStatusData.climatisationReason.content.toUpperCase(), ack: true});
        }

        var windowHeatingStatusData = responseData.climater.status.windowHeatingStatusData;
        if (windowHeatingStatusData !== undefined) {
            adapter.setState(state_c_windowHeatingStateFront.label, {val: windowHeatingStatusData.windowHeatingStateFront.content.toUpperCase(), ack: true});
            adapter.setState(state_c_windowHeatingStateRear.label, {val: windowHeatingStatusData.windowHeatingStateRear.content.toUpperCase(), ack: true});
            //adapter.log.info(windowHeatingStatusData.windowHeatingErrorCode.content);
        }

        var temperatureStatusData = responseData.climater.status.temperatureStatusData;
        if (isNaN(temperatureStatusData.outdoorTemperature.content)){
            myTemperatureCelsius = 999;
        } else {
            myTemperatureCelsius = parseFloat((temperatureStatusData.outdoorTemperature.content)/10) - 273;
        }
        adapter.setState(state_c_outdoorTemperature.label, {val: myTemperatureCelsius.toFixed(1), ack: true});
        myTemperatureCelsius = null;

        var vehicleParkingClockStatusData = responseData.climater.status.vehicleParkingClockStatusData;
        if (vehicleParkingClockStatusData !== undefined){
            adapter.setState(state_c_vehicleParkingClock.label, {val: vehicleParkingClockStatusData.vehicleParkingClock.content, ack: true});
        } else {
            adapter.setState(state_c_vehicleParkingClock.label, {val: 'MOVING', ack: true});
        }

        return callback(true);
    });
}

function RetrieveVehicleData_eManager(callback){
    if (VWCarNet_GetEManager === false){
        return callback(true);
    }

    var responseData;
    if (VWCarNet_Connected===false) { return callback(false); }
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/batterycharge/v1/VW/DE/vehicles/' + myVIN + '/charger';

    try {
        request.get({url: myUrl, headers: myAuthHeaders}, function (error, response, result){
            if (myLoggingEnabled) {adapter.log.info('received eManager data:' + result);}

            responseData = JSON.parse(result);

            var chargerSettings = responseData.charger.settings;
            if (chargerSettings !== '' ) {
                adapter.setState(state_e_maxChargeCurrent.label, {val: chargerSettings.maxChargeCurrent.content, ack: true});
            }

            var chargingStatusData = responseData.charger.status.chargingStatusData;
            if (chargingStatusData !== undefined) {
                adapter.setState(state_e_chargingMode.label, {val: chargingStatusData.chargingMode.content.toUpperCase(), ack: true});
                //adapter.log.info('eManager/chargingStateErrorCode: ' + chargingStatusData.chargingStateErrorCode.content);
                adapter.setState(state_e_chargingReason.label, {val: chargingStatusData.chargingReason.content.toUpperCase(), ack: true});
                adapter.setState(state_e_extPowerSupplyState.label, {val: chargingStatusData.externalPowerSupplyState.content.toUpperCase(), ack: true});
                //adapter.log.info('eManager/energyFlow: ' + chargingStatusData.energyFlow.content);
                adapter.setState(state_e_chargingState.label, {val: chargingStatusData.chargingState.content.toUpperCase(), ack: true});
            }

            var cruisingRangeStatusData = responseData.charger.status.cruisingRangeStatusData;
            // adapter.log.info(cruisingRangeStatusData.engineTypeFirstEngine.content);
            // adapter.log.info(cruisingRangeStatusData.primaryEngineRange.content);
            // adapter.log.info(cruisingRangeStatusData.hybridRange.content);
            // adapter.log.info(cruisingRangeStatusData.engineTypeSecondEngine.content);
            // adapter.log.info(cruisingRangeStatusData.secondaryEngineRange.content);

            var ledStatusData = responseData.charger.status.ledStatusData;
            if (ledStatusData !== undefined) {
                //adapter.log.info('eManager/ledColor: ' + ledStatusData.ledColor.content);
                //adapter.log.info('eManager/ledState: ' + ledStatusData.ledState.content);
            }

            var batteryStatusData = responseData.charger.status.batteryStatusData;
            if (batteryStatusData !== undefined) {
                adapter.setState(state_e_stateOfCharge.label, {val: batteryStatusData.stateOfCharge.content, ack: true});
                var myRemainingTime = batteryStatusData.remainingChargingTime.content;
                var myRemainingTimeStr = Math.floor( myRemainingTime / 60 ) + ':' + ('00' + Math.floor( myRemainingTime%60 )).substr(-2);
                if (myRemainingTime <0 ) { myRemainingTimeStr = null; }
                adapter.setState(state_e_remainingChargingTime.label, {val: myRemainingTimeStr, ack: true});
                adapter.setState(state_e_remainingChargingTimeTargetSOC.label, {val: batteryStatusData.remainingChargingTimeTargetSOC.content, ack: true});
            }

            var plugStatusData = responseData.charger.status.plugStatusData;
            if (plugStatusData !== undefined) {
                adapter.setState(state_e_plugState.label, {val: plugStatusData.plugState.content.toUpperCase(), ack: true});
                adapter.setState(state_e_lockState.label, {val: plugStatusData.lockState.content.toUpperCase(), ack: true});
            }

            return callback(true);
        });
    } catch (err) {
        adapter.log.error('Fehler bei der Auswertung im eManager Modul');
        return callback(false);
    }
}

function RetrieveVehicleData_Location(callback) {
    if (VWCarNet_GetLocation === false) {
        return callback(true);
    }

    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/cf/v1/VW/DE/vehicles/' + myVIN + '/position';

    if (VWCarNet_Connected === false) {
        return callback(false);
    }

    if (VWCarNet_GetLocation === false) {
        adapter.setState(state_l_lat.label, {val: null, ack: true});
        adapter.setState(state_l_lng.label, {val: null, ack: true});
        adapter.setState(state_l_parkingTime.label, {val: null, ack: true});
        adapter.setState(state_l_address.label, {val: null, ack: true});
    }

    try {
        request.get({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, responseData) {
            if (error !== null) {
                return callback(false);
            }
            if (responseData === undefined) {
                return callback(false);
            }
            if ('findCarResponse' in responseData) {
                var findCarResponse = responseData.findCarResponse;
                if (findCarResponse !== undefined && findCarResponse !== null) {
                    adapter.setState(state_l_lat.label, {
                        val: findCarResponse.Position.carCoordinate.latitude/1000000,
                        ack: true
                    });
                    adapter.setState(state_l_lng.label, {
                        val: findCarResponse.Position.carCoordinate.longitude/1000000,
                        ack: true
                    });
                    adapter.setState(state_l_parkingTime.label, {val: findCarResponse.parkingTimeUTC, ack: true});
                    requestGeocoding(findCarResponse.Position.carCoordinate.latitude, findCarResponse.Position.carCoordinate.longitude);
                } else {
                    adapter.setState(state_l_lat.label, {val: null, ack: true});
                    adapter.setState(state_l_lng.label, {val: null, ack: true});
                    adapter.setState(state_l_parkingTime.label, {val: null, ack: true});
                    adapter.setState(state_l_address.label, {val: 'MOVING', ack: true});
                }
            } else {
                adapter.setState(state_l_lat.label, {val: null, ack: true});
                adapter.setState(state_l_lng.label, {val: null, ack: true});
                adapter.setState(state_l_parkingTime.label, {val: null, ack: true});
                adapter.setState(state_l_address.label, {val: 'MOVING', ack: true});
            }
            return callback(true);
        });
    } catch (err) {
        adapter.log.error('Fehler bei der Auswertung im location Modul');
        return callback(false);
    }
}

function requestGeocoding(lat, lng) {
    var myUrl = 'https://maps.googleapis.com/maps/api/geocode/json?latlng='+lat/1000000+','+lng/1000000;
    var myAddress = '<UNKNOWN>';
    if (myGoogleMapsAPIKey !== "") {
        myUrl = myUrl + '&key=' + myGoogleMapsAPIKey;
        //adapter.log.info(myUrl);
        try{
            request.get({url:myUrl, headers: myGoogleDefaulHeader,json: true}, function (error, response, result) {
                //adapter.log.info(response.statusCode);
                //adapter.log.info(JSON.stringify(result));

                if ((result.results.length > 0) & result.results[0].formatted_address !== "") {
                    myAddress = result.results[0].formatted_address;
                }
                adapter.setState(state_l_address.label, {val: myAddress, ack: true});
                //adapter.log.info(myAddress);
            });
        } catch (err) {
            adapter.setState(state_l_address.label, {val: null, ack: true});
            adapter.log.error(response.statusCode);
        }
    } else {
        adapter.setState(state_l_address.label, {val: null, ack: true});
    }
}

function requestCarSendData2CarNet(callback){
    //Requesting car to send it's data to the server
    var responseData;
    var myCarNet_requestID;
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/VW/DE/vehicles/' + myVIN + '/requests';
    try {
        request.post({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, result) {
            if (myLoggingEnabled){adapter.log.info(response.statusCode);}

            if (response.statusCode===202){
                if (myLoggingEnabled){adapter.log.info('RequestID: ' + result.CurrentVehicleDataResponse.requestId);}
                return callback(true);
            } else {
                return callback(false);
            }
        });
    } catch (err){
        //adapter.log.error('Fehler bei Post-Befehl')
        return callback(false);
    }
}
