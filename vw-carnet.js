// version 0.3.1a
// to start debugging in vscode:
// node --inspect-brk vw-carnet.js --force --logs

/*jshint esversion: 6 */
/*jshint sub:true*/

// 'use strict';
const utils = require('@iobroker/adapter-core');

let adapter;

//var ioBroker_Settings
let ioBroker_Language = 'en';

//DummyFunktion, die übergeben wird, wenn kein Callback benötigt wird
function dummyFunc() { }

function startUpdateProcess(count) {
    mySuccessfulUpdate = true;
    myUpdateCount = count;
}

function updateSuccessfulFlag(myTmp) {
    mySuccessfulUpdate = mySuccessfulUpdate && myTmp;
    myUpdateCount--;
    if (myUpdateCount <= 0) {
        myUpdateCount = 0;
        //adapter.log.info('VW Car-Net connected?: ' + VWCarNet_Connected);
        if (mySuccessfulUpdate) {
            const myDate = Date.now();
            adapter.setState('lastUpdate', { val: myDate, ack: true });
        }
    }
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: 'vw-carnet',
        //ab hier neu V 0.3.x
        stateChange: function (id) {
            let myCommand = id.split('.');
            myCommand = myCommand[myCommand.length - 1];
            //adapter.log.info(myCommand);
            if (myCommand === 'btn_update') {
                VWCarNetReadData(); // command 'update' received
            }
            if (myCommand === 'btn_chargerStart') {
                requestCarSwitchCharger('start', dummyFunc); //command start charging received
            }
            if (myCommand === 'btn_chargerStop') {
                requestCarSwitchCharger('stop', dummyFunc); //command stop charging received
            }
            if (myCommand === 'btn_climaterStart') {
                adapter.log.info('start climater not yet implemented');
                //requestCarSwitchClimater('start', dummyFunc); //command start climater received
            }
            if (myCommand === 'btn_climaterStop') {
                adapter.log.info('stop climater not yet implemented');
                //requestCarSwitchClimater('stop', dummyFunc); //command stop climater received
            }
            if (myCommand === 'btn_windowheatStart') {
                adapter.log.info('start windowheat not yet implemented');
                //requestCarSwitchWindowHeater('start', dummyFunc); //command start windowheat received
            }
            if (myCommand === 'btn_windowheatStop') {
                adapter.log.info('stop windowheat not yet implemented');
                //requestCarSwitchWindowHeater('stop', dummyFunc); //command stop windowheat received
            }
        },
        //bis hier neu V 0.3.x
        message: function (obj) {
            if (typeof obj === 'object' && obj.message) {
                const lCommand = obj.command.toLowerCase();
                adapter.log.info('Received message: ' + lCommand);
                if (lCommand === 'update') {
                    VWCarNetReadData(); // sendto command 'update' received
                }
                if (lCommand === 'carsenddata') {
                    VWCarNetForceCarToSendData(); // sendto command 'update' received
                }
            }
        },
        unload: function (callback) {
            try {
                stopUpdateTimer();
                VWCarNet_Connected = false;
                adapter.setState('connection', { val: VWCarNet_Connected, ack: true }); //connection to Threema gateway not established
                adapter.log.info('Adapter stopped - cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },
        ready: function () {
            //adapter.log.info(ioBroker_Language)
            CreateStates_common(dummyFunc);
            myGoogleMapsAPIKey = adapter.config.GoogleAPIKey;
            VWCarNet_GetStatus = adapter.config.adapterGetStatus;
            VWCarNet_GetClimater = adapter.config.adapterGetClimater;
            VWCarNet_GetEManager = adapter.config.adapterGetEManager;
            VWCarNet_GetLocation = adapter.config.adapterGetLocation;
            CreateStates_Services(dummyFunc);
            CreateStates_Status(dummyFunc);
            CreateStates_climater(dummyFunc);
            CreateStates_eManager(dummyFunc);
            CreateStates_location(dummyFunc);
            main();
            startUpdateTimer();
        }
    });

    adapter = new utils.Adapter(options);

    adapter.getForeignObject('system.config', function (err, ioBroker_Settings) {
        if (err) {
            adapter.log.error('Error while fetching system.config: ' + err);
            return;
        }

        switch (ioBroker_Settings.common.language) {
            case 'de':
                ioBroker_Language = 'de';
                break;
            default:
                ioBroker_Language = 'en';
        }
    });

    return adapter;
}

let VWCarNet_CredentialsAreValid = false;
let VWCarNet_Country = 'DE';
let VWCarNet_Brand = 'VW';
let VWCarNet_VINIsValid = false;
let VWCarNet_Connected = false;
let VWCarNet_GetStatus = false;
let VWCarNet_GetClimater = false;
let VWCarNet_GetEManager = false;
let VWCarNet_GetLocation = false;
let myCarNet_myChargingState;
let myCarNet_MaxChargeCurrent;
let myCarNet_PowerSupplyState;
const myCarNetDoors = { 'doors': 'dummy' };
const myCarNetWindows = { 'windows': 'dummy' };
let mySuccessfulUpdate = true;
let myUpdateCount = 0;
let myUpdateTimer = null;

let myVIN = '';

const request = require('request');

// Fake the VW CarNet mobile app headers
const myHeaders = { 'accept': 'application/json' };
myHeaders['x-app-name'] = 'eRemote';
myHeaders['clientid'] = 'CarNetApp';
myHeaders['x-app-version'] = '4.6.1';
myHeaders['user-agent'] = 'okhttp/3.7.0';

const myAuthHeaders = JSON.parse(JSON.stringify(myHeaders));

let myGoogleMapsAPIKey = '';
const myGoogleDefaulHeader = {
    'Accept': 'application/json, ' + 'text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; D5803 Build/23.5.A.1.291; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/63.0.3239.111 Mobile Safari/537.36'
};

//##############################################################################################################
// declaring names of states for CarNet Services data
const channel_sv = { 'label': 'CarNet-Servcies', 'en': 'status of available carnet services', 'de': 'Status der verfügbaren CarNet Services' };
const state_sv_statusreport_v1_status = { 'label': 'CarNet-Servcies.StatusReport.serviceStatus', 'en': 'general status data', 'de': 'allgemeine Status Daten' };
const state_sv_statusreport_v1_eol = { 'label': 'CarNet-Servcies.StatusReport.serviceEOL', 'en': 'end of life general status data', 'de': 'Vertragsende' };
const state_sv_rclima_v1_status = { 'label': 'CarNet-Servcies.Climater.serviceStatus', 'en': 'climaterdata', 'de': 'Lüftung/Klimaanlage' };
const state_sv_rclima_v1_eol = { 'label': 'CarNet-Servcies.Climater.serviceEOL', 'en': 'end of life', 'de': 'Vertragsende' };
const state_sv_carfinder_v1_status = { 'label': 'CarNet-Servcies.CarFinder.serviceStatus', 'en': 'locationdata', 'de': 'Standortdaten' };
const state_sv_carfinder_v1_eol = { 'label': 'CarNet-Servcies.CarFinder.serviceEOL', 'en': 'end of life', 'de': 'Vertragsende' };
const state_sv_rbatterycharge_v1_status = { 'label': 'CarNet-Servcies.eManager.serviceStatus', 'en': 'electric data (electric/hybrid cars only)', 'de': 'Daten für Elektro- Hybridfahrzeuge' };
const state_sv_rbatterycharge_v1_eol = { 'label': 'CarNet-Servcies.eManager.serviceEOL', 'en': 'end of life', 'de': 'Vertragsende' };

//##############################################################################################################
// declaring names of states for Vehicle data
const channel_v = { 'label': 'Vehicle', 'en': 'selected vehicle', 'de': 'Fahrzeug' };
const state_v_name = { 'label': 'Vehicle.name', 'en': 'name in VW Car-Net', 'de': 'Name des Fahrzeuges in VW Car-Net' };
const state_v_VIN = { 'label': 'Vehicle.VIN', 'en': 'vehicle identification number', 'de': 'Fahrgestellnummer' };
const state_v_Update = { 'label': 'Vehicle.btn_update', 'en': 'load data from CarNet', 'de': 'Daten von CarNet laden' };

//##############################################################################################################
// declaring names of states for status data
const channel_s = { 'label': 'Vehicle.Status', 'en': 'Status of vehicle', 'de': 'Fahrzeugstatus' };
const state_s_lastConnectionTimeStamp = { 'label': 'Vehicle.Status.lastConnectionTimeStamp', 'en': 'Last connection timestamp', 'de': 'Zeitpunkt der letzten Verbindung' };
const state_s_distanceCovered = { 'label': 'Vehicle.Status.distanceCovered', 'en': 'Distance covered', 'de': 'Kilometerstand' };
const state_s_hybridRange = { 'label': 'Vehicle.Status.hybridRange', 'en': 'total range', 'de': 'Gesamtreichweite' };
const state_s_serviceInspectionDistance = { 'label': 'Vehicle.Status.serviceInspectionDistance', 'en': 'Distance until next service inspection', 'de': 'Entfernung bis zur nächsten Inspektion' };
const state_s_serviceInspectionTime = { 'label': 'Vehicle.Status.serviceInspectionTime', 'en': 'Time until next service inspecton', 'de': 'Zeit bis zur nächsten Inspektion', 'unit_de': 'Tag(e)', 'unit_en': 'day(s)' };
const state_s_oilInspectionDistance = { 'label': 'Vehicle.Status.oilInspectionDistance', 'en': 'Distance until next oil inspection', 'de': 'Entfernung bis zum nächsten Ölwechsel' };
const state_s_oilInspectionTime = { 'label': 'Vehicle.Status.oilInspectionTime', 'en': 'Time until next oil inspecton', 'de': 'Zeit bis zum nächsten Ölwechsel', 'unit_de': 'Tag(e)', 'unit_en': 'day(s)' };
const state_s_adBlueInspectionDistance = { 'label': 'Vehicle.Status.adBlueInspectionDistance', 'en': 'Distance until next ad blue inspection', 'de': 'Entfernung bis zur nächsten AdBlue-Füllung' };
const state_s_parkingLights = { 'label': 'Vehicle.Status.ParkingLights', 'en': 'Parking lights', 'de': 'Parklichter / Standlicht' };
const state_s_parkingBrake = { 'label': 'Vehicle.Status.ParkingBrake', 'en': 'Parking brake', 'de': 'Parkbremse' };
const state_s_carCentralLock = { 'label': 'Vehicle.Status.CentralLock', 'en': 'Central lock', 'de': 'Zentralverriegelung' };
const state_s_fuelType = { 'label': 'Vehicle.Status.fuelType', 'en': 'Motor type', 'de': 'Kraftstoff-Typ' }; // XXX
const state_s_fuelLevel = { 'label': 'Vehicle.Status.fuelLevel', 'en': 'fuel level', 'de': 'Kraftstoff-Füllstand' };
const state_s_fuelRange = { 'label': 'Vehicle.Status.fuelRange', 'en': 'fuel range', 'de': 'Kraftstoff-Reichweite' };
const state_s_batteryLevel = { 'label': 'Vehicle.Status.batteryLevel', 'en': 'battery level', 'de': 'Batterie-Füllstand' };
const state_s_batteryRange = { 'label': 'Vehicle.Status.batteryRange', 'en': 'battery range', 'de': 'Batterie-Reicheweite' };
const channel_dw_DoorsAndWindows = { 'label': 'Vehicle.Status.DoorsAndWindows', 'en': 'doors and windows', 'de': 'Türen und Fenster' };
const state_dw_Doors = { 'label': 'Vehicle.Status.DoorsAndWindows.doorsJSON', 'en': 'JSON objekt with windowstates', 'de': 'JSON Objekt Status Türen' };
const state_dw_Windows = { 'label': 'Vehicle.Status.DoorsAndWindows.windowsJSON', 'en': 'JSON object with doorstates', 'de': 'JSON Objekt Status Fenster' };

//##############################################################################################################
// declaring names of states for climater data
const channel_c = { 'label': 'Vehicle.climater', 'en': 'heating / air condition / climater', 'de': 'Heizung / Klimaanlage / Lüftung' };
const state_c_climatisationWithoutHVPower = { 'label': 'Vehicle.climater.climatisationWithoutHVPower', 'en': 'Allow air condition in e-mode', 'de': 'Klimaanlage über Batterie zulassen' };
const state_c_targetTemperature = { 'label': 'Vehicle.climater.targetTemperature', 'en': 'Target temperature', 'de': 'Zieltemperatur' };
const state_c_heaterSource = { 'label': 'Vehicle.climater.heaterSource', 'en': 'Heater source', 'de': 'Heizungs-Quelle' };
const state_c_climatisationReason = { 'label': 'Vehicle.climater.climatisationReason', 'en': 'Climatisation reason', 'de': 'Heizungsbetrieb' };
const state_c_windowHeatingStateFront = { 'label': 'Vehicle.climater.windowHeatingStateFront', 'en': 'State of window heating front', 'de': 'Zustand der Windschutzscheibenheizung' };
const state_c_windowHeatingStateRear = { 'label': 'Vehicle.climater.windowHeatingStateRear', 'en': 'State of window heating rear', 'de': 'Zustand der Heckscheibenheizung' };
const state_c_outdoorTemperature = { 'label': 'Vehicle.climater.outdoorTemperature', 'en': 'Outdoor temperature', 'de': 'Außentemperatur' };
const state_c_vehicleParkingClock = { 'label': 'Vehicle.climater.vehicleParkingClock', 'en': 'Parking timestamp', 'de': 'Parkzeit' };
const state_c_climatisationState = { 'label': 'Vehicle.climater.climatisationState', 'en': 'State of climatisation', 'de': 'Zustand der Standheizung' };
const state_c_remainingClimatisationTime = { 'label': 'Vehicle.climater.remainingClimatisationTime', 'en': 'Remaining climatisation time', 'de': 'Verbleibende Dauer bis Zieltemperatur' };
const state_c_climaterStart = { 'label': 'Vehicle.climater.btn_climaterStart', 'en': 'start heating process', 'de': 'Klimatisieren starten' };
const state_c_climaterStop = { 'label': 'Vehicle.climater.btn_climaterStop', 'en': 'stop heating process', 'de': 'Klimatisieren stoppen' };
const state_c_windowheatStart = { 'label': 'Vehicle.climater.btn_windowheatStart', 'en': 'start windowmelt', 'de': 'Scheibenheizung starten' };
const state_c_windowheatStop = { 'label': 'Vehicle.climater.btn_windowheatStop', 'en': 'stop windowmelt', 'de': 'Scheibenheizung stoppen' };

//##############################################################################################################
// declaring names of states for eManager data
const channel_e = { 'label': 'Vehicle.eManager', 'en': 'e-manager', 'de': 'e-Manager' };
const state_e_stateOfCharge = { 'label': 'Vehicle.eManager.stateOfCharge', 'en': 'Charging state main battery', 'de': 'Ladezustand der Hauptbatterie' };
const state_e_remainingChargingTimeTargetSOC = { 'label': 'Vehicle.eManager.remainingChargingTimeTargetSOC', 'en': 'Remaining charging time until SOC', 'de': 'Verbleibende Ladedauer untere Batterie-Ladegrenze' };
const state_e_chargingMode = { 'label': 'Vehicle.eManager.chargingMode', 'en': 'Charging mode', 'de': 'Lademodus' };
const state_e_chargingState = { 'label': 'Vehicle.eManager.chargingState', 'en': 'Charging state', 'de': 'Zustand des Ladevorgangs' };
const state_e_chargingReason = { 'label': 'Vehicle.eManager.chargingReason', 'en': 'Charging reason', 'de': 'Ladebetrieb' };
const state_e_remainingChargingTime = { 'label': 'Vehicle.eManager.remainingChargingTime', 'en': 'Remaining charging time until 100%', 'de': 'Verbleibende Ladedauer bis 100%' };
const state_e_maxChargeCurrent = { 'label': 'Vehicle.eManager.maxChargeCurrent', 'en': 'Maximun charging current', 'de': 'Maximaler Ladestrom' };
const state_e_plugState = { 'label': 'Vehicle.eManager.plugState', 'en': 'Charging cable plugged', 'de': 'Status Ladestecker' };
const state_e_lockState = { 'label': 'Vehicle.eManager.lockState', 'en': 'Charging cable locked', 'de': 'Verriegelung Ladestecker' };
const state_e_extPowerSupplyState = { 'label': 'Vehicle.eManager.externalPowerSupplyState', 'en': 'External power supply state', 'de': 'Status externe Stromversorgung' };
const state_e_chargerStart = { 'label': 'Vehicle.eManager.btn_chargerStart', 'en': 'start charging process', 'de': 'Ladevorgang starten' };
const state_e_chargerStop = { 'label': 'Vehicle.eManager.btn_chargerStop', 'en': 'stop charging process', 'de': 'Ladevorgang stoppen' };

//##############################################################################################################
// declaring names of states for location data
const channel_l = { 'label': 'Vehicle.location', 'en': 'Location', 'de': 'Ortungsdaten Fahrzeug' };
const state_l_lat = { 'label': 'Vehicle.location.latitude', 'en': 'Latitude', 'de': 'Breitengrad' };
const state_l_lng = { 'label': 'Vehicle.location.longitude', 'en': 'Longitude', 'de': 'Längengrad' };
const state_l_parkingTime = { 'label': 'Vehicle.location.parkingTimeUTC', 'en': 'Parking timestamp', 'de': 'Parkzeit' };
const state_l_address = { 'label': 'Vehicle.location.parkingAddress', 'en': 'Parking address', 'de': 'Parkadresse' };

function stopUpdateTimer() {
    if (myUpdateTimer) {
        clearInterval(myUpdateTimer);
        myUpdateTimer = null;
    }
}
function startUpdateTimer() {
    stopUpdateTimer();
    const updateInterval = parseInt(adapter.config.autoUpdate);
    if (updateInterval > 0) {
        myUpdateTimer = setInterval(autoUpdate, 1000 * 60 * Math.max(updateInterval, 5));
    }
}

function autoUpdate() {
    // Always try to update data. If not logged on, funxction will try to
    // Otherwise: In case of a suspended VW server Connected will become false
    // an there would be no further updates anymore.
    //if (VWCarNet_Connected) // If connected to VW car-net server
    VWCarNetReadData();
}

function CreateStates_common(callback) {
    // creating channel/states for Vehicle Data
    adapter.setObject(channel_v.label, {
        type: 'object',
        common: { name: channel_v[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_v_name.label, {
        type: 'state',
        common: { name: state_v_name[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_v_VIN.label, {
        type: 'state',
        common: { name: state_v_VIN[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_v_Update.label, {
        type: 'state',
        common: { name: state_v_Update[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    return callback(true);
}

function CreateStates_Services(callback) {
    // creating channel/states for available CarNet services
    adapter.setObject(channel_sv.label, {
        type: 'object',
        common: { name: channel_sv[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_sv_statusreport_v1_status.label, {
        type: 'state',
        common: { name: state_sv_statusreport_v1_status[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setState(state_sv_statusreport_v1_status.label, { val: 'Disabled', ack: true });
    adapter.setObject(state_sv_statusreport_v1_eol.label, {
        type: 'state',
        common: { name: state_sv_statusreport_v1_eol[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });

    adapter.setObject(state_sv_rclima_v1_status.label, {
        type: 'state',
        common: { name: state_sv_rclima_v1_status[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setState(state_sv_rclima_v1_status.label, { val: 'Disabled', ack: true });
    adapter.setObject(state_sv_rclima_v1_eol.label, {
        type: 'state',
        common: { name: state_sv_rclima_v1_eol[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });

    adapter.setObject(state_sv_carfinder_v1_status.label, {
        type: 'state',
        common: { name: state_sv_carfinder_v1_status[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setState(state_sv_carfinder_v1_status.label, { val: 'Disabled', ack: true });
    adapter.setObject(state_sv_carfinder_v1_eol.label, {
        type: 'state',
        common: { name: state_sv_carfinder_v1_eol[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });
    adapter.setObject(state_sv_rbatterycharge_v1_status.label, {
        type: 'state',
        common: { name: state_sv_rbatterycharge_v1_status[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setState(state_sv_rbatterycharge_v1_status.label, { val: 'Disabled', ack: true });
    adapter.setObject(state_sv_rbatterycharge_v1_eol.label, {
        type: 'state',
        common: { name: state_sv_rbatterycharge_v1_eol[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });
    return callback(true);
}

function CreateStates_Status(callback) {
    // creating channel/states for selectedVehicle Data
    adapter.setObject(channel_s.label, {
        type: 'channel',
        common: { name: channel_s[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_s_lastConnectionTimeStamp.label, {
        type: 'state',
        common: { name: state_s_lastConnectionTimeStamp[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });
    adapter.setObject(state_s_distanceCovered.label, {
        type: 'state',
        common: { name: state_s_distanceCovered[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value' },
        native: {}
    });

    adapter.setObject(state_s_hybridRange.label, {
        type: 'state',
        common: { name: state_s_hybridRange[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_serviceInspectionDistance.label, {
        type: 'state',
        common: { name: state_s_serviceInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_serviceInspectionTime.label, {
        type: 'state',
        common: { name: state_s_serviceInspectionTime[ioBroker_Language], type: 'number', unit: state_s_serviceInspectionTime['unit_' + ioBroker_Language], read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_adBlueInspectionDistance.label, {
        type: 'state',
        common: { name: state_s_adBlueInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_oilInspectionDistance.label, {
        type: 'state',
        common: { name: state_s_oilInspectionDistance[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_oilInspectionTime.label, {
        type: 'state',
        common: { name: state_s_oilInspectionTime[ioBroker_Language], type: 'number', unit: state_s_oilInspectionTime['unit_' + ioBroker_Language], read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_parkingLights.label, {
        type: 'state',
        common: { name: state_s_parkingLights[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_parkingBrake.label, {
        type: 'state',
        common: { name: state_s_parkingBrake[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_carCentralLock.label, {
        type: 'state',
        common: { name: state_s_carCentralLock[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_fuelType.label, {
        type: 'state',
        common: { name: state_s_fuelType[ioBroker_Language], type: 'string', read: true, write: false, def: '', role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_fuelLevel.label, {
        type: 'state',
        common: { name: state_s_fuelLevel[ioBroker_Language], type: 'number', unit: '%', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_fuelRange.label, {
        type: 'state',
        common: { name: state_s_fuelRange[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_batteryLevel.label, {
        type: 'state',
        common: { name: state_s_batteryLevel[ioBroker_Language], type: 'number', unit: '%', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(state_s_batteryRange.label, {
        type: 'state',
        common: { name: state_s_batteryRange[ioBroker_Language], type: 'number', unit: 'km', read: true, write: false, def: 0, role: 'value' },
        native: {}
    });
    adapter.setObject(channel_dw_DoorsAndWindows.label, {
        type: 'channel',
        common: { name: channel_dw_DoorsAndWindows[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_dw_Doors.label, {
        type: 'state',
        common: { name: state_dw_Doors[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_dw_Windows.label, {
        type: 'state',
        common: { name: state_dw_Windows[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    return callback(true);
}

function CreateStates_climater(callback) {
    if (VWCarNet_GetClimater === false) {
        return callback(true);
    }
    // creating channel/states for climater Data
    adapter.setObject(channel_c.label, {
        type: 'channel',
        common: { name: channel_c[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_c_climatisationWithoutHVPower.label, {
        type: 'state',
        common: { name: state_c_climatisationWithoutHVPower[ioBroker_Language], type: 'boolean', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_targetTemperature.label, {
        type: 'state',
        common: { name: state_c_targetTemperature[ioBroker_Language], type: 'number', unit: '°C', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_heaterSource.label, {
        type: 'state',
        common: { name: state_c_heaterSource[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_climatisationReason.label, {
        type: 'state',
        common: { name: state_c_climatisationReason[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_windowHeatingStateFront.label, {
        type: 'state',
        common: { name: state_c_windowHeatingStateFront[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_windowHeatingStateRear.label, {
        type: 'state',
        common: { name: state_c_windowHeatingStateRear[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_outdoorTemperature.label, {
        type: 'state',
        common: { name: state_c_outdoorTemperature[ioBroker_Language], type: 'number', unit: '°C', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_vehicleParkingClock.label, {
        type: 'state',
        common: { name: state_c_vehicleParkingClock[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });
    adapter.setObject(state_c_climatisationState.label, {
        type: 'state',
        common: { name: state_c_climatisationState[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_remainingClimatisationTime.label, {
        type: 'state',
        common: { name: state_c_remainingClimatisationTime[ioBroker_Language], type: 'number', unit: 'Min', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_c_climaterStart.label, {
        type: 'state',
        common: { name: state_c_climaterStart[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    adapter.setObject(state_c_climaterStop.label, {
        type: 'state',
        common: { name: state_c_climaterStop[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    adapter.setObject(state_c_windowheatStart.label, {
        type: 'state',
        common: { name: state_c_windowheatStart[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    adapter.setObject(state_c_windowheatStop.label, {
        type: 'state',
        common: { name: state_c_windowheatStop[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    return callback(true);
}

function CreateStates_eManager(callback) {
    if (VWCarNet_GetEManager === false) {
        return callback(true);
    }
    // creating channel/states for eManager Data
    adapter.setObject(channel_e.label, {
        type: 'channel',
        common: { name: channel_e[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_e_stateOfCharge.label, {
        type: 'state',
        common: { name: state_e_stateOfCharge[ioBroker_Language], type: 'number', unit: '%', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_remainingChargingTimeTargetSOC.label, {
        type: 'state',
        common: { name: state_e_remainingChargingTimeTargetSOC[ioBroker_Language], type: 'number', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_chargingMode.label, {
        type: 'state',
        common: { name: state_e_chargingMode[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_chargingState.label, {
        type: 'state',
        common: { name: state_e_chargingState[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_chargingReason.label, {
        type: 'state',
        common: { name: state_e_chargingReason[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_remainingChargingTime.label, {
        type: 'state',
        common: { name: state_e_remainingChargingTime[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_maxChargeCurrent.label, {
        type: 'state',
        common: { name: state_e_maxChargeCurrent[ioBroker_Language], type: 'number', unit: 'A', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_plugState.label, {
        type: 'state',
        common: { name: state_e_plugState[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_lockState.label, {
        type: 'state',
        common: { name: state_e_lockState[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_extPowerSupplyState.label, {
        type: 'state',
        common: { name: state_e_extPowerSupplyState[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_e_chargerStart.label, {
        type: 'state',
        common: { name: state_e_chargerStart[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    adapter.setObject(state_e_chargerStop.label, {
        type: 'state',
        common: { name: state_e_chargerStop[ioBroker_Language], type: 'boolean', read: false, write: true, role: 'button' },
        native: {}
    });
    return callback(true);
}

function CreateStates_location(callback) {
    if (VWCarNet_GetLocation === false) {
        return callback(true);
    }
    // creating channel/states for location Data
    adapter.setObject(channel_l.label, {
        type: 'channel',
        common: { name: channel_l[ioBroker_Language] },
        native: {}
    });
    adapter.setObject(state_l_lat.label, {
        type: 'state',
        common: { name: state_l_lat[ioBroker_Language], type: 'number', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_l_lng.label, {
        type: 'state',
        common: { name: state_l_lng[ioBroker_Language], type: 'number', read: true, write: false, role: 'value' },
        native: {}
    });
    adapter.setObject(state_l_parkingTime.label, {
        type: 'state',
        common: { name: state_l_parkingTime[ioBroker_Language], type: 'string', read: true, write: false, role: 'datetime' },
        native: {}
    });
    if (myGoogleMapsAPIKey !== '') {
        adapter.setObject(state_l_address.label, {
            type: 'state',
            common: { name: state_l_address[ioBroker_Language], type: 'string', read: true, write: false, role: 'value' },
            native: {}
        });
    }
    return callback(true);
}

function readCarNetData() {
    startUpdateProcess(4);   // Es stehen vier Calls an
    RetrieveVehicleData_Status(updateSuccessfulFlag);
    RetrieveVehicleData_Location(updateSuccessfulFlag);
    RetrieveVehicleData_eManager(updateSuccessfulFlag);
    RetrieveVehicleData_Climater(updateSuccessfulFlag);
}

function isRequestOk(name, error, response, result) {
    if (error) {
        adapter.log.error('error at ' + name + ': ' + error);
        return false;
    }
    let errorInfo = '';

    switch (response.statusCode) {
        case 200:
        case 202:
        case 204:
            return true;
        case 401:
            errorInfo = 'Username or PW are incorrect =>' + JSON.stringify(response);
            break;
        case 504:
            if (result !== null && typeof result == 'object') {
                if (result.hasOwnProperty('error')) {
                    errorInfo = result.error;
                    if (result.hasOwnProperty('error_description')) {
                        errorInfo += ' - ' + result.error_description;
                    }
                    break;
                }
            }
        default:
            errorInfo = '=> ' + JSON.stringify(response);
    }
    adapter.log.error(name + ': ' + response.statusCode + ' ' + errorInfo);
    return false;
}

// ############################################# start here! ###################################################

function main() {
    adapter.subscribeStates('*.btn_');
    CarNetLogon(function (myTmp) {
        VWCarNet_CredentialsAreValid = myTmp;
        myCarNetDoors['FL'] = { 'closed': false, 'locked': true, 'safe': false };
        myCarNetDoors['RL'] = { 'closed': false, 'locked': true, 'safe': false };
        myCarNetDoors['FR'] = { 'closed': false, 'locked': true, 'safe': false };
        myCarNetDoors['RR'] = { 'closed': false, 'locked': true, 'safe': false };
        myCarNetDoors['hood'] = { 'closed': false };
        myCarNetDoors['rear'] = { 'closed': false, 'locked': false };
        delete myCarNetDoors['doors']; //remove dummy entry
        myCarNetWindows['FL'] = { 'closed': false, 'level': 0 };
        myCarNetWindows['RL'] = { 'closed': false, 'level': 0 };
        myCarNetWindows['FR'] = { 'closed': false, 'level': 0 };
        myCarNetWindows['RR'] = { 'closed': false, 'level': 0 };
        myCarNetWindows['roof'] = { 'closed': false, 'level': 0 };
        delete myCarNetWindows['windows']; //remove dummy entry
        //adapter.log.info('Credentials valid?: ' +  VWCarNet_CredentialsAreValid);
        if (VWCarNet_CredentialsAreValid) {
            //adapter.log.info('Credentials valid - starting adapter')
            RetrieveVehicles(function () {
                RetrieveVehicleData_VINValid(function (myTmp) {
                    VWCarNet_VINIsValid = myTmp;
                    adapter.log.debug('VIN valid: ' + VWCarNet_VINIsValid);
                    VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
                    adapter.setState('connection', { val: VWCarNet_Connected, ack: true });
                    if (VWCarNet_VINIsValid) {
                        adapter.setState(state_v_VIN.label, { val: myVIN, ack: true });
                    } else {
                        adapter.setState(state_v_VIN.label, { val: '', ack: true });
                    }
                    RetrieveVehicleData_operationList(function () {
                        if (VWCarNet_Connected) {
                            readCarNetData();
                        }
                    });

                    //adapter.log.info('VW Car-Net connected?: ' + VWCarNet_Connected);
                });
            });
        }
    });
}

String.prototype.Capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function VWCarNetReadData() {
    CarNetLogon(function (myTmp) {
        VWCarNet_CredentialsAreValid = myTmp;
        VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;
        adapter.log.debug('Credentials valid: ' + VWCarNet_CredentialsAreValid);
        if (VWCarNet_Connected) {
            readCarNetData();
        }
    });
}

function VWCarNetForceCarToSendData() {
    CarNetLogon(function (myTmp) {
        VWCarNet_CredentialsAreValid = myTmp;
        VWCarNet_Connected = VWCarNet_CredentialsAreValid && VWCarNet_VINIsValid;

        if (VWCarNet_Connected) {
            // startUpdateProcess(1);   // Es steht ein Calls an
            requestCarSendData2CarNet(dummyFunc /* updateSuccessfulFlag */);
        }
    });
}

function CarNetLogon(callback) { //retrieve Token for the respective user
    const myUrl = 'https://msg.volkswagen.de/fs-car/core/auth/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/token';
    const myFormdata = {
        'grant_type': 'password',
        'username': adapter.config.email,
        'password': adapter.config.password
    };
    request.post({ url: myUrl, form: myFormdata, headers: myHeaders, json: true }, function (error, response, result) {
        if (isRequestOk('CarNetLogin', error, response, result)) {
            myAuthHeaders.Authorization = 'AudiAuth 1 ' + result.access_token;
            return callback(true);
        } else {
            callback(false); //connection to VW Car-Net not established
        }
    });
}

function RetrieveVehicles(callback) { //retrieve VIN of the first vehicle (Fahrgestellnummer)
    const myVehicleID = 0;
    const myUrl = 'https://msg.volkswagen.de/fs-car/usermanagement/users/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles';
    if (VWCarNet_CredentialsAreValid === false) {
        return callback('not authenticated');
    }
    if (adapter.config.VIN === '') {
        request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, result) {
            adapter.log.debug('Retrieve vehicles: ' + JSON.stringify(result));
            myVIN = result.userVehicles.vehicle[myVehicleID];
            return callback('Count: ' + result.userVehicles.vehicle.length);
        });
    } else {
        myVIN = adapter.config.VIN;
        return callback('default');
    }
}

function RetrieveVehicleData_VINValid(callback) {
    let myVINIsValid = false;
    const myUrl = 'https://msg.volkswagen.de/fs-car/vehicleMgmt/vehicledata/v2/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN;
    request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, result) {
        adapter.log.debug('Retrieve brand and country: ' + JSON.stringify(result));
        try {
            if (result.vehicleData.vin === myVIN) {
                myVINIsValid = true;
                VWCarNet_Brand = result.vehicleData.brand;
                VWCarNet_Country = result.vehicleData.country;
            }
        }
        catch (ex) {
            myVINIsValid = false;
        }
        return callback(myVINIsValid);
    });
}

function RetrieveVehicleData_operationList(callback) {
    if (VWCarNet_Connected === false) { return callback(false); }
    let myService = 0;
    //######### Request Operations
    const myUrl = 'https://msg.volkswagen.de/fs-car/rolesrights/operationlist/v2/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/operations'; //Möglichkeiten von Carnet für entsprechendes FZ abrufen
    request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, result) {
        if (isRequestOk('RequestOperations', error, response, result)) {
            adapter.log.debug('Retrieve operations: ' + JSON.stringify(result));
            const myOperations = result.operationList.serviceInfo;
            for (myService in myOperations) {
                switch (myOperations[myService].serviceId) {
                    case 'statusreport_v1':
                        //adapter.log.info(myOperations[myService].serviceId);
                        adapter.setState(state_sv_statusreport_v1_status.label, { val: myOperations[myService].serviceStatus.status, ack: true });
                        adapter.setState(state_sv_statusreport_v1_eol.label, { val: myOperations[myService].cumulatedLicenseV2.expirationDate, ack: true });
                        VWCarNet_GetStatus = (myOperations[myService].serviceStatus.status === 'Enabled');
                        break;
                    case 'rclima_v1':
                        //adapter.log.info(myOperations[myService].serviceId);
                        adapter.setState(state_sv_rclima_v1_status.label, { val: myOperations[myService].serviceStatus.status, ack: true });
                        adapter.setState(state_sv_rclima_v1_eol.label, { val: myOperations[myService].cumulatedLicenseV2.expirationDate, ack: true });
                        VWCarNet_GetClimater = adapter.config.adapterGetClimater && (myOperations[myService].serviceStatus.status === 'Enabled');
                        break;
                    case 'rbatterycharge_v1':
                        //adapter.log.info(myOperations[myService].serviceId)
                        adapter.setState(state_sv_rbatterycharge_v1_status.label, { val: myOperations[myService].serviceStatus.status, ack: true });
                        adapter.setState(state_sv_rbatterycharge_v1_eol.label, { val: myOperations[myService].cumulatedLicenseV2.expirationDate, ack: true });
                        VWCarNet_GetEManager = adapter.config.adapterGetEManager && (myOperations[myService].serviceStatus.status === 'Enabled');
                        break;
                    case 'carfinder_v1':
                        //adapter.log.info(myOperations[myService].serviceId)
                        adapter.setState(state_sv_carfinder_v1_status.label, { val: myOperations[myService].serviceStatus.status, ack: true });
                        adapter.setState(state_sv_carfinder_v1_eol.label, { val: myOperations[myService].cumulatedLicenseV2.expirationDate, ack: true });
                        VWCarNet_GetLocation = adapter.config.adapterGetLocation && (myOperations[myService].serviceStatus.status === 'Enabled');
                        break;
                    default:
                }
            }
            return callback(true);
        } else {
            return callback(false);
        }
    });
}

function RetrieveVehicleData_Status(callback) {
    if (VWCarNet_GetStatus === false) { return callback(true); }
    if (VWCarNet_Connected === false) { return callback(false); }
    let myData = 0;
    let myField = 0;
    let myReceivedDataKey;
    let myParkingLight;
    const myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/status';
    try {
        request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, result) {
            if (isRequestOk('getStatus', error, response, result)) {
                if (result.error !== undefined) {
                    adapter.log.error('Error while retrieving status: ' + JSON.stringify(result.error));
                    return callback(false);
                }

                result.StoredVehicleDataResponse.vin = 'ANONYMIZED_VIN_FOR_LOGGING';
                adapter.log.debug('Retrieve status: ' + JSON.stringify(result));

                const vehicleData = result.StoredVehicleDataResponse.vehicleData;

                adapter.setState(state_s_lastConnectionTimeStamp.label, { val: vehicleData.data[myData].field[myField].tsCarSentUtc, ack: true });

                for (myData in vehicleData.data) {
                    for (myField in vehicleData.data[myData].field) {
                        myReceivedDataKey = vehicleData.data[myData].field[myField];
                        switch (vehicleData.data[myData].id + '.' + vehicleData.data[myData].field[myField].id) {
                            case '0x0101010002.0x0101010002': //distanceCovered
                                adapter.setState(state_s_distanceCovered.label, { val: myReceivedDataKey.value, ack: true });
                                break;
                            case '0x0204FFFFFF.0x02040C0001': //adBlueInspectionData_km
                                adapter.setState(state_s_adBlueInspectionDistance.label, { val: myReceivedDataKey.value, ack: true });
                                break;
                            case '0x0203FFFFFF.0x0203010001': //oilInspectionData_km
                                adapter.setState(state_s_oilInspectionDistance.label, { val: myReceivedDataKey.value * -1, ack: true });
                                break;
                            case '0x0203FFFFFF.0x0203010002': //oilInspectionData_days
                                adapter.setState(state_s_oilInspectionTime.label, { val: myReceivedDataKey.value * -1, ack: true });
                                break;
                            case '0x0203FFFFFF.0x0203010003': //serviceInspectionData_km
                                adapter.setState(state_s_serviceInspectionDistance.label, { val: myReceivedDataKey.value * -1, ack: true });
                                break;
                            case '0x0203FFFFFF.0x0203010004': //serviceInspectionData_days
                                adapter.setState(state_s_serviceInspectionTime.label, { val: myReceivedDataKey.value * -1, ack: true });
                                break;
                            case '0x030101FFFF.0x0301010001': //status_parking_light_off
                                myParkingLight = myReceivedDataKey.value;
                                break;
                            case '0x030103FFFF.0x0301030001': //parking brake
                                adapter.setState(state_s_parkingBrake.label, { val: 'textId' in myReceivedDataKey ? myReceivedDataKey.textId : myReceivedDataKey.value, ack: true });
                                break;
                            case '0x030103FFFF.0x0301030007': //fuel type
                                adapter.setState(state_s_fuelType.label, { val: 'textId' in myReceivedDataKey ? myReceivedDataKey.textId.replace('engine_type_', '').replace('unsupported', '-').Capitalize() : myReceivedDataKey.value, ack: true });
                                break;
                            case '0x030103FFFF.0x030103000A': //fuel level
                                adapter.setState(state_s_fuelLevel.label, { val: myReceivedDataKey.value, ack: true });
                                break;
                            case '0x030103FFFF.0x0301030006': //fuel range
                                adapter.setState(state_s_fuelRange.label, { val: 'value' in myReceivedDataKey ? myReceivedDataKey.value * 1 : 0, ack: true });
                                break;
                            case '0x030103FFFF.0x0301030009': //secondary_typ - erst ab Modelljahr 2018
                                break;
                            case '0x030103FFFF.0x0301030002': //soc_ok
                                adapter.setState(state_s_batteryLevel.label, { val: myReceivedDataKey.value, ack: true });
                                break;
                            case '0x030103FFFF.0x0301030008': //secondary_range - erst ab Modelljahr 2018
                                adapter.setState(state_s_batteryRange.label, { val: 'value' in myReceivedDataKey ? myReceivedDataKey.value * 1 : 0, ack: true });
                                break;
                            case '0x030103FFFF.0x0301030005': //hybrid_range - erst ab Modelljahr 2018
                                adapter.setState(state_s_hybridRange.label, { val: myReceivedDataKey.value, ack: true });
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
                            //door2 - rear/left
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
                            //door4 - rear/right
                            case '0x030104FFFF.0x030104000A':
                                myCarNetDoors.RR.locked = myReceivedDataKey.value === '2';
                                break;
                            case '0x030104FFFF.0x030104000B':
                                myCarNetDoors.RR.closed = myReceivedDataKey.value === '3';
                                break;
                            case '0x030104FFFF.0x030104000C':
                                myCarNetDoors.RR.safe = myReceivedDataKey.value === '2';
                                break;
                            //door5 - rear
                            case '0x030104FFFF.0x030104000D':
                                myCarNetDoors.rear.locked = myReceivedDataKey.value === '2';
                                break;
                            case '0x030104FFFF.0x030104000E':
                                myCarNetDoors.rear.closed = myReceivedDataKey.value === '3';
                                break;
                            case '0x030104FFFF.0x030104000F':
                                //myCarNetDoors.rear.safe = myReceivedDataKey.value === '2';
                                break;
                            //door6 - hood
                            case '0x030104FFFF.0x0301040010':
                                //myCarNetDoors.hood.locked = myReceivedDataKey.value === '2';
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
                            //window4 - roof window
                            case '0x030105FFFF.0x030105000B':
                                myCarNetWindows.roof.closed = myReceivedDataKey.value === '3';
                                break;
                            case '0x030105FFFF.0x030105000C':
                                myCarNetWindows.roof.level = myReceivedDataKey.value;
                                break;
                            default: //this should not be possible
                        }
                    }
                }

                adapter.setState(state_dw_Doors.label, { val: JSON.stringify(myCarNetDoors), ack: true });
                adapter.setState(state_dw_Windows.label, { val: JSON.stringify(myCarNetWindows), ack: true });

                adapter.setState(state_s_carCentralLock.label, { val: myCarNetDoors.FL.locked && myCarNetDoors.FR.locked, ack: true });

                switch (myParkingLight) {
                    case '3':
                        adapter.setState(state_s_parkingLights.label, { val: 'left=on, right=off', ack: true });
                        break;
                    case '4':
                        adapter.setState(state_s_parkingLights.label, { val: 'left=off, right=on', ack: true });
                        break;
                    case '5':
                        adapter.setState(state_s_parkingLights.label, { val: 'left=on, right=on', ack: true });
                        break;
                    default:
                        adapter.setState(state_s_parkingLights.label, { val: 'off', ack: true });
                }
                return callback(true);
            } else {
                return callback(false);
            }
        });
    } catch (err) {
        adapter.log.error('Error while retrieving status: ' + err);
        return callback(false);
    }
}

function RetrieveVehicleData_Climater(callback) {
    if (VWCarNet_GetClimater === false) { return callback(true); }
    if (VWCarNet_Connected === false) { return callback(false); }

    let myTemperatureCelsius = 0;
    const myUrl = 'https://msg.volkswagen.de/fs-car/bs/climatisation/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/climater';
    request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, responseData) {
        if (isRequestOk('getClimater', error, response, responseData)) {
            adapter.log.debug('Retrieve climater: ' + JSON.stringify(responseData));

            const climaterSettings = responseData.climater.settings;
            if (climaterSettings !== null) {
                if (isNaN(climaterSettings.targetTemperature.content)) {
                    myTemperatureCelsius = 999;
                } else {
                    myTemperatureCelsius = (parseFloat(climaterSettings.targetTemperature.content) / 10) - 273;
                }
                adapter.setState(state_c_targetTemperature.label, { val: myTemperatureCelsius.toFixed(1), ack: true });
                myTemperatureCelsius = null;
                adapter.setState(state_c_climatisationWithoutHVPower.label, { val: climaterSettings.climatisationWithoutHVpower.content, ack: true });
                adapter.setState(state_c_heaterSource.label, { val: climaterSettings.heaterSource.content.toUpperCase(), ack: true });
            }

            const climatisationStatusData = responseData.climater.status.climatisationStatusData;
            if (climatisationStatusData !== undefined) {
                adapter.setState(state_c_climatisationState.label, { val: climatisationStatusData.climatisationState.content.toUpperCase(), ack: true });
                //adapter.log.info(climatisationStatusData.climatisationStateErrorCode.content);

                const myRemainingTime = climatisationStatusData.remainingClimatisationTime.content;
                //var myRemainingTimeStr = Math.floor( myRemainingTime / 60 ) + ':' + ('00' + Math.floor( myRemainingTime%60 )).substr(-2);
                let myRemainingTimeStr = myRemainingTime;
                if (myRemainingTime < 0) { myRemainingTimeStr = null; }
                adapter.setState(state_c_remainingClimatisationTime.label, { val: myRemainingTimeStr, ack: true });
                adapter.setState(state_c_climatisationReason.label, { val: climatisationStatusData.climatisationReason.content.toUpperCase(), ack: true });
            }
            const windowHeatingStatusData = responseData.climater.status.windowHeatingStatusData;
            if (windowHeatingStatusData !== undefined) {
                adapter.setState(state_c_windowHeatingStateFront.label, { val: windowHeatingStatusData.windowHeatingStateFront.content.toUpperCase(), ack: true });
                adapter.setState(state_c_windowHeatingStateRear.label, { val: windowHeatingStatusData.windowHeatingStateRear.content.toUpperCase(), ack: true });
                //adapter.log.info(windowHeatingStatusData.windowHeatingErrorCode.content);
            }
            const temperatureStatusData = responseData.climater.status.temperatureStatusData;
            if (isNaN(temperatureStatusData.outdoorTemperature.content)) {
                myTemperatureCelsius = 999;
            } else {
                myTemperatureCelsius = (parseFloat(temperatureStatusData.outdoorTemperature.content) / 10) - 273;
            }
            adapter.setState(state_c_outdoorTemperature.label, { val: myTemperatureCelsius.toFixed(1), ack: true });
            myTemperatureCelsius = null;

            const vehicleParkingClockStatusData = responseData.climater.status.vehicleParkingClockStatusData;
            if (vehicleParkingClockStatusData !== undefined) {
                adapter.setState(state_c_vehicleParkingClock.label, { val: vehicleParkingClockStatusData.vehicleParkingClock.content, ack: true });
            } else {
                adapter.setState(state_c_vehicleParkingClock.label, { val: 'MOVING', ack: true });
            }
            return callback(true);
        } else {
            return callback(false);
        }
    });
}

function RetrieveVehicleData_eManager(callback) {
    if (VWCarNet_GetEManager === false) { return callback(true); }
    if (VWCarNet_Connected === false) { return callback(false); }

    const myUrl = 'https://msg.volkswagen.de/fs-car/bs/batterycharge/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/charger';
    try {
        request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, result) {
            if (isRequestOk('geteManager', error, response, result)) {
                adapter.log.debug('Retrieve charger: ' + JSON.stringify(result));

                const chargerSettings = result.charger.settings;
                if (chargerSettings !== '') {
                    myCarNet_MaxChargeCurrent = chargerSettings.maxChargeCurrent.content;
                    adapter.setState(state_e_maxChargeCurrent.label, { val: myCarNet_MaxChargeCurrent, ack: true });
                }

                const chargingStatusData = result.charger.status.chargingStatusData;
                if (chargingStatusData !== undefined) {
                    adapter.setState(state_e_chargingMode.label, { val: chargingStatusData.chargingMode.content.toUpperCase(), ack: true });
                    //adapter.log.info('eManager/chargingStateErrorCode: ' + chargingStatusData.chargingStateErrorCode.content);

                    adapter.setState(state_e_chargingReason.label, { val: chargingStatusData.chargingReason.content.toUpperCase(), ack: true });

                    myCarNet_PowerSupplyState = chargingStatusData.externalPowerSupplyState.content.toUpperCase();
                    adapter.setState(state_e_extPowerSupplyState.label, { val: myCarNet_PowerSupplyState, ack: true });
                    //adapter.log.info('eManager/energyFlow: ' + chargingStatusData.energyFlow.content);

                    myCarNet_myChargingState = chargingStatusData.chargingState.content.toUpperCase();
                    adapter.setState(state_e_chargingState.label, { val: myCarNet_myChargingState, ack: true });
                }

                // adapter.log.info(cruisingRangeStatusData.engineTypeFirstEngine.content);
                // adapter.log.info(cruisingRangeStatusData.primaryEngineRange.content);
                // adapter.log.info(cruisingRangeStatusData.hybridRange.content);
                // adapter.log.info(cruisingRangeStatusData.engineTypeSecondEngine.content);
                // adapter.log.info(cruisingRangeStatusData.secondaryEngineRange.content);

                const ledStatusData = result.charger.status.ledStatusData;
                if (ledStatusData !== undefined) {
                    //adapter.log.info('eManager/ledColor: ' + ledStatusData.ledColor.content);
                    //adapter.log.info('eManager/ledState: ' + ledStatusData.ledState.content);
                }

                const batteryStatusData = result.charger.status.batteryStatusData;
                if (batteryStatusData !== undefined) {
                    adapter.setState(state_e_stateOfCharge.label, { val: batteryStatusData.stateOfCharge.content, ack: true });
                    const myRemainingTime = batteryStatusData.remainingChargingTime.content;
                    let myRemainingTimeStr = Math.floor(myRemainingTime / 60) + ':' + ('00' + Math.floor(myRemainingTime % 60)).substr(-2);
                    if (myRemainingTime < 0) { myRemainingTimeStr = null; }
                    adapter.setState(state_e_remainingChargingTime.label, { val: myRemainingTimeStr, ack: true });
                    adapter.setState(state_e_remainingChargingTimeTargetSOC.label, { val: batteryStatusData.remainingChargingTimeTargetSOC.content, ack: true });
                }

                const plugStatusData = result.charger.status.plugStatusData;
                if (plugStatusData !== undefined) {
                    adapter.setState(state_e_plugState.label, { val: plugStatusData.plugState.content.toUpperCase(), ack: true });
                    adapter.setState(state_e_lockState.label, { val: plugStatusData.lockState.content.toUpperCase(), ack: true });
                }

                return callback(true);
            } else {
                return callback(false);
            }
        });
    } catch (err) {
        adapter.log.error('Error while retrieving charger: ' + err);
        return callback(false);
    }
}

function setCarIsMoving() {
    adapter.getState(state_l_address.label, function (err, obj) {
        if (err) {
            adapter.log.error(err);
        } else {
            adapter.setState(state_l_lat.label, { val: null, ack: true });
            adapter.setState(state_l_lng.label, { val: null, ack: true });
            adapter.setState(state_l_parkingTime.label, { val: null, ack: true });
            let newAddress = obj.val;
            if (newAddress.substr(0, 6) != 'MOVING') {
                if (newAddress)
                    newAddress = 'MOVING from ' + newAddress;
                else
                    newAddress = 'MOVING';
            }
            adapter.setState(state_l_address.label, { val: newAddress, ack: true });
        }
    });

}

function RetrieveVehicleData_Location(callback) {
    if (VWCarNet_GetLocation === false) { return callback(true); }
    if (VWCarNet_Connected === false) { return callback(false); }

    const myUrl = 'https://msg.volkswagen.de/fs-car/bs/cf/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/position';

    if (VWCarNet_GetLocation === false) {
        adapter.setState(state_l_lat.label, { val: null, ack: true });
        adapter.setState(state_l_lng.label, { val: null, ack: true });
        adapter.setState(state_l_parkingTime.label, { val: null, ack: true });
        adapter.setState(state_l_address.label, { val: null, ack: true });
    }

    try {
        request.get({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, responseData) {
            if (isRequestOk('getClimater', error, response, responseData)) {

                if (response.statusCode == 204) {
                    setCarIsMoving();
                    return callback(true);
                }

                adapter.log.debug('Retrieve position: ' + JSON.stringify(responseData));

                if ('findCarResponse' in responseData) {
                    const findCarResponse = responseData.findCarResponse;
                    if (findCarResponse !== undefined && findCarResponse !== null) {
                        adapter.setState(state_l_lat.label, {
                            val: findCarResponse.Position.carCoordinate.latitude / 1000000,
                            ack: true
                        });
                        adapter.setState(state_l_lng.label, {
                            val: findCarResponse.Position.carCoordinate.longitude / 1000000,
                            ack: true
                        });
                        adapter.setState(state_l_parkingTime.label, { val: findCarResponse.parkingTimeUTC, ack: true });
                        requestGeocoding(findCarResponse.Position.carCoordinate.latitude, findCarResponse.Position.carCoordinate.longitude);
                    } else {
                        setCarIsMoving();
                    }
                } else {
                    setCarIsMoving();
                }
                return callback(true);
            } else {
                return callback(false);
            }
        });
    } catch (err) {
        adapter.log.error('Fehler bei der Auswertung im location Modul');
        return callback(false);
    }
}

function requestGeocoding(lat, lng) {
    let myUrl = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat / 1000000 + ',' + lng / 1000000;
    let myAddress = '<UNKNOWN>';
    if (myGoogleMapsAPIKey !== '') {
        myUrl = myUrl + '&key=' + myGoogleMapsAPIKey;
        //adapter.log.info(myUrl);
        try {
            request.get({ url: myUrl, headers: myGoogleDefaulHeader, json: true }, function (error, response, result) {
                //adapter.log.info(response.statusCode);
                //adapter.log.info(JSON.stringify(result));

                if ((result.results.length > 0) && result.results[0].formatted_address !== '') {
                    myAddress = result.results[0].formatted_address;
                }
                adapter.setState(state_l_address.label, { val: myAddress, ack: true });
                //adapter.log.info(myAddress);
            });
        } catch (err) {
            adapter.setState(state_l_address.label, { val: null, ack: true });
            if (err.response) adapter.log.error(err.response.statusCode);
        }
    } else {
        adapter.setState(state_l_address.label, { val: null, ack: true });
    }
}

function requestCarSendData2CarNet(callback) {
    if (VWCarNet_Connected === false) { return callback(false); }
    //Requesting car to send it's data to the server
    const myUrl = 'https://msg.volkswagen.de/fs-car/bs/vsr/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/requests';
    try {
        request.post({ url: myUrl, headers: myAuthHeaders, json: true }, function (error, response, result) {
            adapter.log.debug(response.statusCode);

            if (response.statusCode === 202) {
                adapter.log.debug('RequestID: ' + result.CurrentVehicleDataResponse.requestId);
                return callback(true);
            } else {
                return callback(false);
            }
        });
    } catch (err) {
        //adapter.log.error('Fehler bei Post-Befehl')
        return callback(false);
    }
}

function requestCarSwitchCharger(myAction, callback) {
    //adapter.log.info(myCarNet_myChargingState)
    //adapter.log.info(myCarNet_MaxChargeCurrent + ' Ampere')
    //adapter.log.info('Electrical Power is ' + myCarNet_PowerSupplyState)
    if (VWCarNet_Connected === false) { return callback(false); } //quit if not connected
    if (myCarNet_myChargingState === 'OFF' && myAction === 'stop') { return callback(false); } //quit if command is 'stop' and charger is inactive
    if (myCarNet_myChargingState === 'CHARGING' && myAction === 'start') { return callback(false); } //quit if command is 'start' and charger is already active
    if (isNaN(myCarNet_MaxChargeCurrent) && myAction === 'start') { return callback(false); } //quit if maxCurrent is not a valid number
    if (myCarNet_PowerSupplyState !== 'AVAILABLE' && myAction === 'start') { return callback(false); } //quit if command is 'start' and no powersupply is connected

    const myPushHeaders = JSON.parse(JSON.stringify(myAuthHeaders));
    myPushHeaders['Content-Type'] = 'application/vnd.vwg.mbb.ChargerAction_v1_0_0+xml;charset=utf-8';
    myPushHeaders['Accept'] = 'application/vnd.vwg.mbb.ChargerAction_v1_0_0+xml, application/vnd.volkswagenag.com-error-v1+xml, application/vnd.vwg.mbb.genericError_v1_0_2+xml';
    //Requesting car start charge with it's max allowed current
    const myUrl = 'https://msg.volkswagen.de/fs-car/bs/batterycharge/v1/' + VWCarNet_Brand + '/' + VWCarNet_Country + '/vehicles/' + myVIN + '/charger/actions';
    let myData;
    if (myAction === 'start') { myData = '<?xml version="1.0" encoding= "UTF-8" ?> <action> <type>start</type> <settings> <maxChargeCurrent>' + myCarNet_MaxChargeCurrent + '</maxChargeCurrent> </settings> </action>'; }
    if (myAction === 'stop') { myData = '<?xml version="1.0" encoding= "UTF-8" ?> <action> <type>stop</type> </action>'; }
    if (myData === '') { return callback(false); }
    //adapter.log.info(myData)
    try {
        request.post({ url: myUrl, body: myData, headers: myPushHeaders }, function (error, response) {
            if (response.statusCode === 202) {
                adapter.log.info('charger-command ' + myAction + ' successful');
                return callback(false);
            } else {
                adapter.log.error('charger-command ' + myAction + ' failed');
                return callback(false);
            }
        });
    } catch (err) {
        return callback(false);
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}