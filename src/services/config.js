const fs = require('fs');
const path = require('path');

const configFileName = path.join(path.resolve(__dirname, "../../"), "config.json");
const configData = JSON.parse(fs.readFileSync(configFileName, 'utf8'));

exports.get = function() {
    return configData;
}


