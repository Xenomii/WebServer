const Docker = require('simple-dockerode');

// Instantiate simple-dockerode
var docker = new Docker();
// Docker container names that contains the forensic tools
var container_names = [ 'itp_network', 'itp_memory', 'itp_media' ];
// Array to hold on to the Dockerode.Container objects
var container_list = [];
for (let i = 0; i < container_names.length; i++) {
    // Acquires the Container object based on the docker container names
    var container = docker.getContainer(container_names[i]);
    // Populates the list with the Container objects
    container_list.push(container);
}

// Checks whether the container exists and is running
for (let x = 0; x < container_list.length; x++) {
    var container = container_list[x];
    container.inspect(function(err, data){
        if (data.State.Status !== 'running' || err) {
            console.log(`ERROR! DOCKER CONTAINER ${container_names[x]} IS NOT CONNECTED!`);
        } else {
            console.log(`Docker Container ${container_names[x]} Connection OK`);
        }
    })
}

// For debugging purposes...
// container_list.forEach(container => console.log(container));

exports.container_list = container_list;
