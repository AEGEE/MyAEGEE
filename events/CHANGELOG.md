# [0.11.0](https://github.com/AEGEE/oms-events/compare/0.10.3...0.11.0) (2019-09-22)


### Features

* **metrics:** added endpoint metrics. Fixes MEMB-619 ([e697fb9](https://github.com/AEGEE/oms-events/commit/e697fb9))



## [0.10.3](https://github.com/AEGEE/oms-events/compare/0.10.2...0.10.3) (2019-09-21)


### Bug Fixes

* **metrics:** increased metrics performance ([cdce22e](https://github.com/AEGEE/oms-events/commit/cdce22e))



## [0.10.2](https://github.com/AEGEE/oms-events/compare/0.10.1...0.10.2) (2019-09-19)


### Bug Fixes

* **metrics:** reduced metrics count and refactor ([6b906a8](https://github.com/AEGEE/oms-events/commit/6b906a8))



## [0.10.1](https://github.com/AEGEE/oms-events/compare/0.10.0...0.10.1) (2019-09-18)


### Bug Fixes

* **metrics:** added events_ prefix to metric names ([c2ee76f](https://github.com/AEGEE/oms-events/commit/c2ee76f))



# [0.10.0](https://github.com/AEGEE/oms-events/compare/0.9.2...0.10.0) (2019-09-18)


### Bug Fixes

* **deps:** bumped Sequelize to latest to fix vulnerability ([2e633a0](https://github.com/AEGEE/oms-events/commit/2e633a0))


### Features

* **metrics:** added /metrics endpoint. Fixes MEMB-604 ([acfcfd9](https://github.com/AEGEE/oms-events/commit/acfcfd9))



## [0.9.2](https://github.com/AEGEE/oms-events/compare/0.9.1...0.9.2) (2019-09-12)


### Bug Fixes

* **docker:** moved npm install from bootstrap to container build ([20a08e8](https://github.com/AEGEE/oms-events/commit/20a08e8))



## [0.9.1](https://github.com/AEGEE/oms-events/compare/0.9.0...0.9.1) (2019-09-12)


### Bug Fixes

* **docker:** added proper dockerfile and docker-compose. Fixes MEMB-613 ([96167d1](https://github.com/AEGEE/oms-events/commit/96167d1))
* **test:** fixes tests ([b0363df](https://github.com/AEGEE/oms-events/commit/b0363df))
* **tests:** fixed tests again ([2168cd0](https://github.com/AEGEE/oms-events/commit/2168cd0))



# [0.9.0](https://github.com/AEGEE/oms-events/compare/0.8.1...0.9.0) (2019-09-09)


### Bug Fixes

* **event:** added european event type. Fixes HELP-629 ([669fc75](https://github.com/AEGEE/oms-events/commit/669fc75))
* **event:** find event by numeric ID. Fixes MEMB-538 ([a7c83e3](https://github.com/AEGEE/oms-events/commit/a7c83e3))
* **test:** fixed flapping tests ([21a5172](https://github.com/AEGEE/oms-events/commit/21a5172))


### Features

* **application:** add email to applications. Fixes MEMB-606 ([90ac31c](https://github.com/AEGEE/oms-events/commit/90ac31c))



## [0.8.1](https://github.com/AEGEE/oms-events/compare/0.8.0...0.8.1) (2019-09-01)


### Bug Fixes

* **deps:** fixed non-major semver security vulnerabilities ([a64dcbf](https://github.com/AEGEE/oms-events/commit/a64dcbf))
* **docker:** fixed Dockerfile ([d6e3def](https://github.com/AEGEE/oms-events/commit/d6e3def))
* **general:** postgres password fix for config ([c24b872](https://github.com/AEGEE/oms-events/commit/c24b872))



# [0.8.0](https://github.com/AEGEE/oms-events/compare/0.7.0...0.8.0) (2019-09-01)


### Bug Fixes

* **docker:** updated Node to v12. Fixes MEMB-522 ([68e723e](https://github.com/AEGEE/oms-events/commit/68e723e))
* **general:** set config from logging. Fixes MEMB-547 ([b6d8328](https://github.com/AEGEE/oms-events/commit/b6d8328))


### Features

* **general:** added CircleCI. Fixes MEMB-602 ([829d3c1](https://github.com/AEGEE/oms-events/commit/829d3c1))



# [0.7.0](https://github.com/AEGEE/oms-events/compare/0.6.2...0.7.0) (2019-08-14)


### Bug Fixes

* **application:** added application consent. Fixes HELP-598 ([a952bf8](https://github.com/AEGEE/oms-events/commit/a952bf8))



## [0.6.2](https://github.com/AEGEE/oms-events/compare/0.6.1...0.6.2) (2019-08-11)


### Bug Fixes

* **deps:** fixed non-major semver security vulnerabilities ([51530bf](https://github.com/AEGEE/oms-events/commit/51530bf))
* **deps:** fixed non-major semver security vulnerabilities ([15724d2](https://github.com/AEGEE/oms-events/commit/15724d2))
* **deps:** updated Sequelize. Fixes MEMB-520 ([37c53af](https://github.com/AEGEE/oms-events/commit/37c53af))
* **test:** increased test coverage. Fixes MEMB-583 ([5985379](https://github.com/AEGEE/oms-events/commit/5985379))



## [0.6.1](https://github.com/AEGEE/oms-events/compare/0.6.0...0.6.1) (2019-08-11)


### Bug Fixes

* **other:** added /healthcheck endpoint. Fixes MEMB-562 ([b39b20a](https://github.com/AEGEE/oms-events/commit/b39b20a))


### Features

* standardise passwords; improve deployability ([4a098f0](https://github.com/AEGEE/oms-events/commit/4a098f0))



# [0.6.0](https://github.com/AEGEE/oms-events/compare/0.5.0...0.6.0) (2019-03-13)


### Features

* **event:** fix organizers management. Fixes MEMB-191 ([b95aae0](https://github.com/AEGEE/oms-events/commit/b95aae0))



# [0.5.0](https://github.com/AEGEE/oms-events/compare/0.4.3...0.5.0) (2019-03-11)


### Bug Fixes

* **application:** sort applications ([5bfc00f](https://github.com/AEGEE/oms-events/commit/5bfc00f))
* **event:** not displaying past events by detault ([e46b3c5](https://github.com/AEGEE/oms-events/commit/e46b3c5))
* **event:** reverse sorting order for events ([c761961](https://github.com/AEGEE/oms-events/commit/c761961))
* **event:** sort events on listing. Fixes MEMB-470 ([5dee0a9](https://github.com/AEGEE/oms-events/commit/5dee0a9))
* **event:** updated fs-extra api to pass tests ([88729d3](https://github.com/AEGEE/oms-events/commit/88729d3))
* **package:** updated all packages and fixed vulnerabilities ([743fd86](https://github.com/AEGEE/oms-events/commit/743fd86))
* **test:** added ESLint check on Travis ([e647ade](https://github.com/AEGEE/oms-events/commit/e647ade))
* **test:** checking for outdated and vulnerable packages on Travis ([9576426](https://github.com/AEGEE/oms-events/commit/9576426))
* **test:** remove outdated check for Travis ([ad14a84](https://github.com/AEGEE/oms-events/commit/ad14a84))
* **test:** updated Jest for tests to work ([0de8ee0](https://github.com/AEGEE/oms-events/commit/0de8ee0))
* **test:** updated Jest to latest ([f9e9caf](https://github.com/AEGEE/oms-events/commit/f9e9caf))


### Features

* **event:** search and filtering for all listings. Fixes MEMB-469 ([a1b65c7](https://github.com/AEGEE/oms-events/commit/a1b65c7))



## [0.4.3](https://github.com/AEGEE/oms-events/compare/0.4.2...0.4.3) (2019-03-01)


### Bug Fixes

* **general:** updated packages to fix security vulnerabilities ([68b6ba7](https://github.com/AEGEE/oms-events/commit/68b6ba7))
* **general:** use nodemon instead of supervisor. Fixes MEMB-480 ([e57b8a3](https://github.com/AEGEE/oms-events/commit/e57b8a3))



## [0.4.2](https://github.com/AEGEE/oms-events/compare/0.4.1...0.4.2) (2019-03-01)


### Bug Fixes

* **docker:** fixed postgresql version ([7b259b2](https://github.com/AEGEE/oms-events/commit/7b259b2))



## [0.4.1](https://github.com/AEGEE/oms-events/compare/0.4.0...0.4.1) (2019-02-24)


### Bug Fixes

* **logging:** log request body. Fixes MEMB-477 ([46750ca](https://github.com/AEGEE/oms-events/commit/46750ca))



# [0.4.0](https://github.com/AEGEE/oms-events/compare/0.3.2...0.4.0) (2019-02-19)


### Features

* **export:** add export to XLSX. Fixes MEMB-406 ([a212025](https://github.com/AEGEE/oms-events/commit/a212025))



## [0.3.2](https://github.com/AEGEE/oms-events/compare/0.3.1...0.3.2) (2019-02-13)


### Bug Fixes

* **event:** url validation. Fixes HELP-270 ([ee82b85](https://github.com/AEGEE/oms-events/commit/ee82b85))



## [0.3.1](https://github.com/AEGEE/oms-events/compare/d10774f...0.3.1) (2019-02-12)


### Bug Fixes

* **event:** change fee from integer to decimal. Fixes HELP-269 ([c71f779](https://github.com/AEGEE/oms-events/commit/c71f779))
* **event:** refactor application questions validation ([1dcebde](https://github.com/AEGEE/oms-events/commit/1dcebde))
* **event:** refactored event validation ([e7bf8fd](https://github.com/AEGEE/oms-events/commit/e7bf8fd))
* **events:** refactor events creation ([1ec86c6](https://github.com/AEGEE/oms-events/commit/1ec86c6))
* **general:** remove oms-common-nodejs. Fixes MEMB-192 ([d10774f](https://github.com/AEGEE/oms-events/commit/d10774f))
* **middlewares:** refactor fetching core data ([cd94914](https://github.com/AEGEE/oms-events/commit/cd94914))


### Features

* **endpoints:** removed unused endpoints ([4bfaaf3](https://github.com/AEGEE/oms-events/commit/4bfaaf3))
* **general:** add conventional commits. Fixes MEMB-460 ([59aa203](https://github.com/AEGEE/oms-events/commit/59aa203))


### BREAKING CHANGES

* **endpoints:** removed some endpoints



