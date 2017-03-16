# Events module
[![Build Status](https://travis-ci.org/AEGEE/oms-events.svg?branch=dev)](https://travis-ci.org/AEGEE/oms-events)
[![Coverage Status](https://coveralls.io/repos/github/AEGEE/oms-events/badge.svg?branch=dev)](https://coveralls.io/github/AEGEE/oms-events?branch=dev)

## General

The event module shall implement everything related to basic events, giving a common ground for non-statutory events, statutory events and SUs. Find the API documentation on [Apiary](http://docs.omsevents.apiary.io/#).

Also, any help is appreciated! Just contact Nico (AEGEE-Dresden, blacksph3re) and/or check the instructions in the [wiki](https://oms-project.atlassian.net/wiki/).

## Set up

### Installing

There are some things you have to do to get this service running.
* This service depends on [oms-core](https://github.com/AEGEE/oms-neo-core), get it up and running. I advise to use [OMS Docker image](https://github.com/AEGEE/oms-docker), it includes this microservice, the MongoDB database, `oms-core` and its dependencies.
* Further dependencies (included in Docker):
  * nodejs including npm
  * mongodb
* Git clone this repo and cd into it
* `npm install` to install all necessary dependencies
* Rename `lib/config/configFile.json.example` to `lib/config/configFile.json`, if you want edit it
* Set up static serving with nginx (if you are using another web server, good luck.)
```shell
mv nginx.conf.example nginx.conf
sudo ln -s your/path/to/oms-events/nginx.conf /etc/nginx/sites-enabled/omsevents
sudo systemctl reload nginx.service
```

Now you will need to connect the microservice to the core.
* Edit `lib/config/configFile.json` and put the secret that you obtained from the core.
* Start the server with `node lib/server.js`
* Query the running server on `curl localhost:8083/api/registerMicroservice` to fire up registration. *(if you fucked up the nginx reverse-proxy you can also query `localhost:8082`)*
* Enable it in the core backend and refresh the page.

### Configuring

You can specify the microservice configuration by editing the `lib/config.json` file. Check out the example at `lib/configFile.json.example` and the comments in `lib/config.js` for more information.

### Get it running


To get it running, just type 
```
node lib/server.js
```
and you should have a working instance. If you also want to be able to read the console output, run
`sudo npm install bunyan -g` to install bunyan logger and start the server with
```
node lib/server.js | bunyan --color --output short
```
It's recommended to run with a supervisor-daemon to restart after crashes, you can use node-supervisor (install with `sudo npm install supervisor -g`) and run
```
supervisor lib/server.js | bunyan --color --output short
```



## LICENSE

Copyright 2015-2016 Fabrizio Bellicano (AEGEE-Europe) and contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

<http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.