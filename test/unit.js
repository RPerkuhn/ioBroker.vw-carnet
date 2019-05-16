const path = require("path");
const { tests } = require("@iobroker/testing");
const adapterDir = path.join(__dirname, "..");

// Run tests
tests.unit(adapterDir, {
	predefinedObjects: [
		{
			"_id": "system.config",
			// @ts-ignore
			"type": "config",
			"common": {
				"name": "Config",
				"language": "de"
			}
		}
	]
});
