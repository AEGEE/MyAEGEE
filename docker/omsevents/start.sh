#!/bin/bash

# Wait until the app has been bootstrapped


if [ ! -f "/usr/scripts/strapstate/omsevents-basic" ]
then
	echo "Waiting for the bootstrapper to finish bootstrapping"
	while [ ! -f "/usr/scripts/strapstate/omsevents-basic" ]
	do
		sleep 1
	done
fi

supervisor -e 'node,js,json' /usr/app/oms-events/lib/server.js | bunyan