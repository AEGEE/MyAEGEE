# OMS Statutory module
![CircleCI](https://img.shields.io/circleci/build/github/AEGEE/oms-statutory)
![Codecov branch for master](https://img.shields.io/codecov/c/github/AEGEE/oms-statutory.svg)


## General

The statutory module of OMS is responsible for managing statutory events, their applications, votings, proposals and motions.

## Contributing

The main developer of this module is Sergey Peshkov (AEGEE-Voronezh, github.com/serge1peshcoff). If you want to contribute, keep in mind these points:
- consider following the code style (run `npm run lint` to check if your changes matches the code style)
- if you are implementing new features, consider writing tests for them
- if you are changing existing stuff, consider not breaking the tests :D

## Technology stack

- Node.js
- Express
- PostgreSQL + Sequelize as ORM

## Configuring

You can specify the microservice configuration by editing the `lib/index.js` file. Check out the example at `lib/index.js.example` and the comments in `lib/index.js` for more information.

## LICENSE

Copyright 2018 Sergey Peshkov (AEGEE-Europe) and contributors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

<http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
