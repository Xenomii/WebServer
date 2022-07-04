const Docker = require('simple-dockerode');

// Instantiate simple-dockerode
var docker = new Docker();
// Name of the docker container that contains the forensic tools
var container_name = 'recursing_volhard';
// Acquires the docker container
var container = docker.getContainer(container_name);
// Checks whether the web application can connect to the docker container
if (!container) {
    console.log(`Error! Could not connect to container ${container_name}...`);
} else {
    console.log("Docker container connection is OK");
}

exports.container = container;
