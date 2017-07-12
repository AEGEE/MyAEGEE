#!/bin/bash

#better safe than sorry - I still have to read about permissions for volumes
# in overlay-fs

if [ -f "/var/strapstate/omscore" ]
then
	echo "Bootstrap-file found, not executing bootstrap script"
else
	echo "Bootstrapping..."
  sleep 15 #give time to postgres container to startup
    cp /var/scripts/.env /var/www/.env
	cd /var/www
    composer install || { echo "Error at composer install"; exit 10; }
	php artisan config:cache || { echo "Error at config:cache"; exit 11; }
	php artisan migrate      || { echo "Error at migrate"; exit 12; }
	php artisan key:generate || { echo "Error at key:generate"; exit 13; }
	php artisan config:cache || { echo "Error at config:cache (2)"; exit 14; }
	php artisan db:seed      || { echo "Error at db:seed"; exit 15; }
	php artisan config:cache || { echo "Error at config:cache (3)"; exit 16; }

	# Make omscore write out the api-key
    echo "Write out API Key:"
	echo "app()->call([app()->make('App\\Http\\Controllers\\ModuleController'), 'getSharedSecret'], []);" | php artisan tinker || { echo "Error at artisan tinker"; exit 17; }


	# Copy the key into the volume mount
	cp /var/www/storage/key /var/shared/api-key

	npm install

	mkdir -p storage
	mkdir -p /var/shared/strapstate

	# Create a file on strapstate to indicate we do not need to run this again
	touch /var/shared/strapstate/omscore

	echo "Bootstrap finished"
fi
