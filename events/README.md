# Events module

## Purpose

The event module shall implement everything related to basic events, giving a common ground for non-statutory events, statutory events and SUs.

## Get it running

1. Start a mongodb-server and put the url into lib/config/config.json
2. Clone the repo
3. Start the backend and frontend server with:

```shell
    npm install
    gulp
```

`npm install` will install the dependencies and devDependencies to run the frontend and backend and is only necessary to be run once.

Note that this procedure only runs a dev version. If you want a production system,
* setup a nginx/apache/etc to serve the frontend files, 
* run the node-server as a system-service, eg with systemctl and 
* setup nginx/apache/etc to reverse-proxy to the backend for calls to /api

## Get active

If you want to develop another microservice which uses this one, find the documentation of the API-Interface on [Apiary](http://docs.omsevents.apiary.io/#). 

More is explained in the readme of [oms-core](https://github.com/AEGEE/oms-core)

