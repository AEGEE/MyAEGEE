# Events module

**master**: [![Build Status](https://travis-ci.org/AEGEE/events.svg)](https://travis-ci.org/AEGEE/events/)
![Codecov branch for dev](https://img.shields.io/codecov/c/github/AEGEE/events.svg)

**dev**: [![Build Status](https://travis-ci.org/AEGEE/events.svg?branch=dev)](https://travis-ci.org/AEGEE/events/dev)
![Codecov branch for dev](https://img.shields.io/codecov/c/github/AEGEE/events/dev.svg)

## General

The event module shall implement everything related to basic events and their applications. Statutory events and SUs will be implemented in another microservices. Find the API documentation on [Apiary](http://docs.omsevents.apiary.io/#).

Also, any help is appreciated! Just contact Nico (AEGEE-Dresden, blacksph3re) and/or check the instructions in the [wiki](https://myaegee.atlassian.net/wiki/).

## Installation and running

There are 3 ways to run this microservice:

1. Using the [OMS Docker image](https://github.com/AEGEE/docker) - recommended
2. Using the Docker container
3. Running it inside the host system

### Using the OMS Docker image

This method will install the core, the events module and the databases for each service.
You can read the installation instructions on the [OMS Docker readme](https://github.com/AEGEE/docker).

### Using the Docker container

You will need to install and setup the core module, Docker and PostgreSQL database, modify the `config/index`,then run the following command:

```shell
cd /path/to/events # Replace it with your events folder
docker build . -t events # Building a Docker image
docker run -v /path/to/events:/usr/app/events --net=host events # Replace the folder name with your path to events folder
```

### Running it inside the host system

You will need to do the following steps:

* [Installing and setting up core module](https://myaegee.atlassian.net/wiki/display/OMSCORE/Installing+the+core)
* Installing and setting up Node.js and NPM (the Docker container uses the latest version)
* `cd /path/to/events` (replace the path with the path to events on your system)
* `npm install`
* (optional) Install `supervisord` to auto-restart process after crashes and file changes (`npm i -g supervisor`)
* Modify the `lib/config/configFile.json` (set up core URL, database URL etc.)
* Run it
  * Without supervisor: `node lib/server.js`
  * With supervisor: `supervisor lib/server.js`


### Configuring

You can specify the microservice configuration by editing the `lib/config.json` file. Check out the example at `lib/configFile.json.example` and the comments in `lib/config.js` for more information.

## LICENSE

Copyright 2015-2018 Fabrizio Bellicano (AEGEE-Europe) and contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

<http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
