# [0.9.0](https://github.com/AEGEE/oms-discounts/compare/0.8.1...0.9.0) (2019-09-22)


### Bug Fixes

* **metrics:** fix endpoint metric name ([841117a](https://github.com/AEGEE/oms-discounts/commit/841117a))



## [0.8.1](https://github.com/AEGEE/oms-discounts/compare/0.8.0...0.8.1) (2019-09-21)


### Bug Fixes

* **deps:** bumped Sequelize to latest to fix vulnerability ([c03c796](https://github.com/AEGEE/oms-discounts/commit/c03c796))
* **metrics:** increased metrics performance ([6f78319](https://github.com/AEGEE/oms-discounts/commit/6f78319))



# [0.8.0](https://github.com/AEGEE/oms-discounts/compare/0.6.0...0.8.0) (2019-09-19)


### Bug Fixes

* **deps:** added jest-junit for tests ([8bf3d27](https://github.com/AEGEE/oms-discounts/commit/8bf3d27))
* **docker:** fix dockerfile path ([63eb342](https://github.com/AEGEE/oms-discounts/commit/63eb342))
* **docker:** fixed Dockerfile ([55f07a3](https://github.com/AEGEE/oms-discounts/commit/55f07a3))
* **general:** removed Travis ([cf41ac6](https://github.com/AEGEE/oms-discounts/commit/cf41ac6))


### Features

* **docker:** added proper dockerfile. Fixes MEMB-613 ([b429928](https://github.com/AEGEE/oms-discounts/commit/b429928))
* **metrics:** added /metrics endpoint. Fixes MEMB-604 ([e43f8cd](https://github.com/AEGEE/oms-discounts/commit/e43f8cd))



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



