## [1.2.4](https://github.com/AEGEE/discounts/compare/1.2.3...1.2.4) (2021-11-12)


### Bug Fixes

* **deps:** move to Node 16 and update CI config ([#394](https://github.com/AEGEE/discounts/issues/394)) ([bf4a7b2](https://github.com/AEGEE/discounts/commit/bf4a7b2153b046ae379e80660d8581a39b6e668b))

## [1.2.3](https://github.com/AEGEE/discounts/compare/1.2.2...1.2.3) (2021-08-05)


### Bug Fixes

* **logging:** log info and above by default ([#337](https://github.com/AEGEE/discounts/issues/337)) ([77b1b5a](https://github.com/AEGEE/discounts/commit/77b1b5a3de26c6d00f4da457bce0576802ca86f9))

## [1.2.2](https://github.com/AEGEE/discounts/compare/1.2.1...1.2.2) (2021-05-11)


### Bug Fixes

* **circleci:** update ci ([#275](https://github.com/AEGEE/discounts/issues/275)) ([479b7b9](https://github.com/AEGEE/discounts/commit/479b7b9cd2b1be2ef3dc62e8d499c44c345efeee))

## [1.2.1](https://github.com/AEGEE/discounts/compare/1.2.0...1.2.1) (2021-02-23)


### Bug Fixes

* **mail:** added notification_email to morgan ([#254](https://github.com/AEGEE/discounts/issues/254)) ([25cf94a](https://github.com/AEGEE/discounts/commit/25cf94a3b9ec3f03065f7d7e483ef808d283e282))

# [1.2.0](https://github.com/AEGEE/discounts/compare/1.1.1...1.2.0) (2020-10-03)


### Features

* **metrics:** added basic auth for /metrics/*. Fixes MEMB-670 ([#172](https://github.com/AEGEE/discounts/issues/172)) ([0c10153](https://github.com/AEGEE/discounts/commit/0c10153de9dc269dc2652eef085ed0940ffb1762))

## [1.1.1](https://github.com/AEGEE/discounts/compare/1.1.0...1.1.1) (2020-09-29)


### Bug Fixes

* **logging:** add x-service header to core requests ([#170](https://github.com/AEGEE/discounts/issues/170)) ([97e18cc](https://github.com/AEGEE/discounts/commit/97e18cc2b8451da08772a7d69a954ec3a0026916))

# [1.1.0](https://github.com/AEGEE/discounts/compare/1.0.2...1.1.0) (2020-06-22)


### Features

* **docker:** use shorter prefix ([#88](https://github.com/AEGEE/discounts/issues/88)) ([34e17f2](https://github.com/AEGEE/discounts/commit/34e17f2bfc0eb1eb2e6feb96434c401ce40ad5e7))

## [1.0.2](https://github.com/AEGEE/oms-discounts/compare/1.0.1...1.0.2) (2020-06-20)


### Bug Fixes

* **docker:** update core and mailer hosts ([#84](https://github.com/AEGEE/oms-discounts/issues/84)) ([f789a4d](https://github.com/AEGEE/oms-discounts/commit/f789a4d3859bcb4b7cbe475e8a167a27b0953662))

## [1.0.1](https://github.com/AEGEE/oms-discounts/compare/1.0.0...1.0.1) (2020-06-13)


### Bug Fixes

* **logging:** write only specific fields for user logging ([#81](https://github.com/AEGEE/oms-discounts/issues/81)) ([a2b0116](https://github.com/AEGEE/oms-discounts/commit/a2b01163edcc4de167f8e8ad884652f43cf5ad8d))

# [1.0.0](https://github.com/AEGEE/oms-discounts/compare/0.12.0...1.0.0) (2020-06-12)


### Features

* **general:** new core refactor ([#59](https://github.com/AEGEE/oms-discounts/issues/59)) ([60e5658](https://github.com/AEGEE/oms-discounts/commit/60e5658f8350d5443d06c2d7f3185acbccda1144))


### BREAKING CHANGES

* **general:** new core refactor

# [0.12.0](https://github.com/AEGEE/oms-discounts/compare/0.11.2...0.12.0) (2020-06-08)


### Features

* **ci:** added yamllint check ([#79](https://github.com/AEGEE/oms-discounts/issues/79)) ([60db8e2](https://github.com/AEGEE/oms-discounts/commit/60db8e21ce1c33d3a5feb0408ced0907df387356))

## [0.11.2](https://github.com/AEGEE/oms-discounts/compare/0.11.1...0.11.2) (2020-06-08)


### Bug Fixes

* **ci:** remove audit check ([#77](https://github.com/AEGEE/oms-discounts/issues/77)) ([99f1293](https://github.com/AEGEE/oms-discounts/commit/99f12938baa0aa09ac1fa9d41db8738938127719))

## [0.11.1](https://github.com/AEGEE/oms-discounts/compare/0.11.0...0.11.1) (2020-05-10)


### Bug Fixes

* **docker:** mount only required folders ([#58](https://github.com/AEGEE/oms-discounts/issues/58)) ([0e8a147](https://github.com/AEGEE/oms-discounts/commit/0e8a1474deff73476d2b39249c8470492273ceb7))

# [0.11.0](https://github.com/AEGEE/oms-discounts/compare/0.10.0...0.11.0) (2020-04-26)


### Features

* **logging:** switch to bunyan, log as json ([#47](https://github.com/AEGEE/oms-discounts/issues/47)) ([b8e4b96](https://github.com/AEGEE/oms-discounts/commit/b8e4b965394ef5e31209291c0c26e4bcbe685896))

# [0.10.0](https://github.com/AEGEE/oms-discounts/compare/0.9.4...0.10.0) (2020-03-15)


### Features

* **release:** added semantic-release. Fixes MEMB-833 ([afd3d43](https://github.com/AEGEE/oms-discounts/commit/afd3d4362b98dc9e25c119f005608119fc347493))

## [0.9.4](https://github.com/AEGEE/oms-discounts/compare/0.9.2...0.9.4) (2019-11-06)


### Bug Fixes

* **bugsnag:** add bugsnag params. Fixes MEMB-642 ([607d11a](https://github.com/AEGEE/oms-discounts/commit/607d11a))
* **deps:** fixed npm audit vulnerability ([6801ad1](https://github.com/AEGEE/oms-discounts/commit/6801ad1))
* **deps:** fixed security vulnerabilities ([f4f7b33](https://github.com/AEGEE/oms-discounts/commit/f4f7b33))
* **docker:** use latest tag for prod environment ([991a60f](https://github.com/AEGEE/oms-discounts/commit/991a60f))
* **general:** removed config example. Fixes MEMB-687 ([ba8f7b6](https://github.com/AEGEE/oms-discounts/commit/ba8f7b6))
* **sequelize:** removed the deprecation warning ([7c12962](https://github.com/AEGEE/oms-discounts/commit/7c12962))


### Features

* **general:** slack notifications on docker build & push. Fixes MEMB-671 ([c892851](https://github.com/AEGEE/oms-discounts/commit/c892851))



## [0.9.2](https://github.com/AEGEE/oms-discounts/compare/0.9.1...0.9.2) (2019-10-13)


### Bug Fixes

* **circleci:** added proper dev docker building ([509cab6](https://github.com/AEGEE/oms-discounts/commit/509cab6))
* **docker:** do not overwrite important folder ([8606101](https://github.com/AEGEE/oms-discounts/commit/8606101))
* **docker:** fixed oms-discounts running in dev ([6e34a89](https://github.com/AEGEE/oms-discounts/commit/6e34a89))
* **docker:** have to go around secrets ([2c381ff](https://github.com/AEGEE/oms-discounts/commit/2c381ff))
* **docker:** npm target with run ([5ebdf77](https://github.com/AEGEE/oms-discounts/commit/5ebdf77))
* **script:** add permission ([5bc82ff](https://github.com/AEGEE/oms-discounts/commit/5bc82ff))



## [0.9.1](https://github.com/AEGEE/oms-discounts/compare/0.9.0...0.9.1) (2019-09-25)


### Bug Fixes

* **deps:** fix npm audit vulnerabilities report ([d1607e3](https://github.com/AEGEE/oms-discounts/commit/d1607e3))
* **metrics:** added request metrics path ([536f52e](https://github.com/AEGEE/oms-discounts/commit/536f52e))
* **test:** fix flapping tests ([582171e](https://github.com/AEGEE/oms-discounts/commit/582171e))



# [0.9.0](https://github.com/AEGEE/oms-discounts/compare/0.8.1...0.9.0) (2019-09-22)


### Bug Fixes

* **metrics:** fix endpoint metric name ([841117a](https://github.com/AEGEE/oms-discounts/commit/841117a))



## [0.8.1](https://github.com/AEGEE/oms-discounts/compare/0.8.0...0.8.1) (2019-09-21)


### Bug Fixes

* **deps:** bumped Sequelize to latest to fix vulnerability ([c03c796](https://github.com/AEGEE/oms-discounts/commit/c03c796))
* **metrics:** increased metrics performance ([6f78319](https://github.com/AEGEE/oms-discounts/commit/6f78319))



# [0.8.0](https://github.com/AEGEE/oms-discounts/compare/0.7.0...0.8.0) (2019-09-19)


### Bug Fixes

* **docker:** fix dockerfile path ([63eb342](https://github.com/AEGEE/oms-discounts/commit/63eb342))


### Features

* **metrics:** added /metrics endpoint. Fixes MEMB-604 ([e43f8cd](https://github.com/AEGEE/oms-discounts/commit/e43f8cd))



# [0.7.0](https://github.com/AEGEE/oms-discounts/compare/0.6.0...0.7.0) (2019-09-13)


### Bug Fixes

* **deps:** added jest-junit for tests ([8bf3d27](https://github.com/AEGEE/oms-discounts/commit/8bf3d27))
* **docker:** fixed Dockerfile ([55f07a3](https://github.com/AEGEE/oms-discounts/commit/55f07a3))
* **general:** removed Travis ([cf41ac6](https://github.com/AEGEE/oms-discounts/commit/cf41ac6))


### Features

* **docker:** added proper dockerfile. Fixes MEMB-613 ([b429928](https://github.com/AEGEE/oms-discounts/commit/b429928))



# [0.6.0](https://github.com/AEGEE/oms-discounts/compare/0.5.2...0.6.0) (2019-09-01)


### Bug Fixes

* **deps:** fixed non-major semver security vulnerabilities ([e70b5f1](https://github.com/AEGEE/oms-discounts/commit/e70b5f1))
* **general:** set config from logging. Fixes MEMB-547 ([cb97997](https://github.com/AEGEE/oms-discounts/commit/cb97997))


### Features

* **general:** added CircleCI. Fixes MEMB-602 ([bf4d113](https://github.com/AEGEE/oms-discounts/commit/bf4d113))



## [0.5.2](https://github.com/AEGEE/oms-discounts/compare/0.5.1...0.5.2) (2019-08-24)


### Bug Fixes

* **deps:** fixed major semver security vulnerabilities ([28e7271](https://github.com/AEGEE/oms-discounts/commit/28e7271))
* **deps:** fixed non-major semver security vulnerabilities ([18d5239](https://github.com/AEGEE/oms-discounts/commit/18d5239))
* **deps:** updated Sequelize. Fixes MEMB-520 ([028983f](https://github.com/AEGEE/oms-discounts/commit/028983f))
* **docker:** updated node to v12. Fixes MEMB-522 ([ffa1117](https://github.com/AEGEE/oms-discounts/commit/ffa1117))
* **docker:** use separate postgres volume. Fixes MEMB-592 ([537031b](https://github.com/AEGEE/oms-discounts/commit/537031b))



## [0.5.1](https://github.com/AEGEE/oms-discounts/compare/e2d8ccc...0.5.1) (2019-08-11)


### Bug Fixes

* **categories:** fixed categories endpoints ([08320a0](https://github.com/AEGEE/oms-discounts/commit/08320a0))
* **codes:** fix claimed date ([a060bdf](https://github.com/AEGEE/oms-discounts/commit/a060bdf))
* **codes:** fix mailer template breaking ([589f490](https://github.com/AEGEE/oms-discounts/commit/589f490))
* **deps:** downgraded Sequelize to 4.x to avoid camelCase ([a7f898b](https://github.com/AEGEE/oms-discounts/commit/a7f898b))
* **general:** added Codecov package ([fad3cfe](https://github.com/AEGEE/oms-discounts/commit/fad3cfe))
* **general:** updated Bugsnag key ([e2d8ccc](https://github.com/AEGEE/oms-discounts/commit/e2d8ccc))
* **integration:** integration code is unique now ([d2a795c](https://github.com/AEGEE/oms-discounts/commit/d2a795c))
* **integration:** quota_period now can be only day, month or year ([67ee4bb](https://github.com/AEGEE/oms-discounts/commit/67ee4bb))
* **other:** added /healthcheck endpoint. Fixes MEMB-582 ([396a646](https://github.com/AEGEE/oms-discounts/commit/396a646))


### Features

* **code:** add code model ([a7dd4e2](https://github.com/AEGEE/oms-discounts/commit/a7dd4e2))
* **code:** added code middlewares ([508a460](https://github.com/AEGEE/oms-discounts/commit/508a460))
* **codes:** mailing code to a member on claiming. Fixed MEMB-528 ([147ad23](https://github.com/AEGEE/oms-discounts/commit/147ad23))
* **discounts:** added categories. Fixes MEMB-529 ([67d7380](https://github.com/AEGEE/oms-discounts/commit/67d7380))
* **general:** discounts + eslint ([31a75f5](https://github.com/AEGEE/oms-discounts/commit/31a75f5))
* **general:** integrations management (not tested yet) ([4e168a2](https://github.com/AEGEE/oms-discounts/commit/4e168a2))
* **integration:** add single integration displaying ([bb73032](https://github.com/AEGEE/oms-discounts/commit/bb73032))
* **test:** add basic test infrastructure ([80a6a3f](https://github.com/AEGEE/oms-discounts/commit/80a6a3f))
* **test:** added tests for everything ([a1e77d5](https://github.com/AEGEE/oms-discounts/commit/a1e77d5))
* **test:** testing categories CRUD ([53af8e7](https://github.com/AEGEE/oms-discounts/commit/53af8e7))
* **test:** testing codes claiming and displaying ([bb3b649](https://github.com/AEGEE/oms-discounts/commit/bb3b649))
* **test:** tests refactor ([3e665ef](https://github.com/AEGEE/oms-discounts/commit/3e665ef))
* **test:** travis integration ([5acac0a](https://github.com/AEGEE/oms-discounts/commit/5acac0a))
