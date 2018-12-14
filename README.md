![Logo](admin/vw-logo.png)
# ioBroker.vw-carnet
Adapter for connecting to Volkswagen Car-Net and get access to the data of yout car.
After installing the only thing to configure is the Car-Net username and password.

The Google API Key is optional and is only nescessary to retreive geo-location details (address) of the parked car. The adapter works of course also fine without this function.

## Usage
After starting the adapter the data is received immediately but only once.
For frequently data-update you have to create an additional script to send a command to the adapter.
I would recomment a minimum interval of 15 minutes.

Example for an update-command every 30 minutes: (vw-carnet instance is 0)

```javascript
var schedule;

schedule = schedule('*/30 * * * *', function () {
    if (getState('vw-carnet.0.connection'))/*If connected to VW car-net server*/{
    sendTo('vw-carnet.0', 'update', {
        'parameter1': 'tmp'
        });
    }
});
```

This might be changed in a future update but it is the current state.

## Loggingmode
Activating Logging mode with:
```javascript
sendto("vw-carnet.0","activateLogging",'tmp');
```

Deactivating Logging mode with:
```javascript
sendto("vw-carnet.0","deactivateLogging",'tmp');
```
or simply restart the adapter. It always starts with logging disabled. 


## Changelog
### 0.1.5 (2018-12-14)
* (RPerkuhn) implementation of loggingmode
### 0.1.4 (2018-12-12)
* (RPerkuhn) bugfixes
### 0.1.3 (2018-12-10)
* (RPerkuhn) implementation of dynamic display of state names in English or German depending on ioBroker systemlanguage
### 0.1.2 (2018-12-08)
* (RPerkuhn) integration of door and window states
### 0.1.1 (2018-12-07)
* (RPerkuhn) checkboxes to enable/disable retrieve of climater-, eManager- and locationdata
### 0.1.0 (2018-12-03)
* (RPerkuhn) first alpha release
### 0.0.x (2018-11-09)
* (RPerkuhn) initial setup of adapter and lab-versions until 0.1.x

p.s.: I like to give many thanks to https://github.com/wez3/volkswagen-carnet-client from where I learned to get access to all the CarNet informations.

## License

The MIT License (MIT)

Copyright (c) 2018 RPerkuhn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
