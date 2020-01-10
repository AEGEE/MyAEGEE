## [0.7.1](https://github.com/AEGEE/oms-docker/compare/0.7.0...0.7.1) (2020-01-10)


### Bug Fixes

* **general:** fixed statutory board applied/edited template ([afa85ad](https://github.com/AEGEE/oms-docker/commit/afa85ad130949ff4d1207e55dba11b782745e357))



# [0.7.0](https://github.com/AEGEE/oms-docker/compare/0.6.0...0.7.0) (2020-01-04)


### Features

* **general:** added events_event_created and events_event_updated templates. Fixes MEMB-748 ([3256b73](https://github.com/AEGEE/oms-docker/commit/3256b737900771de76498f6f8d14806bc8a71fc1))



# [0.6.0](https://github.com/AEGEE/oms-docker/compare/0.5.0...0.6.0) (2020-01-03)


### Bug Fixes

* **general:** refactored statutory applications template ([b0337a7](https://github.com/AEGEE/oms-docker/commit/b0337a76237238acfbbf7e99666a04346ba0d0db))


### Features

* **general:** added events_applied and events_edited templates. Fixes MEMB-751 ([3f02ab6](https://github.com/AEGEE/oms-docker/commit/3f02ab61b0e5a0faf0c5705878bb923b24876198))



# [0.5.0](https://github.com/AEGEE/oms-docker/compare/0.4.3...0.5.0) (2020-01-03)


### Features

* added statutory templates for board ([20320e0](https://github.com/AEGEE/oms-docker/commit/20320e0737aa3161b718e5150bddfec673040091))



## [0.4.3](https://github.com/AEGEE/oms-docker/compare/0.4.2...0.4.3) (2020-01-03)


### Bug Fixes

* **events:** fixed events status change text ([9a24e13](https://github.com/AEGEE/oms-docker/commit/9a24e1389cde6c43d97862a4cb5916e77c71b230))



## [0.4.2](https://github.com/AEGEE/oms-docker/compare/0.4.1...0.4.2) (2020-01-03)


### Bug Fixes

* **ci:** fixed CircleCI ([0fbede1](https://github.com/AEGEE/oms-docker/commit/0fbede1345d14e6a89675d6b9f4a223bc94162b8))
* **ci:** fixed travis ([5ebe4d3](https://github.com/AEGEE/oms-docker/commit/5ebe4d3941833b055ee16bc4eed4079ab5906164))


### Features

* **templates:** added events status changed template. Fixes MEMB-747 ([5cbce55](https://github.com/AEGEE/oms-docker/commit/5cbce55376833b3c1bdbb6134de281270bf107e9))



## [0.4.1](https://github.com/AEGEE/oms-docker/compare/0.4.0...0.4.1) (2019-12-30)


### Bug Fixes

* **docker:** require env variables to be set ([84b080f](https://github.com/AEGEE/oms-docker/commit/84b080f25bb56ce8cf3462f92551513b2f3bdc6e))
* **general:** forgot to change the project name in package.json ([599138e](https://github.com/AEGEE/oms-docker/commit/599138e126c908855e75eebaeeea6d93e689cffd))
* **test:** fixed circleci ([0d9da43](https://github.com/AEGEE/oms-docker/commit/0d9da430a2e7fd83b62f498b2f5907fab361d0f3))
* **test:** fixed travis ([9b8b0c3](https://github.com/AEGEE/oms-docker/commit/9b8b0c35a70e69d13e2293df6ec08caa5b06c647))



# [0.4.0](https://github.com/AEGEE/oms-docker/compare/0.3.2...0.4.0) (2019-11-30)


### Features

* **general:** refactored env settings. Fixes MEMB-676 ([5dc4ab3](https://github.com/AEGEE/oms-docker/commit/5dc4ab35555e475d3aa0d5e09981fb1a5f319b15))



## [0.3.2](https://github.com/AEGEE/oms-docker/compare/0.3.1...0.3.2) (2019-11-08)


### Bug Fixes

* **docker:** fixed mail-transfer-agent building ([fae61c0](https://github.com/AEGEE/oms-docker/commit/fae61c0faa8880bb0a6c82fac726bb4fc8394f27))



## [0.3.1](https://github.com/AEGEE/oms-docker/compare/0.3.0...0.3.1) (2019-11-08)


### Bug Fixes

* **docker:** building oms-mail-transfer-agent along with oms-mailer ([a45c3a2](https://github.com/AEGEE/oms-docker/commit/a45c3a2722af86fded1b65ec99565e9716e27707))
* **docker:** fixed docker tag generation in docker-compose ([3e49625](https://github.com/AEGEE/oms-docker/commit/3e4962533f130963aed46a13e5330115c817a383))



# [0.3.0](https://github.com/AEGEE/oms-docker/compare/0.2.1...0.3.0) (2019-11-07)


### Features

* **general:** switched to CircleCI from Travis. Fixes MEMB-678 ([d9a13a7](https://github.com/AEGEE/oms-docker/commit/d9a13a7895e9de8ea39217fd985e59b9f5191990))



## [0.2.1](https://github.com/AEGEE/oms-docker/compare/0.2.0...0.2.1) (2019-10-30)


### Features

* **general:** log request body. Fixes MEMB-692 ([d8830f0](https://github.com/AEGEE/oms-docker/commit/d8830f00785f7208c8911be20a3c67f99204ebd2))



# [0.2.0](https://github.com/AEGEE/oms-docker/compare/67177f6e6616ac5654ec79c92a96dd6b6ff272a3...0.2.0) (2019-10-25)


### Bug Fixes

* **docker:** finish separation between prod-dev ([dc78d1b](https://github.com/AEGEE/oms-docker/commit/dc78d1bf139b03c760feb956a9a3535c3f96b697))
* **docker:** have to go around secrets ([b623974](https://github.com/AEGEE/oms-docker/commit/b6239743fbb617b8248e7834ceb3a674c8883d97))
* **docker:** manifest version mismatch ([80cff56](https://github.com/AEGEE/oms-docker/commit/80cff5673b0c6da053d087ea3df716263447ab90))
* fixed mail template for join request ([67177f6](https://github.com/AEGEE/oms-docker/commit/67177f6e6616ac5654ec79c92a96dd6b6ff272a3))


### Features

* **general:** added conventional commits. Fixes MEMB-555 ([3fda935](https://github.com/AEGEE/oms-docker/commit/3fda935a8c1135f4ea897296f3020a27ab57049e))
* **general:** added healthcheck. Fixes MEMB-646 ([89e1a0e](https://github.com/AEGEE/oms-docker/commit/89e1a0eee5ded4c0a5286de02da7c8cb326ff0fe))



