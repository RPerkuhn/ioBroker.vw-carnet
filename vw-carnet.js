'use strict';
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('vw-carnet');
const my_key = 'Zgfr56gFe87jJOM'

let VWCarNet_Connected = false;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        VWCarNet_Connected = false
        adapter.setState('connection', {val: VWCarNet_Connected}); //connection to Threema gateway not established
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
// var email     = "#####"; // User Car-Net-Account
// var password  = "#####"; // Passwort Car-Net-Account
var mapsApiKey= "";                       // API-Key für Google Maps Platform (noch optional)
var errCount  = 0;  // Anzahl zulässige Fehler bis Mail verschickt wird
var defaultHeader = {
    'Accept': 'application/json, text/plain, */*',
	'Content-Type': 'application/json;charset=UTF-8',
	'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; D5803 Build/23.5.A.1.291; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/63.0.3239.111 Mobile Safari/537.36'
};

// declaring names for states for Vehicle data
const channel_v = "Vehicle";
const state_v_name = "Vehicle.name";
const channel_vc = "Vehicle.selectedVehicle";
const state_vc_lastConnectionTimeStamp   = "Vehicle.selectedVehicle.lastConnectionTimeStamp";
const state_vc_distanceCovered     = "Vehicle.selectedVehicle.distanceCovered";
const state_vc_range  = "Vehicle.selectedVehicle.range";
const state_vc_serviceInspectionData= "Vehicle.selectedVehicle.serviceInspectionData";
const state_vc_oilInspectionData= "Vehicle.selectedVehicle.oilInspectionData";

// declaring names for states for eManager data
const channel_e = "Vehicle.selectedVehicle.eManager";
const state_e_batteryPercentage = "Vehicle.selectedVehicle.eManager.batteryPercentage";
const state_e_chargingState = "Vehicle.selectedVehicle.eManager.chargingState";
const state_e_chargingRemaining = "Vehicle.selectedVehicle.eManager.chargingRemaining";
const state_e_electricRange = "Vehicle.selectedVehicle.eManager.electricRange";
const state_e_combustionRange = "Vehicle.selectedVehicle.eManager.combustionRange"
const state_e_combinedRange = "Vehicle.selectedVehicle.eManager.combinedRange"
const state_e_minChargeLimit = "Vehicle.selectedVehicle.eManager.minChargeLimit";
const state_e_pluginState = "Vehicle.selectedVehicle.eManager.pluginState"
const state_e_extPowerSupplyState = "Vehicle.selectedVehicle.eManager.extPowerSupplyState"
const state_e_climatisationWithoutHVPower = "Vehicle.selectedVehicle.eManager.climatisationWithoutHVPower";

// declaring names for states for location data
const channel_l = "Vehicle.selectedVehicle.location";
const state_l_lat = "Vehicle.selectedVehicle.location.lat";
const state_l_lng = "Vehicle.selectedVehicle.location.lng";
const state_l_address = "Vehicle.selectedVehicle.location.address";

// declaring names for states for status data
const channel_s = "Vehicle.selectedVehicle.status";
const state_s_areDoorsAndWindowsClosed = "Vehicle.selectedVehicle.status.areDoorsAndWindowsClosed";
const state_s_areLightsOff = "Vehicle.selectedVehicle.status.areLightsOff";
const state_s_carCentralLock = "Vehicle.selectedVehicle.status.carCentralLock";

