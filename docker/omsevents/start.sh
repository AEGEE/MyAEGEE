#!/bin/bash


#Register it
if [ -f "/usr/scripts/strapstate/omsevents" ]
then
	echo "Bootstrap-file found, not executing bootstrap script"
else
  
  echo "Waiting for omscore to finish bootstrapping"
	while [ ! -f "/usr/scripts/strapstate/omscore" ]
	do
	 	sleep 2
	done
  
  sleep 10
  
  echo "Triggering registration"
  cp  /usr/scripts/configFile.json /usr/app/oms-events/lib/config/configFile.json
	# Trigger the registering procedure
	curl -sS http://omsevents:8082/registerMicroservice
  touch /usr/scripts/strapstate/omsevents
  echo "Registration completed"
fi
