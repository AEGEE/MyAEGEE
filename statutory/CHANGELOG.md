## [0.7.9](https://github.com/AEGEE/oms-statutory/compare/0.7.8...0.7.9) (2019-03-11)


### Bug Fixes

* **test:** updated packages to prevent test crashing ([c81e454](https://github.com/AEGEE/oms-statutory/commit/c81e454))



## [0.7.8](https://github.com/AEGEE/oms-statutory/compare/0.7.7...0.7.8) (2019-03-11)


### Bug Fixes

* **general:** return 401 if my_permissions call fails. Fixes MEMB-487 ([858588a](https://github.com/AEGEE/oms-statutory/commit/858588a))
* **test:** fix another test that could fail randomly ([72ce6cb](https://github.com/AEGEE/oms-statutory/commit/72ce6cb))



## [0.7.7](https://github.com/AEGEE/oms-statutory/compare/0.7.6...0.7.7) (2019-03-04)


### Bug Fixes

* **application:** listing applications for network director ([3a88621](https://github.com/AEGEE/oms-statutory/commit/3a88621))
* **test:** fix test that can fail randomly ([7b646b2](https://github.com/AEGEE/oms-statutory/commit/7b646b2))



## [0.7.6](https://github.com/AEGEE/oms-statutory/compare/0.7.5...0.7.6) (2019-03-02)


### Bug Fixes

* **application:** added is_on_memberslist management. Fixes MEMB-481 ([36da4a0](https://github.com/AEGEE/oms-statutory/commit/36da4a0))
* **application:** do not update is_on_memberslist if not Agora ([0909f5e](https://github.com/AEGEE/oms-statutory/commit/0909f5e))



## [0.7.5](https://github.com/AEGEE/oms-statutory/compare/0.7.4...0.7.5) (2019-03-02)


### Bug Fixes

* **limits:** fixes limits for committees, WGs and projects ([235e3e1](https://github.com/AEGEE/oms-statutory/commit/235e3e1))



## [0.7.4](https://github.com/AEGEE/oms-statutory/compare/0.7.3...0.7.4) (2019-03-01)


### Bug Fixes

* **limits:** updated default pax limits for IG for Agora. Fixes HELP-354 ([2c31dba](https://github.com/AEGEE/oms-statutory/commit/2c31dba))



## [0.7.3](https://github.com/AEGEE/oms-statutory/compare/0.7.2...0.7.3) (2019-03-01)


### Bug Fixes

* **docker:** fixed postgresql version ([6b712f3](https://github.com/AEGEE/oms-statutory/commit/6b712f3))



## [0.7.2](https://github.com/AEGEE/oms-statutory/compare/0.7.1...0.7.2) (2019-02-26)


### Bug Fixes

* **general:** use nodemon instead of supervisor. Fixes MEMB-480 ([ba9854b](https://github.com/AEGEE/oms-statutory/commit/ba9854b))



## [0.7.1](https://github.com/AEGEE/oms-statutory/compare/0.7.0...0.7.1) (2019-02-26)


### Bug Fixes

* **memberslist:** do not run applications hooks on memberslist update ([1932633](https://github.com/AEGEE/oms-statutory/commit/1932633))
* **migration:** forgot to re-add migration ([b6c2b0a](https://github.com/AEGEE/oms-statutory/commit/b6c2b0a))



# [0.7.0](https://github.com/AEGEE/oms-statutory/compare/0.6.4...0.7.0) (2019-02-26)


### Bug Fixes

* **memberslist:** allow null values as user IDs for memberslist ([5480a33](https://github.com/AEGEE/oms-statutory/commit/5480a33))
* **test:** fixed test that could fail randomly ([eda76c5](https://github.com/AEGEE/oms-statutory/commit/eda76c5))
* **test:** fixed tests for displaying is_on_memberslist ([9831d04](https://github.com/AEGEE/oms-statutory/commit/9831d04))


### Features

* **application:** added is_on_memberslist field ([1da9d0b](https://github.com/AEGEE/oms-statutory/commit/1da9d0b))
* **application:** update is_on_memberslist when needed. Fixes MEMB-478 ([b2bca3c](https://github.com/AEGEE/oms-statutory/commit/b2bca3c))



## [0.6.4](https://github.com/AEGEE/oms-statutory/compare/0.6.3...0.6.4) (2019-02-25)


### Bug Fixes

* **style:** fixed config for ESLint compliance ([c1df528](https://github.com/AEGEE/oms-statutory/commit/c1df528))
* **test:** fixed some tests that could fail randomly ([72c0783](https://github.com/AEGEE/oms-statutory/commit/72c0783))


### Features

* **style:** added ESLint checking for Travis. Fixes MEMB-459 ([ff0359a](https://github.com/AEGEE/oms-statutory/commit/ff0359a))



## [0.6.3](https://github.com/AEGEE/oms-statutory/compare/0.6.2...0.6.3) (2019-02-21)


### Bug Fixes

* **refactor:** refactor core requests. Fixes MEMB-439 ([7eabf61](https://github.com/AEGEE/oms-statutory/commit/7eabf61))



## [0.6.2](https://github.com/AEGEE/oms-statutory/compare/0.5.3...0.6.2) (2019-02-20)


### Bug Fixes

* **application:** allow boards to see applications. Fixes MEMB-464 ([84ad6da](https://github.com/AEGEE/oms-statutory/commit/84ad6da))
* **application:** required boolean answers. Fixes MEMB-450 ([1b9e13d](https://github.com/AEGEE/oms-statutory/commit/1b9e13d))
* **candidates:** sort positions. Fixes MEMB-472 ([cdb8b96](https://github.com/AEGEE/oms-statutory/commit/cdb8b96))
* **test:** fix tests that could fail randomly ([acdc504](https://github.com/AEGEE/oms-statutory/commit/acdc504))


### Features

* **export:** add filtering for applications. Fixes MEMB-388 ([51922ad](https://github.com/AEGEE/oms-statutory/commit/51922ad))



## [0.5.3](https://github.com/AEGEE/oms-statutory/compare/0.5.2...0.5.3) (2019-02-10)


### Bug Fixes

* **application:** display proper message on unique error for board ([d6e5296](https://github.com/AEGEE/oms-statutory/commit/d6e5296))
* **application:** row validation for visa fields. Required for MEMB-454 ([11a1f52](https://github.com/AEGEE/oms-statutory/commit/11a1f52))
* **board:** removed validation for uniqueness of userid ([38a7085](https://github.com/AEGEE/oms-statutory/commit/38a7085))
* **board:** row validations for pax type/order ([2def47a](https://github.com/AEGEE/oms-statutory/commit/2def47a))
* **candidates:** removed uniqueness validation ([b3f152d](https://github.com/AEGEE/oms-statutory/commit/b3f152d))
* **errors:** refactor errors to get more code coverage ([a1b3f5f](https://github.com/AEGEE/oms-statutory/commit/a1b3f5f))



## [0.5.2](https://github.com/AEGEE/oms-statutory/compare/0.5.1...0.5.2) (2019-02-10)


### Bug Fixes

* **general:** forgot to put the errors file into staging ([e86d287](https://github.com/AEGEE/oms-statutory/commit/e86d287))



## [0.5.1](https://github.com/AEGEE/oms-statutory/compare/0.5.0...0.5.1) (2019-02-10)



# [0.5.0](https://github.com/AEGEE/oms-statutory/compare/0.4.3...0.5.0) (2019-02-09)


### Features

* **memberslists:** display if the user is on memberslist ([0e6805b](https://github.com/AEGEE/oms-statutory/commit/0e6805b))



## [0.4.3](https://github.com/AEGEE/oms-statutory/compare/be680b8...0.4.3) (2019-02-09)


### Bug Fixes

* **candidates:** allow applying if not enough positions ([654e95c](https://github.com/AEGEE/oms-statutory/commit/654e95c))
* **massmailer:** do not sent massmailer if no users match ([89c9954](https://github.com/AEGEE/oms-statutory/commit/89c9954))
* **pax limits:** fixed PaxLimit unique constraint, test it. ([be680b8](https://github.com/AEGEE/oms-statutory/commit/be680b8))
* **refactor:** added whitelist helper, refactor and tests update ([024ecc8](https://github.com/AEGEE/oms-statutory/commit/024ecc8))
* **stats:** refactor and improved stats. Fixes MEMB-437 ([43a9402](https://github.com/AEGEE/oms-statutory/commit/43a9402))
* **tests:** fixed test that could fail randomly ([a88fa3a](https://github.com/AEGEE/oms-statutory/commit/a88fa3a))


### Features

* **export:** added selecting fields for export. Fixes MEMB-387 ([d199dc7](https://github.com/AEGEE/oms-statutory/commit/d199dc7))
* **export:** change permission, expose /incoming for export by LO ([1fe83f7](https://github.com/AEGEE/oms-statutory/commit/1fe83f7))
* **listing:** added /incoming for incoming LOs, changed permissions. Fixes MEMB-398 ([17f03bc](https://github.com/AEGEE/oms-statutory/commit/17f03bc))
* **massmailer:** added massmailer filters. Fixes MEMB-389 ([ce7320f](https://github.com/AEGEE/oms-statutory/commit/ce7320f))