// creating channel/states for selectedVehicle Data
adapter.setObject(channel_v, {
    type: 'channel',
    common: {name: 'Fahrzeug'},
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
adapter.setObject(channel_vc, {
    type: 'channel',
    common: {name: 'ausgewähltes Fahrzeug'},
    native: {}
});
adapter.setObject(state_vc_lastConnectionTimeStamp, {
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
adapter.setObject(state_vc_distanceCovered, {
    type: 'state',
    common: {
        name: 'Kilometerstand',
        type: 'number',
        read: true,
        write: false,
        unit: "km",
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_vc_range, {
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
adapter.setObject(state_vc_serviceInspectionData, {
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
adapter.setObject(state_vc_oilInspectionData, {
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

// creating channel/states for eManager Data
adapter.setObject(channel_e, {
    type: 'channel',
    common: {name: 'e-Manager'},
    native: {}
});
adapter.setObject(state_e_batteryPercentage, {
    type: 'state',
    common: {
        name: "Ladezustand der Hauptbatterie in 10%-Schritten",
        type: "number",
        unit: "%",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_chargingState, {
    type: 'state',
    common: {
        name: "Zustand des Ladevorgangs",
        type: "string",
        unit: "",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_chargingRemaining, {
    type: 'state',
    common: {
        name: "Verbleibende Ladedauer bis 100% SoC",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_electricRange, {
    type: 'state',
    common: {
        name: "Elektrische Reichweite mit aktuellem Batteriestand",
        type: "number",
        unit: "km",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_combustionRange, {
    type: 'state',
    common: {
        name: "Reichweite Benzinmotor mit aktuellem Tankinhalt",
        type: "number",
        unit: "km",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_combinedRange, {
    type: 'state',
    common: {
        name: "Reichweite kombiniert",
        type: "number",
        unit: "km",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_minChargeLimit, {
    type: 'state',
    common: {
        name: "Untere Batterie-Ladegrenze",
        type: "number",
        unit: "%",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_climatisationWithoutHVPower, {
    type: 'state',
    common: {
        name: "Klimatisierung/Scheibenheizung über Batterie zulassen",
        type: "boolean",
        //type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_pluginState, {
    type: 'state',
    common: {
        name: "Ladestecker eingesteckt",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_e_extPowerSupplyState, {
    type: 'state',
    common: {
        name: "Ext. Stromversorgung",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});


// creating channel/states for location Data
adapter.setObject(channel_l, {
    type: 'channel',
    common: {name: 'Parkposition'},
    native: {}
});
adapter.setObject(state_l_lat, {
    type: 'state',
    common: {
        name: "Breitengrad der Position des Fahrzeugs",
        type: "number",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_l_lng, {
    type: 'state',
    common: {
        name: "Längengrad der Position des Fahrzeugs",
        type: "number",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_l_address, {
    type: 'state',
    common: {
        name: "Anschrift der Position des Fahrzeugs",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});

// creating channel/states for status Data
adapter.setObject(channel_s, {
    type: 'channel',
    common: {name: 'status'},
    native: {}
});
adapter.setObject(state_s_areDoorsAndWindowsClosed, {
    type: 'state',
    common: {
        name: "Türen/Fenster",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_s_areLightsOff, {
    type: 'state',
    common: {
        name: "Lichter",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});
adapter.setObject(state_s_carCentralLock, {
    type: 'state',
    common: {
        name: "Zentralverriegelung",
        type: "string",
        read: true,
        write: false,
        role: 'value'
    },
    native: {}
});

// ##################################### start here! ##############################################
adapter.on('ready', function () {
    VWCarNetCheckConnect()
    main()
    doRequest();
    adapter.setState('connection', {val: VWCarNet_Connected, ack: true});
});

function main() {

    adapter.setState('connection', {val: VWCarNet_Connected, ack: true});

}

function decrypt(key, value) {
	var result = '';
	for(var i = 0; i < value.length; i++) {
		result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
	}
	return result;
}


function VWCarNetCheckConnect() {
    VWCarNet_Connected = true
}

function carNet_error(meldung, typ) {
    if (typ === undefined)
        typ = "";

    adapter.log.error('CarNet: ' + meldung, 'error');
    if (typ == "main") {
        errCount ++;
        if (errCount < 3)
            sendMail = false;
    }
}

function getPartOfSite(content, startTag, endTag, startOffset) {
    if (startOffset === undefined)
        startOffset = 0;
    var pos = content.indexOf(startTag, startOffset);
    if (pos >= 0) {
        pos += startTag.length;
        var pos2 = content.indexOf(endTag, pos +1);
        if (pos2 >= 0) {
            return {
                found: true,
                value: content.substring(pos, pos2).trim(),
                start: pos,
                end:   pos2,
                cutter: pos2 + endTag.length
            };
        }
    }
    return null;
}

function get_csrf(body) {
    var data = getPartOfSite(body, '<meta name="_csrf" content="', '"/>');
    if (data === null) {
        carNet_error('Kein Token für Login gefunden\n' + body);
        return "";
    }
    return data.value;
}

function get_loginUrl(body) {
    var data = getPartOfSite(body, '"path":"', '"');
    if (data === null) {
        carNet_error('Keine Login-URL gefunden\n' + body);
        return "";
    }
    return data.value;
}

function get_viewState(body) {
    var data = getPartOfSite(body, 'name="javax.faces.ViewState" id="j_id1:javax.faces.ViewState:0" value="', '"');
    if (data === null) {
        carNet_error('Keinen Viewstate für Login gefunden\n' + body);
        return "";
    }
    return data.value.replace(/\\x3a/g, ":").replace(/\\x2f/g, "/").replace(/\\x2e/g, ".");
}

function get_redirectUrl(body) {
    var data = getPartOfSite(body, '<redirect url="', '"></redirect>');
    if (data === null) {
        carNet_error('Keine Redirect-URL nach Login gefunden\n' + body);
        return "";
    }
    return data.value.replace('&amp;', '&');
}

function get_code(body) {
    var data = getPartOfSite(body, 'code=', '&');
    if (data === null) {
        carNet_error('Keinen Code nach Login gefunden\n' + body);
        return "";
    }
    return data.value;
}

function get_state(body) {
    // Hier indexOf anstelle getPartOfsite, weil es keinen EndeString gibt
    var pos = body.indexOf('state=');
    if (pos < 0) {
        carNet_error('Keinen State nach Login gefunden\n' + body);
        return "";
    }
    return body.substr(pos + 6);
}

function get_newUrl(url) {
    var data = getPartOfSite(url, '/', '?', 10);
    if (data === null) {
        carNet_error('Konnte keinen Path aus URL ' + url + ' extrahieren');
        return "";
    }
    return base + '/' + data.value + '?p_auth=' + state + '&p_p_id=33_WAR_cored5portlet&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_count=1&_33_WAR_cored5portlet_javax.portlet.action=getLoginStatus';
}

function get_request(url, mayRedirect, forms, doJSON) {
    var options = {
        url: url,
        jar: cookieJar
    };
    if (urlHeader !== null)
        options.headers = urlHeader;
    if (mayRedirect === undefined || mayRedirect === null)
        mayRedirect = true;
    if (! mayRedirect)
        options.followRedirect = function (resp) { return false; };
    if (forms !== undefined)
        options.form = forms;
    if (doJSON === undefined || doJSON === null)
        doJSON = false;
    if (doJSON)
        options.json = true;
    return options;
}

function isAbrufOk(oper, err, stat, body) {
    if (err)
        carNet_error('Fehler "' + err + '" beim ' + oper);
    else if(body) {
        return true;
    } else
        carNet_error("Kein Inhalt bei " + oper + " (Status " + stat.statusCode + ")");
    return false;
}

function isRedirectOk(oper, err, stat, body) {
    if (err)
        carNet_error('Fehler "' + err + '" beim ' + oper);
    else if(stat.statusCode == 302) {
        return true;
    } else
        carNet_error(oper + " ist keine Weiterleitung (Status " + stat.statusCode + "): " + body);
    return false;
}

function carNet_login() {
    csrf      = "";
    refUrl    = "";
    viewState = "";
    cookieJar = request.jar();
    urlHeader = null;
    code      = "";
    state     = "";
    request(get_request(base + '/portal/en_GB/web/guest/home'), process_login1);
}

function process_login1(err, stat, body) {
    if (isAbrufOk("Login-Seite", err, stat, body)) {
        urlHeader = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; D5803 Build/23.5.A.1.291; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/63.0.3239.111 Mobile Safari/537.36',
            'Referer': base + '/portal'
        };
        var detailsUrl = stat.request.uri.href;
        csrf = get_csrf(body);
        if (csrf === "")
            return;
        //adapter.log.info("Session = " + csrf);
        request(get_request(base + "/portal/web/guest/home/-/csrftokenhandling/get-login-url"), process_login2);
    }
}

function process_login2(err, stat, body) {
    if (isAbrufOk("Login-Seite 2", err, stat, body)) {
        var loginUrl = get_loginUrl(body);
        if (loginUrl === "")
            return;
        //adapter.log.info('Login-URL: ' + loginUrl);
        request.get(get_request(loginUrl, false), process_login3);
    }
}

function process_login3(err, stat, body) {
    if (isRedirectOk("Login-Setie 3", err, stat, body)) {
        refUrl = stat.headers.location;
        if (refUrl === "") {
            carNet_error("Keine Location für Redirect gefunden");
            return;
        }
        //adapter.log.info('refURL: ' + refUrl);
        request.get(get_request(refUrl), process_login4);
    }
}

function process_login4(err, stat, body) {
    if (isAbrufOk("Login-Setie 4", err, stat, body)) {
        viewState = get_viewState(body);
        if (viewState === "")
            return;
        //adapter.log.info('ViewState = ' + viewState);
        var formData = {
            'loginForm': 'loginForm',
            'loginForm:email': adapter.config.email,
            'loginForm:password': decrypt(my_key, adapter.config.password),
            'loginForm:j_idt19': '',
            'javax.faces.ViewState': viewState,
            'javax.faces.source': 'loginForm:submit',
            'javax.faces.partial.event': 'click',
            'javax.faces.partial.execute': 'loginForm:submit loginForm',
            'javax.faces.partial.render': 'loginForm',
            'javax.faces.behavior.event': 'action',
            'javax.faces.partial.ajax': 'true'
        };
        // AuthHeader aktualisieren
        urlHeader['Faces-Request'] = 'partial/ajax';
        urlHeader.Referer = refUrl;
        urlHeader['X-CSRF-Token'] = '';
        request.post(get_request(authbase + '/ap-login/jsf/login.jsf', null, formData), process_login5);
    }
}

function process_login5(err, stat, body) {
    if (isAbrufOk("Login-Seite 5", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        var redirectUrl = get_redirectUrl(body);
        if (redirectUrl === "")
            return;
        request.get(get_request(redirectUrl, false), process_login6);
    }
}

function process_login6(err, stat, body) {
    if (isRedirectOk("Login-Seite 6", err, stat, body)) {
        var redirectUrl2 = stat.headers.location;
        if (redirectUrl2 === "") {
            carNet_error("Keine Location für Redirect2 gefunden");
            return;
        }
        code = get_code(redirectUrl2);
        if (code === "")
            return;
        state = get_state(redirectUrl2);
        if (state === "")
            return;
        //adapter.log.info('redirectUrl2: ' + redirectUrl2 + ', code = ' + code + ', state = ' + state);
        request.get(get_request(redirectUrl2), process_login7);
    }
}

function process_login7(err, stat, body) {
    if (isAbrufOk("Login-Seite 7", err, stat,body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        urlHeader['Faces-Request'] = '';
        urlHeader.Referer = stat.request.uri.href;
        var post_data = {
            '_33_WAR_cored5portlet_code': code,
            '_33_WAR_cored5portlet_landingPageUrl': ''
        }
        var newUrl = get_newUrl(urlHeader.Referer);
        if (newUrl === "")
            return;
        //adapter.log.info('newUrl = ' + newUrl);
        request.post(get_request(newUrl , false, post_data), process_login8);
    }
}

function process_login8(err, stat, body) {
    if (isRedirectOk("Login-Seite 8", err, stat,body)) {
        var redirectUrl3 = stat.headers.location;
        if (redirectUrl3 === "") {
            carNet_error("Keine Location für Redirect3 gefunden");
            return;
        }
        request.get(get_request(redirectUrl3), process_login9);
    }
}

function process_login9(err, stat, body) {
    if (isAbrufOk("Login-Seite 9", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        csrf = get_csrf(body);
        if (csrf === "")
            return;
        //adapter.log.info('neuer csrf = ' + csrf);
        urlHeader = defaultHeader;
        urlHeader.Referer = stat.request.uri.href;
        urlHeader['X-CSRF-Token'] = csrf;
        //request.post(get_request(stat.request.uri.href + '/-/msgc/get-new-messages', null, null, true), process_messages);
        //request.post(get_request(stat.request.uri.href + '/-/vsr/request-vsr', null, null, true), process_vsr);
        request.post(get_request(stat.request.uri.href + '/-/vsr/get-vsr', null, null, true), process_vsr2);
        request.post(get_request(stat.request.uri.href + '/-/cf/get-location', null, null, true), process_location);
        request.post(get_request(stat.request.uri.href + '/-/vehicle-info/get-vehicle-details', null, null, true), process_vehicleDetails);
        request.post(get_request(stat.request.uri.href + '/-/emanager/get-emanager', null, null, true), process_emanager);
    }
}

function process_messages(err, stat, body) {
    if (isAbrufOk("Messages", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        adapter.log.info('Messages = ' + JSON.stringify(body));
    }
}

function process_vsr(err, stat, body) {
    if (isAbrufOk("Get VSR", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        adapter.log.info('Get VSR = ' + JSON.stringify(body));
    }
}

function process_vsr2(err, stat, body) {
    if (isAbrufOk("Process VSR", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        adapter.log.info('Process VSR = ' + JSON.stringify(body));
    }
}

// ######################### processing of vehicle data ##################################
function process_vehicleDetails(err, stat, body) {
    if (isAbrufOk("Vehicle Details", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        //adapter.log.info('Vehicle Details = ' + JSON.stringify(body));
        if (body.errorCode != 0)
            carNet_error('Fehler ' + body.errorCode + ' beim Abruf Fahrzeug-Daten: ' + JSON.stringify(body));
        else {
            var vehStatus = body.vehicleDetails;
            if (vehStatus !== undefined && vehStatus !== null) {
                if (vehStatus.lastConnectionTimeStamp.length > 0)  {
                    var datum = vehStatus.lastConnectionTimeStamp[0];
                    // tt.mm.jjjj zu jjjj-mm-tt drehen
                    datum = datum.substr(6, 4) + '-' + datum.substr(3, 2) + '-' + datum.substr(0, 2);
                    datum = datum + " " + vehStatus.lastConnectionTimeStamp[1]
                    var x = new Date(datum);
                    adapter.setState(state_vc_lastConnectionTimeStamp, {val: x, ack: true});
                    //adapter.log.info("Timestamp: " + datum + '=>' + x);
                }
                if (vehStatus.distanceCovered > 0)
                    adapter.setState(state_vc_distanceCovered, parseInt(vehStatus.distanceCovered.replace('.', "")), true);
                if (vehStatus.range > 0)
                    adapter.setState(state_vc_range, parseInt(vehStatus.range), true);
                if (vehStatus.serviceInspectionData !== "")
                    adapter.setState(state_vc_serviceInspectionData, vehStatus.serviceInspectionData, true);
                if (vehStatus.oilInspectionData !== "")
                    adapter.setState(state_vc_oilInspectionData, vehStatus.oilInspectionData, true);
            }
        }
    }
}

// ######################### processing of location data ##################################
function process_location(err, stat, body) {
    if (isAbrufOk("Location", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        //adapter.log.info('Location = ' + JSON.stringify(body));
        //var data = body; // JSON.parse(body);
        if (body.errorCode != 0)
            carNet_error('Fehler ' + body.errorCode + ' beim Abruf Positions-Daten: ' + JSON.stringify(body));
        else {
            var posStatus = body.position;
            if (posStatus !== undefined && posStatus !== null) {
                if ((posStatus.lat != 0) && (posStatus.lng != 0)) {
                    adapter.setState(state_l_lat, posStatus.lat, true);
                    adapter.setState(state_l_lng, posStatus.lng, true);
                    // requestGeocoding(posStatus.lat, posStatus.lng);
                }
            } else
            if (getState(state_l_address).val.substr(0, unterwegs.length) != unterwegs)
                adapter.setState(state_l_address, unterwegs + ' ' + getState(state_l_address).val, true);
        }
    }
}

// ######################### processing of eManager data ##################################
function process_emanager(err, stat, body) {
    if (isAbrufOk("eManager-Daten", err, stat, body)) {
        //adapter.log.info('Status = ' + stat.statusCode);
        //adapter.log.info('eManager = ' + JSON.stringify(body));
        if (body.errorCode != 0)
            carNet_error('Fehler ' + body.errorCode + ' beim Abruf eManager-Daten: ' + JSON.stringify(body));
        else {
            var ladeStatus = body.EManager.rbc.status;
            if (ladeStatus !== undefined && ladeStatus !== null) {
                adapter.setState(state_e_batteryPercentage, ladeStatus.batteryPercentage, true);
                //adapter.log.info('Ladestand: ' + ladeStatus.batteryPercentage + "%");
                adapter.setState(state_e_pluginState, ladeStatus.pluginState, true);
                adapter.setState(state_e_extPowerSupplyState, ladeStatus.extPowerSupplyState, true);
                adapter.setState(state_e_chargingState, ladeStatus.chargingState, true);
                //adapter.log.info('Ladevorgang: ' + ladeStatus.chargingState);
                if (ladeStatus.chargingRemaningHour > 0 || ladeStatus.chargingRemaningMinute > 0)
                    adapter.setState(state_e_chargingRemaining, ladeStatus.chargingRemaningHour + ":" + ladeStatus.chargingRemaningMinute, true);
                else
                    adapter.setState(state_e_chargingRemaining, "", true);
                //adapter.log.info('Verbl. Ladedauer: ' + ladeStatus.chargingRemaningHour + "h " + ladeStatus.chargingRemaningMinute + "min");
                adapter.setState(state_e_electricRange, ladeStatus.electricRange, true);
                //adapter.log.info('Reichweite: ' + ladeStatus.electricRange + "km");
            }
            adapter.setState(state_e_combustionRange, ladeStatus.combustionRange, true);
            adapter.setState(state_e_combinedRange, ladeStatus.combinedRange, true);

            adapter.setState(state_e_minChargeLimit, body.EManager.rdt.settings.minChargeLimit, true);
            //adapter.log.info('Mindestladung: ' + body.EManager.rdt.settings.minChargeLimit + "%");
            adapter.setState(state_e_climatisationWithoutHVPower, body.EManager.rpc.settings.climatisationWithoutHVPower, true);
            //adapter.log.info('Klimatisieriung über Batterie: ' + body.EManager.rpc.settings.climatisationWithoutHVPower);

            //ladeStatus.pluginState  //Ladestecker eingesteckt
            //ladeStatus.extPowerSupplyState    //ext. Stromversorgung angeschlossen
            //ladeStatus.combustionRange //Reichweite Benzin
            //ladeStatus.combinedRange  //Reichweite kombiniert
            //ladeStatus.pluginState    //Stecker am Fahrzeug
        }
    }
}

function process_geocoding(err, stat, body) {
    if (isAbrufOk("Geocoding", err, stat, body)) {
        //adapter.log('Status = ' + stat.statusCode);
        //adapter.log('Location = ' + JSON.stringify(body));
        //var data = body; // JSON.parse(body);
        if (body.status != "OK")
        //carNet_error('Fehler ' + body.status + '/' + body.error_message + ' beim Abruf Geocoding: ' + JSON.stringify(body));
            log('Fehler ' + body.status + '/' + body.error_message + ' beim Abruf Geocoding: ' + JSON.stringify(body), 'error');
        else {
            var address = "<unbekannt>";
            if ((body.results.length> 0) & body.results[0].formatted_address !== "")
                address = body.results[0].formatted_address;
            adapter.setState(state_l_address, address, true);
        }
    }
}

function requestGeocoding(lat, lng) {
    var url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng;
    if (mapsApiKey !== "")
        url = url + '&key=' + mapsApiKey;
    //adapter.log.info("Geocoding-URL: " + url)
    request({
        url: url,
        headers: defaultHeader,
        json: true
    }, process_geocoding);
}

function doRequest() {
    carNet_login();
}
