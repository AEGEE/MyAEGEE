## [0.9.5](https://github.com/AEGEE/oms-statutory/compare/0.9.4...0.9.5) (2019-04-09)


### Bug Fixes

* **statutory:** added missing migration ([58e317f](https://github.com/AEGEE/oms-statutory/commit/58e317f))
* **statutory:** return created_at for approved candidates on listing ([37d16d4](https://github.com/AEGEE/oms-statutory/commit/37d16d4))



## [0.9.4](https://github.com/AEGEE/oms-statutory/compare/0.9.3...0.9.4) (2019-04-09)


### Bug Fixes

* **statutory:** do not return email for approved candidates ([88c814c](https://github.com/AEGEE/oms-statutory/commit/88c814c))


### Features

* **candidates:** added emails to candidates ([69d9e74](https://github.com/AEGEE/oms-statutory/commit/69d9e74))



## [0.9.3](https://github.com/AEGEE/oms-statutory/compare/0.9.2...0.9.3) (2019-04-08)


### Bug Fixes

* **candidates:** do not close position if someone applied after deadline ([edf9d05](https://github.com/AEGEE/oms-statutory/commit/edf9d05))



## [0.9.2](https://github.com/AEGEE/oms-statutory/compare/0.9.1...0.9.2) (2019-04-08)


### Bug Fixes

* **candidates:** allow editing applications if they are not pending ([fecd560](https://github.com/AEGEE/oms-statutory/commit/fecd560))



## [0.9.1](https://github.com/AEGEE/oms-statutory/compare/0.9.0...0.9.1) (2019-03-31)


### Bug Fixes

* **candidate:** display first and last name for pending candidates ([23b3c98](https://github.com/AEGEE/oms-statutory/commit/23b3c98))



# [0.9.0](https://github.com/AEGEE/oms-statutory/compare/0.8.0...0.9.0) (2019-03-30)


### Bug Fixes

* **test:** fixed test that could fail because of unstable network ([c815983](https://github.com/AEGEE/oms-statutory/commit/c815983))


### Features

* **memberslist:** editing fee_paid for members list ([5c8d9e5](https://github.com/AEGEE/oms-statutory/commit/5c8d9e5))



# [0.8.0](https://github.com/AEGEE/oms-statutory/compare/be680b8...0.8.0) (2019-03-24)


### Bug Fixes

* **application:** added is_on_memberslist management. Fixes MEMB-481 ([36da4a0](https://github.com/AEGEE/oms-statutory/commit/36da4a0))
* **application:** allow applying only with permissions ([1f03db6](https://github.com/AEGEE/oms-statutory/commit/1f03db6))
* **application:** allow boards to see applications. Fixes MEMB-464 ([84ad6da](https://github.com/AEGEE/oms-statutory/commit/84ad6da))
* **application:** allow editing application for those with permissions ([976c611](https://github.com/AEGEE/oms-statutory/commit/976c611))
* **application:** display proper message on unique error for board ([d6e5296](https://github.com/AEGEE/oms-statutory/commit/d6e5296))
* **application:** do not update is_on_memberslist if not Agora ([0909f5e](https://github.com/AEGEE/oms-statutory/commit/0909f5e))
* **application:** listing applications for network director ([3a88621](https://github.com/AEGEE/oms-statutory/commit/3a88621))
* **application:** required boolean answers. Fixes MEMB-450 ([1b9e13d](https://github.com/AEGEE/oms-statutory/commit/1b9e13d))
* **application:** row validation for visa fields. Required for MEMB-454 ([11a1f52](https://github.com/AEGEE/oms-statutory/commit/11a1f52))
* **board:** removed validation for uniqueness of userid ([38a7085](https://github.com/AEGEE/oms-statutory/commit/38a7085))
* **board:** row validations for pax type/order ([2def47a](https://github.com/AEGEE/oms-statutory/commit/2def47a))
* **candidates:** allow applying if not enough positions ([654e95c](https://github.com/AEGEE/oms-statutory/commit/654e95c))
* **candidates:** removed uniqueness validation ([b3f152d](https://github.com/AEGEE/oms-statutory/commit/b3f152d))
* **candidates:** sort positions. Fixes MEMB-472 ([cdb8b96](https://github.com/AEGEE/oms-statutory/commit/cdb8b96))
* **docker:** fixed postgresql version ([6b712f3](https://github.com/AEGEE/oms-statutory/commit/6b712f3))
* **errors:** refactor errors to get more code coverage ([a1b3f5f](https://github.com/AEGEE/oms-statutory/commit/a1b3f5f))
* **general:** fixed security vulnerability ([c732dfc](https://github.com/AEGEE/oms-statutory/commit/c732dfc))
* **general:** forgot to put the errors file into staging ([e86d287](https://github.com/AEGEE/oms-statutory/commit/e86d287))
* **general:** return 401 if my_permissions call fails. Fixes MEMB-487 ([858588a](https://github.com/AEGEE/oms-statutory/commit/858588a))
* **general:** use nodemon instead of supervisor. Fixes MEMB-480 ([ba9854b](https://github.com/AEGEE/oms-statutory/commit/ba9854b))
* **limits:** fixes limits for committees, WGs and projects ([235e3e1](https://github.com/AEGEE/oms-statutory/commit/235e3e1))
* **limits:** updated default pax limits for IG for Agora. Fixes HELP-354 ([2c31dba](https://github.com/AEGEE/oms-statutory/commit/2c31dba))
* **massmailer:** do not sent massmailer if no users match ([89c9954](https://github.com/AEGEE/oms-statutory/commit/89c9954))
* **memberslist:** allow null values as user IDs for memberslist ([5480a33](https://github.com/AEGEE/oms-statutory/commit/5480a33))
* **memberslist:** do not run applications hooks on memberslist update ([1932633](https://github.com/AEGEE/oms-statutory/commit/1932633))
* **memberslist:** update conversion rate API config ([4be5c76](https://github.com/AEGEE/oms-statutory/commit/4be5c76))
* **migration:** forgot to re-add migration ([b6c2b0a](https://github.com/AEGEE/oms-statutory/commit/b6c2b0a))
* **pax limits:** fixed PaxLimit unique constraint, test it. ([be680b8](https://github.com/AEGEE/oms-statutory/commit/be680b8))
* **refactor:** added whitelist helper, refactor and tests update ([024ecc8](https://github.com/AEGEE/oms-statutory/commit/024ecc8))
* **refactor:** refactor core requests. Fixes MEMB-439 ([7eabf61](https://github.com/AEGEE/oms-statutory/commit/7eabf61))
* **stats:** refactor and improved stats. Fixes MEMB-437 ([43a9402](https://github.com/AEGEE/oms-statutory/commit/43a9402))
* **statutory:** added migration for conversion rate ([c6ab19a](https://github.com/AEGEE/oms-statutory/commit/c6ab19a))
* **style:** fixed config for ESLint compliance ([c1df528](https://github.com/AEGEE/oms-statutory/commit/c1df528))
* **test:** add npm audit to Travis. Fixes MEMB-489 ([e28e668](https://github.com/AEGEE/oms-statutory/commit/e28e668))
* **test:** fix another test that could fail randomly ([72ce6cb](https://github.com/AEGEE/oms-statutory/commit/72ce6cb))
* **test:** fix another test that could fail randomly ([740741f](https://github.com/AEGEE/oms-statutory/commit/740741f))
* **test:** fix test that can fail randomly ([7b646b2](https://github.com/AEGEE/oms-statutory/commit/7b646b2))
* **test:** fix tests that could fail randomly ([acdc504](https://github.com/AEGEE/oms-statutory/commit/acdc504))
* **test:** fixed some tests that could fail randomly ([72c0783](https://github.com/AEGEE/oms-statutory/commit/72c0783))
* **test:** fixed test that could fail randomly ([eda76c5](https://github.com/AEGEE/oms-statutory/commit/eda76c5))
* **test:** fixed tests for displaying is_on_memberslist ([9831d04](https://github.com/AEGEE/oms-statutory/commit/9831d04))
* **test:** updated packages to prevent test crashing ([c81e454](https://github.com/AEGEE/oms-statutory/commit/c81e454))
* **tests:** fixed test that could fail randomly ([a88fa3a](https://github.com/AEGEE/oms-statutory/commit/a88fa3a))


### Features

* **application:** added is_on_memberslist field ([1da9d0b](https://github.com/AEGEE/oms-statutory/commit/1da9d0b))
* **application:** update is_on_memberslist when needed. Fixes MEMB-478 ([b2bca3c](https://github.com/AEGEE/oms-statutory/commit/b2bca3c))
* **cron:** closing plenaries on scheduler and testing ([c2b4e13](https://github.com/AEGEE/oms-statutory/commit/c2b4e13))
* **export:** add filtering for applications. Fixes MEMB-388 ([51922ad](https://github.com/AEGEE/oms-statutory/commit/51922ad))
* **export:** added selecting fields for export. Fixes MEMB-387 ([d199dc7](https://github.com/AEGEE/oms-statutory/commit/d199dc7))
* **export:** change permission, expose /incoming for export by LO ([1fe83f7](https://github.com/AEGEE/oms-statutory/commit/1fe83f7))
* **general:** added moment-range and opn and script to open coverage ([216694f](https://github.com/AEGEE/oms-statutory/commit/216694f))
* **listing:** added /incoming for incoming LOs, changed permissions. Fixes MEMB-398 ([17f03bc](https://github.com/AEGEE/oms-statutory/commit/17f03bc))
* **massmailer:** added massmailer filters. Fixes MEMB-389 ([ce7320f](https://github.com/AEGEE/oms-statutory/commit/ce7320f))
* **memberslist:** display fee to AEGEE-Europe on memberslist ([d546e0a](https://github.com/AEGEE/oms-statutory/commit/d546e0a))
* **memberslist:** refactored permissions for members lists ([7ba00aa](https://github.com/AEGEE/oms-statutory/commit/7ba00aa))
* **memberslists:** display if the user is on memberslist ([0e6805b](https://github.com/AEGEE/oms-statutory/commit/0e6805b))
* **plenary:** added exporting plenaries attendance stats as XLSX ([79e904e](https://github.com/AEGEE/oms-statutory/commit/79e904e))
* **plenary:** added plenary attendance marking and displaying ([db95842](https://github.com/AEGEE/oms-statutory/commit/db95842))
* **plenary:** added plenary model and management. Fixes MEMB-456 ([24a5061](https://github.com/AEGEE/oms-statutory/commit/24a5061))
* **statutory:** updating conversion rate on memberslist update, testing ([b1233b2](https://github.com/AEGEE/oms-statutory/commit/b1233b2))
* **style:** added ESLint checking for Travis. Fixes MEMB-459 ([ff0359a](https://github.com/AEGEE/oms-statutory/commit/ff0359a))
* **test:** add attendance management testing ([2bf6f3c](https://github.com/AEGEE/oms-statutory/commit/2bf6f3c))
* **test:** add plenaries management testing ([ded41b5](https://github.com/AEGEE/oms-statutory/commit/ded41b5))
* refactored permissions for members lists and boardview again ([df2f35e](https://github.com/AEGEE/oms-statutory/commit/df2f35e))



