#!/bin/bash

cp  /root/configFile.json /usr/app/oms-events/lib/config/configFile.json

# wait until supervisor has restarted the service
printf 'Config updated, waiting for service to restart\n'
sleep 10

# Set up the api-key in the configuration file.
curl http://localhost:8082/registerMicroservice