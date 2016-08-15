# Events module
[![Build Status](https://travis-ci.org/AEGEE/oms-events.svg?branch=dev)](https://travis-ci.org/AEGEE/oms-events)
[![Coverage Status](https://coveralls.io/repos/github/AEGEE/oms-events/badge.svg?branch=dev)](https://coveralls.io/github/AEGEE/oms-events?branch=dev)

## Purpose

The event module shall implement everything related to basic events, giving a common ground for non-statutory events, statutory events and SUs.

## Get it running

I advise you to use the vagrant environment provided by [this](https://github.com/AEGEE/oms-development-vm) repo. "vagrant provision" and "vagrant up" should do everything you need, but for more details see the repo.

Setting up the events module seperately will not be supported, as it is (soon) relying on other services for user authentication and token management.

## Get active

If you want to develop another microservice or a frontend which uses this one, find the documentation of the API-Interface on [Apiary](http://docs.omsevents.apiary.io/#). 

Also, any help is appreciated! Just contact Nico (AEGEE-Dresden) or Fabricio (AEGEE-Berlin) and check the instructions in the [oms-core](https://github.com/AEGEE/oms-core) repo.

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