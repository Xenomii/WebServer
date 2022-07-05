const Docker = require('simple-dockerode');

// Instantiate simple-dockerode
var docker = new Docker();
// Name of the docker container that contains the forensic tools
var container_name = 'recursing_volhard';
// Acquires the docker container
var container = docker.getContainer(container_name);

// Checks whether the web application can connect to the docker container
container.inspect(container_name, function (err, data) {
    if (err) {
        console.log('ERROR: DOCKER IS NOT CONNECTED!');
    } else {
        console.log('Docker Container Connection OK');
    }
})
exports.container = container;
