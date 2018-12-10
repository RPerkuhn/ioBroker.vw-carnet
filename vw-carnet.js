//version 0.1.3
'use strict';
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('vw-carnet');

const my_key = 'Zgfr56gFe87jJOM'

//var ioBroker_Settings
var ioBroker_Language = 'en'

adapter.getForeignObject('system.config', function(err, ioBroker_Settings) {
    if (err) {

    } else {
        ioBroker_Language = ioBroker_Settings.common.language;
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
        VWCarNet_Connected = false
        adapter.setState('connection', {val: VWCarNet_Connected, ack: true}); //connection to Threema gateway not established
        adapter.log.info('VW CarNet adater stopped - cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// Some message was sent to adapter instance over message box.
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        adapter.log.info('Received message in VW CarNet adapter :' + obj.command)
        if (obj.command === 'update') {
            VWCarNetReadData() // sendto command 'update' received
        }
        if (obj.command === 'CarSendData') {
            VWCarNetForceCarToSendData() // sendto command 'update' received
        }
    }
});

adapter.on('ready', function () {
    var myTmp;
    adapter.log.info(ioBroker_Language)
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
const channel_s = {'label':'Vehicle.status', 'en': 'status of vehicle', 'de': 'Fahrzeugstatus'};
const state_s_lastConnectionTimeStamp   = {'label':'Vehicle.status.lastConnectionTimeStamp', 'en': 'last connection timestamp', 'de': 'Zeitpunkt der letzten Verbindung zum Fahrzeug'};
const state_s_distanceCovered     = {'label':'Vehicle.status.distanceCovered', 'en': 'distance covered', 'de': 'Kilometerstand'};
const state_s_hybridRange  = {'label':'Vehicle.status.hybridRange', 'en': 'total range', 'de': 'Gesamtreichweite des Fahrzeugs'};
const state_s_serviceInspectionDistance= {'label':'Vehicle.status.serviceInspectionDistance', 'en': 'distance until next service inspection', 'de': 'km bis zur nächsten Inspektion'};
const state_s_serviceInspectionTime= {'label':'Vehicle.status.serviceInspectionTime', 'en': 'time until next service inspecton', 'de': 'Zeit bis zur nächsten Inspektion', 'unit_de':'Tag(e)', 'unit_en':'day(s)'};
const state_s_oilInspectionDistance= {'label':'Vehicle.status.oilInspectionDistance', 'en': 'distance until next oil inspection', 'de': 'km bis zum nächsten Ölwechsel-Service'};
const state_s_oilInspectionTime= {'label':'Vehicle.status.oilInspectionTime', 'en': 'time until next oil inspecton', 'de': 'Zeit bis zum nächsten Ölwechsel-Service', 'unit_de':'Tag(e)', 'unit_en':'day(s)'};
const state_s_parkingLights = {'label':'Vehicle.status.ParkingLights', 'en': 'parking lights', 'de': 'Parklichter / Standlicht'};
//const state_s_parkingBrake = {'label':'Vehicle.status.parkingBrake', 'en': '', 'de': ''};
const state_s_carCentralLock = {'label':'Vehicle.status.carCentralLock', 'en': 'car central lock', 'de': 'Zentralverriegelung'};
const state_s_fuelLevel = {'label':'Vehicle.status.fuelLevel', 'en': 'fuel level', 'de': 'Füllstand Kraftstoff'};
const state_s_fuelRange = {'label':'Vehicle.status.fuelRange', 'en': 'fuel range', 'de': 'Reichweite Kraftstoff'};
const state_s_batteryLevel = {'label':'Vehicle.status.batteryLevel', 'en': 'battery level', 'de': 'Füllstand Batterie'};
const state_s_batteryRange = {'label':'Vehicle.status.batteryRange', 'en': 'battery range', 'de': 'Reichweite Elektromotor'};
const channel_dw_DoorsAndWindows = {'label':'Vehicle.status.DoorsAndWindows', 'en': 'doors and windows', 'de': 'Türen und Fenster'};
const state_dw_Doors = {'label':'Vehicle.status.DoorsAndWindows.doorsJSON', 'en': 'JSON objekt with windowstates', 'de': 'JSON Objekt Status Türen'};
const state_dw_Windows = {'label':'Vehicle.status.DoorsAndWindows.windowsJSON', 'en': 'JSON object with doorstates', 'de': 'JSON Objekt Status Fenster'};

//##############################################################################################################
// declaring names for states for climater data
const channel_c = {'label':'Vehicle.climater', 'en': 'heating / air condition / climater', 'de': 'Heizung / Klimaanlage / Lüftung'};
const state_c_climatisationWithoutHVPower = {'label':'Vehicle.climater.climatisationWithoutHVPower', 'en': 'allow air condition in e-mode', 'de': 'Klimaanlage über Batterie zulassen'};
const state_c_targetTemperature = {'label':'Vehicle.climater.targetTemperature', 'en': 'target temperature', 'de': 'Zieltemperatur'};
const state_c_heaterSource = {'label':'Vehicle.climater.heaterSource', 'en': 'heater source', 'de': 'Heizungs-Quelle'};
const state_c_climatisationReason = {'label':'Vehicle.climater.climatisationReason', 'en': 'climatisation reason', 'de': 'Heizungsbetrieb'};
const state_c_windowHeatingStateFront = {'label':'Vehicle.climater.windowHeatingStateFront', 'en': 'state of window heating front', 'de': 'Zustand der Heizung Windschutzscheibe'};
const state_c_windowHeatingStateRear = {'label':'Vehicle.climater.windowHeatingStateRear', 'en': 'state of window heating rear', 'de': 'Zustand der Heckscheibenheizung'};
const state_c_outdoorTemperature = {'label':'Vehicle.climater.outdoorTemperature', 'en': 'outdoor temperature', 'de': 'Außentemperatur'};
const state_c_vehicleParkingClock = {'label':'Vehicle.climater.vehicleParkingClock', 'en': 'parking timestamp', 'de': 'Zeitpunkt parken des Fahrzeugs'};
const state_c_climatisationState = {'label':'Vehicle.climater.climatisationState', 'en': 'state of climatisation', 'de': 'Zustand der Standheizung'};
const state_c_remainingClimatisationTime = {'label':'Vehicle.climater.remainingClimatisationTime', 'en': 'remaining climatisation time', 'de': 'Verbleibende Dauer bis Zieltemperatur'};

//##############################################################################################################
// declaring names for states for eManager data
const channel_e = {'label':'Vehicle.eManager', 'en': 'e-manager', 'de': 'e-Manager'};;
const state_e_stateOfCharge = {'label':'Vehicle.eManager.stateOfCharge', 'en': 'chargingstate main battery', 'de': 'Ladezustand der Hauptbatterie'};
const state_e_remainingChargingTimeTargetSOC = {'label':'Vehicle.eManager.remainingChargingTimeTargetSOC', 'en': 'remaining charging time until SOC', 'de': 'Verbleibende Ladedauer untere Batterie-Ladegrenze'};
const state_e_chargingMode = {'label':'Vehicle.eManager.chargingMode', 'en': 'charging mode', 'de': 'Lademodus'};;
const state_e_chargingState = {'label':'Vehicle.eManager.chargingState', 'en': 'charging state', 'de': 'Zustand des Ladevorgangs'};
const state_e_chargingReason = {'label':'Vehicle.eManager.chargingReason', 'en': 'charging reason', 'de': 'Ladebetrieb'};
const state_e_remainingChargingTime = {'label':'Vehicle.eManager.remainingChargingTime', 'en': 'remaining charging time until 100%', 'de': 'Verbleibende Ladedauer bis 100%'};
const state_e_maxChargeCurrent = {'label':'Vehicle.eManager.maxChargeCurrent', 'en': 'maximun charging current', 'de': 'maximaler Ladestrom'};
const state_e_plugState = {'label':'Vehicle.eManager.plugState', 'en': 'charging cable plugged', 'de': 'Status Ladestecker'};
const state_e_lockState = {'label':'Vehicle.eManager.lockState', 'en': 'charging cable locked', 'de': 'Verriegelung Ladestecker'};
const state_e_extPowerSupplyState = {'label':'Vehicle.eManager.externalPowerSupplyState', 'en': 'external power supply state', 'de': 'Status externe Stromversorgung'};

//##############################################################################################################
// declaring names for states for location data
const channel_l = {'label':'Vehicle.location', 'en': 'location of vehicle', 'de': 'Ortungsdaten Fahrzeug'};
const state_l_lat = {'label':'Vehicle.location.latitude', 'en': 'location latitude', 'de': 'Breitengrad der Position des Fahrzeugs'};
const state_l_lng = {'label':'Vehicle.location.longitude', 'en': 'location longitude', 'de': 'Längengrad der Position des Fahrzeugs'};
const state_l_parkingTime = {'label':'Vehicle.location.parkingTimeUTC', 'en': 'parking timestamp', 'de': 'Zeitpunkt parken des Fahrzeugs'};
const state_l_address = {'label':'Vehicle.location.parkingAddress', 'en': 'parking address', 'de': 'Adresse der Position des Fahrzeugs'};

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
        common: {name: state_s_hybridRange[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_serviceInspectionDistance.label, {
        type: 'state',
        common: {name: state_s_serviceInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_serviceInspectionTime.label, {
        type: 'state',
        common: {name: state_s_serviceInspectionTime[ioBroker_Language], type: 'number', unit: state_s_serviceInspectionTime['unit_' + ioBroker_Language], read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_oilInspectionDistance.label, {
        type: 'state',
        common: {name: state_s_oilInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_oilInspectionTime.label, {
        type: 'state',
        common: {name: state_s_oilInspectionTime[ioBroker_Language], type: 'number', unit: state_s_oilInspectionTime['unit_' + ioBroker_Language], read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_parkingLights.label, {
        type: 'state',
        common: {name: state_s_parkingLights[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_carCentralLock.label, {
        type: 'state',
        common: {name: state_s_carCentralLock[ioBroker_Language], type: "string", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_fuelLevel.label, {
        type: 'state',
        common: {name: state_s_fuelLevel[ioBroker_Language], type: "number", unit: "%", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_fuelRange.label, {
        type: 'state',
        common: {name: state_s_fuelRange[ioBroker_Language], type: "number", unit: "km", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_batteryLevel.label, {
        type: 'state',
        common: {name: state_s_batteryLevel[ioBroker_Language], type: "number", unit: "%", read: true, write: false, role: 'value'},
        native: {}
    });
    adapter.setObject(state_s_batteryRange.label, {
        type: 'state',
        common: {name: state_s_batteryRange[ioBroker_Language], type: "number", unit: "km", read: true, write: false, role: 'value'},
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
    if (myGoogleMapsAPIKey !== ''){
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
            RetrieveVehicles(function(myTmp){
                RetrieveVehicleData_VINValid(function(myTmp){
                    VWCarNet_VINIsValid=myTmp;
                    //adapter.log.info('VIN valid?: ' + VWCarNet_VINIsValid)
                    VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
                    adapter.setState('connection', {val: VWCarNet_Connected, ack: true});
                    if(VWCarNet_VINIsValid){
                        var mySuccefulUpdate = true
                        adapter.setState(state_v_VIN, {val: myVIN, ack: true});
                    } else {
                        adapter.setState(state_v_VIN, {val: '', ack: true});
                    }
                    if (VWCarNet_Connected){
                        RetrieveVehicleData_Status(function(myTmp){
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp
                        });

                        RetrieveVehicleData_Location(function(myTmp){
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp
                        });

                        RetrieveVehicleData_eManager(function(myTmp) {
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp
                        });

                        RetrieveVehicleData_Climater(function(myTmp){
                            //adapter.log.info(myTmp);
                            mySuccefulUpdate = mySuccefulUpdate && myTmp
                        });

                    }
                    //adapter.log.info('VW Car-Net connected?: ' + VWCarNet_Connected);
                    if (mySuccefulUpdate){
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

function VWCarNetReadData(){
    var mySuccefulUpdate = true
    CarNetLogon(function(myTmp){
        VWCarNet_CredentialsAreValid=myTmp;
        VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
        //adapter.log.info(VWCarNet_CredentialsAreValid);
        if (VWCarNet_Connected){
            RetrieveVehicleData_Status(function(myTmp){
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp
            });

            RetrieveVehicleData_Location(function(myTmp){
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp
            });

            RetrieveVehicleData_eManager(function(myTmp) {
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp
            });

            RetrieveVehicleData_Climater(function(myTmp){
                //adapter.log.info(myTmp);
                mySuccefulUpdate = mySuccefulUpdate && myTmp
            });

            //adapter.log.info(myLastCarNetAnswer);
            if (mySuccefulUpdate){
                var myDate = Date.now();
                adapter.setState('lastUpdate', {val: myDate, ack: true});
            };
        }
    });
}

function VWCarNetForceCarToSendData(){
    var mySuccefulUpdate = true
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
        return callback('not autenticated');
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
    var myCarNet_vehicleStatus;
    var myData = 0;
    var myField = 0;
    var myReceivedDataKey;
    var myOilInspectionDays=0, myOilInspectionKm=0;
    var myServiceInspectionDays=0, myServiceInspectionKm=0;
    var myParkingLight;
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/VW/DE/vehicles/' + myVIN + '/status';
    if (VWCarNet_Connected===false){return callback(false)};
    try{
        request.get({url: myUrl, headers: myAuthHeaders}, function (error, response, result){
            //adapter.log.info(result);
            try {
                responseData = JSON.parse(result);
            } catch (err) {
                adapter.log.error(responseData.error.errorCode + ': ' + responseData.error.description);
                return callback(false);
            }
            myCarNet_vehicleStatus = responseData.StoredVehicleDataResponse.vehicleData;
            //adapter.log.info(myCarNet_vehicleStatus.data[myData].field[myField].tsCarSentUtc);
            adapter.setState(state_s_lastConnectionTimeStamp, {val: myCarNet_vehicleStatus.data[myData].field[myField].tsCarSentUtc, ack: true});

            for (myData in myCarNet_vehicleStatus.data) {
                for (myField in myCarNet_vehicleStatus.data[myData].field) {
                    myReceivedDataKey = myCarNet_vehicleStatus.data[myData].field[myField];
                    //adapter.log.info(myCarNet_vehicleStatus.data[myData].id + "." + myCarNet_vehicleStatus.data[myData].field[myField].id)
                    switch(myCarNet_vehicleStatus.data[myData].id + "." + myCarNet_vehicleStatus.data[myData].field[myField].id){
                        case '0x0101010002.0x0101010002': //distanceCovered
                            adapter.setState(state_s_distanceCovered, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info(myReceivedDataKey.value);
                            break;
                        case '0x0203FFFFFF.0x0203010001': //oilInspectionData_km
                            myOilInspectionKm = myReceivedDataKey.value *-1;
                            adapter.setState(state_s_oilInspectionDistance, {val: myOilInspectionKm, ack: true});
                            //adapter.log.info(myOilInspectionKm + myReceivedDataKey.unit);
                            break;
                        case '0x0203FFFFFF.0x0203010002': //oilInspectionData_days
                            myOilInspectionDays = myReceivedDataKey.value *-1;
                            adapter.setState(state_s_oilInspectionTime, {val: myOilInspectionDays, ack: true});
                            //adapter.log.info(myOilInspectionDays);
                            break;
                        case '0x0203FFFFFF.0x0203010003': //serciceInspectionData_km
                            myServiceInspectionKm = myReceivedDataKey.value * -1;
                            adapter.setState(state_s_serviceInspectionDistance, {val: myServiceInspectionKm, ack: true});
                            //adapter.log.info(myServiceInspectionKm + myReceivedDataKey.unit);
                            break;
                        case '0x0203FFFFFF.0x0203010004': //serviceInspectionData_days
                            myServiceInspectionDays = myReceivedDataKey.value *-1;
                            adapter.setState(state_s_serviceInspectionTime, {val: myServiceInspectionDays, ack: true});
                            //adapter.log.info(myServiceInspectionDays);
                            break;
                        case '0x030101FFFF.0x0301010001':  //status_parking_light_off
                            //adapter.log.info('ParkingLight: ' + myReceivedDataKey.value);
                            myParkingLight = myReceivedDataKey.value

                            break;
                        // case '0x030103FFFF.0x0301030001': //parking_brake_inactive
                        //     //adapter.log.info('ParkingBrake: ' + myReceivedDataKey.value);
                        //     var myParkingBrake = false;
                        //     if (myReceivedDataKey.value = '0'){myParkingBrake = true};
                        //     adapter.setState(state_s_parkingBrake, {val: myParkingBrake, ack: true});
                        //     break;
                        case '0x030103FFFF.0x030103000A': //fuel_level_ok
                            adapter.setState(state_s_fuelLevel, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('FuelLevel: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030002': //soc_ok
                            adapter.setState(state_s_batteryLevel, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('BatteryLevel: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030006': //fuel_range
                            adapter.setState(state_s_fuelRange, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('FuelRange: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030008': //electric_range
                            adapter.setState(state_s_batteryRange, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('BatteryRange: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        case '0x030103FFFF.0x0301030005': //hybrid_range
                            adapter.setState(state_s_hybridRange, {val: myReceivedDataKey.value, ack: true});
                            //adapter.log.info('HybridRange: ' + myReceivedDataKey.value + myReceivedDataKey.unit);
                            break;
                        //door1 - front/left
                        case '0x030104FFFF.0x0301040001':
                            myCarNetDoors.FL.locked = myReceivedDataKey.value === '2'
                            break;
                        case '0x030104FFFF.0x0301040002':
                            myCarNetDoors.FL.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030104FFFF.0x0301040003':
                            myCarNetDoors.FL.safe = myReceivedDataKey.value === '2'
                            break;
                        //door2
                        case '0x030104FFFF.0x0301040004':
                            myCarNetDoors.RL.locked = myReceivedDataKey.value === '2'
                            break;
                        case '0x030104FFFF.0x0301040005':
                            myCarNetDoors.RL.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030104FFFF.0x0301040006':
                            myCarNetDoors.RL.safe = myReceivedDataKey.value === '2'
                            break;
                        //door3 - front/right
                        case '0x030104FFFF.0x0301040007':
                            myCarNetDoors.FR.locked = myReceivedDataKey.value === '2'
                            break;
                        case '0x030104FFFF.0x0301040008':
                            myCarNetDoors.FR.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030104FFFF.0x0301040009':
                            myCarNetDoors.FR.safe = myReceivedDataKey.value === '2'
                            break;
                        //door4
                        case '0x030104FFFF.0x030104000A':
                            myCarNetDoors.RR.locked = myReceivedDataKey.value === '2'
                            break;
                        case '0x030104FFFF.0x030104000B':
                            myCarNetDoors.RR.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030104FFFF.0x030104000C':
                            myCarNetDoors.RR.safe = myReceivedDataKey.value === '2'
                            break;
                        //door5 rear
                        case '0x030104FFFF.0x030104000D':
                            myCarNetDoors.rear.locked = myReceivedDataKey.value === '2'
                            break;
                        case '0x030104FFFF.0x030104000E':
                            myCarNetDoors.rear.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030104FFFF.0x030104000F':
                            //myCarNetDoors.RR.safe = myReceivedDataKey.value === '2'
                            break;
                        //door6 hood
                        case '0x030104FFFF.0x0301040010':
                            //myCarNetDoors.RR.locked = myReceivedDataKey.value === '2'
                            break;
                        case '0x030104FFFF.0x0301040011':
                            myCarNetDoors.hood.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030104FFFF.0x0301040012':
                            //myCarNetDoors.RR.safe = myReceivedDataKey.value === '2'
                            break;
                        //window1 - front/left
                        case '0x030105FFFF.0x0301050001':
                            myCarNetWindows.FL.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030105FFFF.0x0301050002':
                            myCarNetWindows.FL.level = myReceivedDataKey.value
                            break;
                        //window2 - rear/left
                        case '0x030105FFFF.0x0301050003':
                            myCarNetWindows.RL.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030105FFFF.0x0301050004':
                            myCarNetWindows.RL.level = myReceivedDataKey.value
                            break;
                        //window3 - front/right
                        case '0x030105FFFF.0x0301050005':
                            myCarNetWindows.FR.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030105FFFF.0x0301050006':
                            myCarNetWindows.FR.level = myReceivedDataKey.value
                            break;
                        //window4 - rear/right
                        case '0x030105FFFF.0x0301050007':
                            myCarNetWindows.RR.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030105FFFF.0x0301050008':
                            myCarNetWindows.RR.level = myReceivedDataKey.value
                            break;
                        case '0x030105FFFF.0x030105000B':
                            myCarNetWindows.roof.closed = myReceivedDataKey.value === '3'
                            break;
                        case '0x030105FFFF.0x030105000C':
                            myCarNetWindows.roof.level = myReceivedDataKey.value
                            break;
                        case '2':


                            break;
                        default: //thish should not be possible
                    }
                }
            }
            adapter.setState(state_dw_Doors, {val: JSON.stringify(myCarNetDoors), ack: true});
            //adapter.log.info(JSON.stringify(myCarNetDoors));
            adapter.setState(state_dw_Windows, {val: JSON.stringify(myCarNetWindows), ack: true});
            //adapter.log.info(JSON.stringify(myCarNetWindows));
            adapter.setState(state_s_carCentralLock, {val: myCarNetDoors.FL.safe && myCarNetDoors.FR.safe, ack: true});

            switch (myParkingLight) {
                case '3':
                    adapter.setState(state_s_parkingLights, {val: 'left=on, right=off', ack: true});
                    break;
                case '4':
                    adapter.setState(state_s_parkingLights, {val: 'left=off, right=on', ack: true});
                    break;
                case '5':
                    adapter.setState(state_s_parkingLights, {val: 'left=on, right=on', ack: true});
                    break;
                default:
                    adapter.setState(state_s_parkingLights, {val: 'off', ack: true});
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
    var responseData;
    var myCarNet_Climater;
    var myTemperatureCelsius = 0;
    if (VWCarNet_Connected===false){return callback(false)};
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/climatisation/v1/VW/DE/vehicles/' + myVIN + '/climater';
    request.get({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, responseData){
        //adapter.log.info(JSON.stringify(responseData));

        myCarNet_Climater = responseData.climater.settings;

        if (isNaN(myCarNet_Climater.targetTemperature.content)){
            myTemperatureCelsius = 999
        } else {
            myTemperatureCelsius = parseFloat((myCarNet_Climater.targetTemperature.content)/10) - 273
        }
        adapter.setState(state_c_targetTemperature, {val: myTemperatureCelsius.toFixed(1), ack: true});
        myTemperatureCelsius = null
        adapter.setState(state_c_climatisationWithoutHVPower, {val: myCarNet_Climater.climatisationWithoutHVpower.content, ack: true});
        adapter.setState(state_c_heaterSource, {val: myCarNet_Climater.heaterSource.content.toUpperCase(), ack: true});

        var myCarNet_Climater = responseData.climater.status.climatisationStatusData;
        adapter.setState(state_c_climatisationState, {val: myCarNet_Climater.climatisationState.content.toUpperCase(), ack: true});
        //adapter.log.info(myCarNet_Climater.climatisationStateErrorCode.content);
        var myRemainingTime = myCarNet_Climater.remainingClimatisationTime.content
        //var myRemainingTimeStr = Math.floor( myRemainingTime / 60 ) + ':' + ('00' + Math.floor( myRemainingTime%60 )).substr(-2);
        var myRemainingTimeStr = myRemainingTime
        if (myRemainingTime <0 ){myRemainingTimeStr = null}
        adapter.setState(state_c_remainingClimatisationTime, {val: myRemainingTimeStr, ack: true});
        adapter.setState(state_c_climatisationReason, {val: myCarNet_Climater.climatisationReason.content.toUpperCase(), ack: true});

        var myCarNet_Climater = responseData.climater.status.windowHeatingStatusData;
        adapter.setState(state_c_windowHeatingStateFront, {val: myCarNet_Climater.windowHeatingStateFront.content.toUpperCase(), ack: true});
        adapter.setState(state_c_windowHeatingStateRear, {val: myCarNet_Climater.windowHeatingStateRear.content.toUpperCase(), ack: true});
        //adapter.log.info(myCarNet_Climater.windowHeatingErrorCode.content);

        var myCarNet_Climater = responseData.climater.status.temperatureStatusData;

        if (isNaN(myCarNet_Climater.outdoorTemperature.content)){
            myTemperatureCelsius = 999
        } else {
            myTemperatureCelsius = parseFloat((myCarNet_Climater.outdoorTemperature.content)/10) - 273
        }
        adapter.setState(state_c_outdoorTemperature, {val: myTemperatureCelsius.toFixed(1), ack: true});
        myTemperatureCelsius = null

        var myCarNet_Climater = responseData.climater.status.vehicleParkingClockStatusData;
        if (myCarNet_Climater !== undefined){
            adapter.setState(state_c_vehicleParkingClock, {val: myCarNet_Climater.vehicleParkingClock.content, ack: true});
        } else {
            adapter.setState(state_c_vehicleParkingClock, {val: 'MOVING', ack: true});
        }
        //adapter.setState(state_c_vehicleParkingClock, {val: myCarNet_Climater.vehicleParkingClock.content, ack: true});

        return callback(true);
    });
}

function RetrieveVehicleData_eManager(callback){
    if (VWCarNet_GetEManager === false){
        return callback(true);
    }
    var responseData;
    var myCarNet_eManager;
    if (VWCarNet_Connected===false){return callback(false)};
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/batterycharge/v1/VW/DE/vehicles/' + myVIN + '/charger';
    try {
        request.get({url: myUrl, headers: myAuthHeaders}, function (error, response, result){
            //adapter.log.info(result);

            responseData = JSON.parse(result);

            myCarNet_eManager = responseData.charger.settings;
            adapter.setState(state_e_maxChargeCurrent, {val: myCarNet_eManager.maxChargeCurrent.content, ack: true});

            myCarNet_eManager = responseData.charger.status.chargingStatusData;
            adapter.setState(state_e_chargingMode, {val: myCarNet_eManager.chargingMode.content.toUpperCase(), ack: true});
            //adapter.log.info('eManager/chargingStateErrorCode: ' + myCarNet_eManager.chargingStateErrorCode.content);
            adapter.setState(state_e_chargingReason, {val: myCarNet_eManager.chargingReason.content.toUpperCase(), ack: true});
            adapter.setState(state_e_extPowerSupplyState, {val: myCarNet_eManager.externalPowerSupplyState.content.toUpperCase(), ack: true});
            //adapter.log.info('eManager/energyFlow: ' + myCarNet_eManager.energyFlow.content);
            adapter.setState(state_e_chargingState, {val: myCarNet_eManager.chargingState.content.toUpperCase(), ack: true});

            myCarNet_eManager = responseData.charger.status.cruisingRangeStatusData;
            // adapter.log.info(myCarNet_eManager.engineTypeFirstEngine.content);
            // adapter.log.info(myCarNet_eManager.primaryEngineRange.content);
            // adapter.log.info(myCarNet_eManager.hybridRange.content);
            // adapter.log.info(myCarNet_eManager.engineTypeSecondEngine.content);
            // adapter.log.info(myCarNet_eManager.secondaryEngineRange.content);

            myCarNet_eManager = responseData.charger.status.ledStatusData;
            //adapter.log.info('eManager/ledColor: ' + myCarNet_eManager.ledColor.content);
            //adapter.log.info('eManager/ledState: ' + myCarNet_eManager.ledState.content);

            myCarNet_eManager = responseData.charger.status.batteryStatusData;

            adapter.setState(state_e_stateOfCharge, {val: myCarNet_eManager.stateOfCharge.content, ack: true});
            var myRemainingTime = myCarNet_eManager.remainingChargingTime.content;
            var myRemainingTimeStr = Math.floor( myRemainingTime / 60 ) + ':' + ('00' + Math.floor( myRemainingTime%60 )).substr(-2);
            if (myRemainingTime <0 ){myRemainingTimeStr = null}
            adapter.setState(state_e_remainingChargingTime, {val: myRemainingTimeStr, ack: true});
            adapter.setState(state_e_remainingChargingTimeTargetSOC, {val: myCarNet_eManager.remainingChargingTimeTargetSOC.content, ack: true});

            myCarNet_eManager = responseData.charger.status.plugStatusData;
            adapter.setState(state_e_plugState, {val: myCarNet_eManager.plugState.content.toUpperCase(), ack: true});
            adapter.setState(state_e_lockState, {val: myCarNet_eManager.lockState.content.toUpperCase(), ack: true});

            return callback(true);
        });
    } catch (err) {
        adapter.log.error('Fehler bei der Auswertung im eManager Modul');
        return callback(false);
    }
}

function RetrieveVehicleData_Location(callback) {
    if (VWCarNet_GetLocation === false){
        return callback(true);
    }
    var responseData;
    var locationData;
    var myCarNet_locationStatus;
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/cf/v1/VW/DE/vehicles/' + myVIN + '/position';
    if (VWCarNet_Connected === false) {
        return callback(false)
    };
    if (VWCarNet_GetLocation === false) {
        adapter.setState(state_l_lat, {val: null, ack: true});
        adapter.setState(state_l_lng, {val: null, ack: true});
        adapter.setState(state_l_parkingTime, {val: null, ack: true});
        adapter.setState(state_l_address, {val: null, ack: true});
    };
    try {
        request.get({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, responseData){
            if (error !== null) {
                return callback(false)
            }
            if (responseData === undefined) {
                return callback(false)
            }
            if ('findCarResponse' in responseData){
                myCarNet_locationStatus = responseData.findCarResponse;
                if (myCarNet_locationStatus !== undefined && myCarNet_locationStatus !== null) {
                    adapter.setState(state_l_lat, {
                        val: myCarNet_locationStatus.Position.carCoordinate.latitude/1000000,
                        ack: true
                    });
                    adapter.setState(state_l_lng, {
                        val: myCarNet_locationStatus.Position.carCoordinate.longitude/1000000,
                        ack: true
                    });
                    adapter.setState(state_l_parkingTime, {val: myCarNet_locationStatus.parkingTimeUTC, ack: true});
                    requestGeocoding(myCarNet_locationStatus.Position.carCoordinate.latitude, myCarNet_locationStatus.Position.carCoordinate.longitude);
                } else {
                    adapter.setState(state_l_lat, {val: null, ack: true});
                    adapter.setState(state_l_lng, {val: null, ack: true});
                    adapter.setState(state_l_parkingTime, {val: null, ack: true});
                    adapter.setState(state_l_address, {val: 'MOVING', ack: true});
                }
            } else {
                adapter.setState(state_l_lat, {val: null, ack: true});
                adapter.setState(state_l_lng, {val: null, ack: true});
                adapter.setState(state_l_parkingTime, {val: null, ack: true});
                adapter.setState(state_l_address, {val: 'MOVING', ack: true});
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
    if (myGoogleMapsAPIKey !== ""){
        myUrl = myUrl + '&key=' + myGoogleMapsAPIKey;
        //adapter.log.info(myUrl);
        try{
            request.get({url:myUrl, headers: myGoogleDefaulHeader,json: true}, function (error, response, result) {
                //adapter.log.info(response.statusCode);
                //adapter.log.info(JSON.stringify(result));

                if ((result.results.length > 0) & result.results[0].formatted_address !== ""){
                    myAddress = result.results[0].formatted_address;
                }
                adapter.setState(state_l_address, {val: myAddress, ack: true});
                //adapter.log.info(myAddress);
            });
        } catch (err){
            adapter.setState(state_l_address, {val: null, ack: true});
            adapter.log.error(response.statusCode);
        }
    } else {
        adapter.setState(state_l_address, {val: null, ack: true});
    }
}
function requestCarSendData2CarNet(callback){
    //Requesting car to send it's data to the server
    var responseData;
    var myCarNet_requestID
    var myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/VW/DE/vehicles/' + myVIN + '/requests';
    try {
        request.post({url: myUrl, headers: myAuthHeaders, json: true}, function (error, response, result) {
            //adapter.log.info(response.statusCode);
            if (response.statusCode===202){
                adapter.log.info('RequestID: ' + result.CurrentVehicleDataResponse.requestId);
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
