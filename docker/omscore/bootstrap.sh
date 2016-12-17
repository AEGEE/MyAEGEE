#!/bin/bash

cp -n /root/.env /var/www/.env
cd /var/www
composer install
php artisan config:cache
php artisan migrate
php artisan key:generate
php artisan config:cache
php artisan db:seed
php artisan config:cache

echo "app()->call([app()->make('App\\Http\\Controllers\\ModuleController'), 'getSharedSecret'], []);" | php artisan tinker
