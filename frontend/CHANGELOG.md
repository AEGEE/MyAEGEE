<a name="0.26.3"></a>
## [0.26.3](https://github.com/AEGEE/oms-frontend/compare/0.26.2...0.26.3) (2019-11-09)


### Bug Fixes

* **events:** fixed events applications permissions ([dd9b047](https://github.com/AEGEE/oms-frontend/commit/dd9b047))



<a name="0.26.2"></a>
## [0.26.2](https://github.com/AEGEE/oms-frontend/compare/0.26.1...0.26.2) (2019-11-09)


### Bug Fixes

* **events:** added disclaimer on applying to events page ([b1f343d](https://github.com/AEGEE/oms-frontend/commit/b1f343d))
* **events:** always display map on event creation page ([1d68878](https://github.com/AEGEE/oms-frontend/commit/1d68878))
* **events:** do not display application link if the event is not published ([8139c0b](https://github.com/AEGEE/oms-frontend/commit/8139c0b))
* **events:** now allowing to apply when the event is not published ([d44aed4](https://github.com/AEGEE/oms-frontend/commit/d44aed4))
* **general:** fixed events colors ([8d11175](https://github.com/AEGEE/oms-frontend/commit/8d11175))



<a name="0.26.1"></a>
## [0.26.1](https://github.com/AEGEE/oms-frontend/compare/0.26.0...0.26.1) (2019-11-09)


### Bug Fixes

* **events:** fix events prefixes on calendar ([731931e](https://github.com/AEGEE/oms-frontend/commit/731931e))



<a name="0.26.0"></a>
# [0.26.0](https://github.com/AEGEE/oms-frontend/compare/0.25.4...0.26.0) (2019-11-08)


### Bug Fixes

* **events:** only requesting dispayed events ([c2eb6ca](https://github.com/AEGEE/oms-frontend/commit/c2eb6ca))
* **events:** using starts= instead of displayPast= for listings ([3e62ceb](https://github.com/AEGEE/oms-frontend/commit/3e62ceb))


### Features

* **general:** added statutory events to calendar. Fixes MEMB-708 ([aafa843](https://github.com/AEGEE/oms-frontend/commit/aafa843))



<a name="0.25.4"></a>
## [0.25.4](https://github.com/AEGEE/oms-frontend/compare/0.25.3...0.25.4) (2019-11-06)


### Bug Fixes

* **events:** display images on events listings. Fixes MEMB-711 ([10f19b3](https://github.com/AEGEE/oms-frontend/commit/10f19b3))



<a name="0.25.3"></a>
## [0.25.3](https://github.com/AEGEE/oms-frontend/compare/0.25.2...0.25.3) (2019-11-06)


### Bug Fixes

* **deps:** fixed security vulnerability so npm audit step will pass ([d008e09](https://github.com/AEGEE/oms-frontend/commit/d008e09))
* **docker:** disabled healthcheck for now ([2ec4154](https://github.com/AEGEE/oms-frontend/commit/2ec4154))
* **docker:** fixed nginx container + healthcheck ([79610f0](https://github.com/AEGEE/oms-frontend/commit/79610f0))


### Features

* **general:** slack notifications on docker build & push. Fixes MEMB-671 ([575ba10](https://github.com/AEGEE/oms-frontend/commit/575ba10))



<a name="0.25.2"></a>
## [0.25.2](https://github.com/AEGEE/oms-frontend/compare/0.25.1...0.25.2) (2019-11-05)


### Bug Fixes

* **events:** fix events imageslinks ([43b1ace](https://github.com/AEGEE/oms-frontend/commit/43b1ace))
* **nginx:** config file tweaks ([088545e](https://github.com/AEGEE/oms-frontend/commit/088545e))



<a name="0.25.1"></a>
## [0.25.1](https://github.com/AEGEE/oms-frontend/compare/0.25.0...0.25.1) (2019-11-03)


### Bug Fixes

* **events:** added event creation disclaimer. Fixes MEMB-706 ([009ada8](https://github.com/AEGEE/oms-frontend/commit/009ada8))
* **general:** add core and mailer changelogs to /status ([9e33417](https://github.com/AEGEE/oms-frontend/commit/9e33417))



<a name="0.25.0"></a>
# [0.25.0](https://github.com/AEGEE/oms-frontend/compare/0.24.4...0.25.0) (2019-11-01)


### Bug Fixes

* **events:** added disclaimer for events questions. Fixes MEMB-704 ([331ad4d](https://github.com/AEGEE/oms-frontend/commit/331ad4d))
* **events:** requiring required checkbox on application page ([d373c84](https://github.com/AEGEE/oms-frontend/commit/d373c84))


### Features

* **general:** switched to Mapbox/Maptiler instead of gmaps. Fixes MEMB-640 ([ba272aa](https://github.com/AEGEE/oms-frontend/commit/ba272aa))



<a name="0.24.4"></a>
## [0.24.4](https://github.com/AEGEE/oms-frontend/compare/0.24.3...0.24.4) (2019-10-31)


### Bug Fixes

* **core:** allow unauthorized access for /bodies and /bodies/:id. Fixes MEMB-680 ([0e9d8d3](https://github.com/AEGEE/oms-frontend/commit/0e9d8d3))
* **general:** fix authorization checking issues ([a406098](https://github.com/AEGEE/oms-frontend/commit/a406098))



<a name="0.24.3"></a>
## [0.24.3](https://github.com/AEGEE/oms-frontend/compare/0.24.2...0.24.3) (2019-10-31)


### Bug Fixes

* **general:** allow unauthorized access for stuff. Fixes MEMB-680, HELP-720, HELP-719 ([d163683](https://github.com/AEGEE/oms-frontend/commit/d163683))



<a name="0.24.2"></a>
## [0.24.2](https://github.com/AEGEE/oms-frontend/compare/0.24.1...0.24.2) (2019-10-29)


### Bug Fixes

* **events:** fixed wrong event type on card on listing. Fixes HELP-722 ([50fc66a](https://github.com/AEGEE/oms-frontend/commit/50fc66a))
* **general:** removed breadcrumbs. Fixes HELP-710, HELP-723 ([67eced5](https://github.com/AEGEE/oms-frontend/commit/67eced5))



<a name="0.24.1"></a>
## [0.24.1](https://github.com/AEGEE/oms-frontend/compare/0.24.0...0.24.1) (2019-10-27)


### Bug Fixes

* **calendar:** first day as Monday. Fixes MEMB-684 ([128c3d0](https://github.com/AEGEE/oms-frontend/commit/128c3d0))



<a name="0.24.0"></a>
# [0.24.0](https://github.com/AEGEE/oms-frontend/compare/0.23.13...0.24.0) (2019-10-25)


### Bug Fixes

* **deps:** fixed audit vulnerability ([3d6bb45](https://github.com/AEGEE/oms-frontend/commit/3d6bb45))


### Features

* **general:** added events calendar. Fixes MEMB-313 ([7ea4943](https://github.com/AEGEE/oms-frontend/commit/7ea4943))



<a name="0.23.13"></a>
## [0.23.13](https://github.com/AEGEE/oms-frontend/compare/0.23.12...0.23.13) (2019-10-25)


### Bug Fixes

* **statutory:** allow editing question only when the question line is open ([8fbe800](https://github.com/AEGEE/oms-frontend/commit/8fbe800))
* **statutory:** display question numbers in question lines ([893419e](https://github.com/AEGEE/oms-frontend/commit/893419e))



<a name="0.23.12"></a>
## [0.23.12](https://github.com/AEGEE/oms-frontend/compare/0.23.11...0.23.12) (2019-10-24)


### Bug Fixes

* **events:** allow unauthorized events listing. Fixes MEMB-641 ([b63318f](https://github.com/AEGEE/oms-frontend/commit/b63318f))
* **events:** small application fixes ([342fdef](https://github.com/AEGEE/oms-frontend/commit/342fdef))
* **general:** fix events application route ([17d4bcb](https://github.com/AEGEE/oms-frontend/commit/17d4bcb))



<a name="0.23.11"></a>
## [0.23.11](https://github.com/AEGEE/oms-frontend/compare/0.23.10...0.23.11) (2019-10-20)


### Bug Fixes

* **events:** allow seeing application when the application period is closed. Fixes HELP-623 ([9e14dcc](https://github.com/AEGEE/oms-frontend/commit/9e14dcc))
* **events:** display application period instead of the deadline ([4773165](https://github.com/AEGEE/oms-frontend/commit/4773165))



<a name="0.23.10"></a>
## [0.23.10](https://github.com/AEGEE/oms-frontend/compare/0.23.9...0.23.10) (2019-10-19)


### Bug Fixes

* **mailer:** added /healthcheck status for mailer ([ac755d4](https://github.com/AEGEE/oms-frontend/commit/ac755d4))



<a name="0.23.9"></a>
## [0.23.9](https://github.com/AEGEE/oms-frontend/compare/0.23.8...0.23.9) (2019-10-18)


### Features

* **events:** events applications refactor. Fixes MEMB-620 ([0f6d5b1](https://github.com/AEGEE/oms-frontend/commit/0f6d5b1))



<a name="0.23.8"></a>
## [0.23.8](https://github.com/AEGEE/oms-frontend/compare/0.23.7...0.23.8) (2019-10-17)


### Bug Fixes

* **statutory:** add question line indexes. Fixes MEMB-644 ([6f48102](https://github.com/AEGEE/oms-frontend/commit/6f48102))



<a name="0.23.7"></a>
## [0.23.7](https://github.com/AEGEE/oms-frontend/compare/0.23.6...0.23.7) (2019-10-13)


### Bug Fixes

* **circleci:** added proper dev docker building ([56ba057](https://github.com/AEGEE/oms-frontend/commit/56ba057))
* **deps:** fix npm audit vulnerabilities report ([4b0ed4a](https://github.com/AEGEE/oms-frontend/commit/4b0ed4a))
* **docker:** have to go around secrets ([f3ed7ab](https://github.com/AEGEE/oms-frontend/commit/f3ed7ab))
* **docker:** in dev, the script was overwritten ([c0a7e9a](https://github.com/AEGEE/oms-frontend/commit/c0a7e9a))
* **script:** permissions were bad ([b6af2ed](https://github.com/AEGEE/oms-frontend/commit/b6af2ed))
* **startup:** chmod parent directory ([4f9072d](https://github.com/AEGEE/oms-frontend/commit/4f9072d))
* very trashy but oh well.. ([b7cc89f](https://github.com/AEGEE/oms-frontend/commit/b7cc89f))



<a name="0.23.6"></a>
## [0.23.6](https://github.com/AEGEE/oms-frontend/compare/0.23.5...0.23.6) (2019-09-26)


### Bug Fixes

* **statutory:** allow editing applications for JC/admins. Fixes MEMB-626 ([15b6ca5](https://github.com/AEGEE/oms-frontend/commit/15b6ca5))



<a name="0.23.5"></a>
## [0.23.5](https://github.com/AEGEE/oms-frontend/compare/0.23.4...0.23.5) (2019-09-19)


### Bug Fixes

* **general:** fixed routing for unauthorized users. Fixes HELP-653 ([7c9240e](https://github.com/AEGEE/oms-frontend/commit/7c9240e))



<a name="0.23.4"></a>
## [0.23.4](https://github.com/AEGEE/oms-frontend/compare/0.23.3...0.23.4) (2019-09-18)


### Bug Fixes

* **general:** forward previous URL to /login and redirecting. Fixes MEMB-565 ([b2ec2a4](https://github.com/AEGEE/oms-frontend/commit/b2ec2a4))



<a name="0.23.3"></a>
## [0.23.3](https://github.com/AEGEE/oms-frontend/compare/0.23.2...0.23.3) (2019-09-17)


### Bug Fixes

* **core:** expanded user profile edit input ([93781d0](https://github.com/AEGEE/oms-frontend/commit/93781d0))
* **core:** using select instead of autocomplete for primary body. Fixes MEMB-616 ([f3e591c](https://github.com/AEGEE/oms-frontend/commit/f3e591c))
* **login:** fix buttons layout on /login page ([551647d](https://github.com/AEGEE/oms-frontend/commit/551647d))



<a name="0.23.2"></a>
## [0.23.2](https://github.com/AEGEE/oms-frontend/compare/0.23.1...0.23.2) (2019-09-17)


### Bug Fixes

* **login:** fixed pre-fetching user on logging in ([45bc4fd](https://github.com/AEGEE/oms-frontend/commit/45bc4fd))



<a name="0.23.1"></a>
## [0.23.1](https://github.com/AEGEE/oms-frontend/compare/0.23.0...0.23.1) (2019-09-17)


### Bug Fixes

* **login:** fetching user on unauthorized endpoints. Fixes HELP-627 ([ca23249](https://github.com/AEGEE/oms-frontend/commit/ca23249))



<a name="0.23.0"></a>
# [0.23.0](https://github.com/AEGEE/oms-frontend/compare/0.22.5...0.23.0) (2019-09-17)


### Features

* **general:** refactor menu. Fixes MEMB-467 ([db2e0c2](https://github.com/AEGEE/oms-frontend/commit/db2e0c2))



<a name="0.22.5"></a>
## [0.22.5](https://github.com/AEGEE/oms-frontend/compare/0.22.4...0.22.5) (2019-09-17)


### Bug Fixes

* **circleci:** fixed docker build task ([a05df7f](https://github.com/AEGEE/oms-frontend/commit/a05df7f))
* **docker:** fixed Hadolint warnings ([e0d59a7](https://github.com/AEGEE/oms-frontend/commit/e0d59a7))
* **statutory:** updated positions deadline clarification. Fixes MEMB-615 ([8e89291](https://github.com/AEGEE/oms-frontend/commit/8e89291))



<a name="0.22.4"></a>
## [0.22.4](https://github.com/AEGEE/oms-frontend/compare/0.22.3...0.22.4) (2019-09-16)


### Bug Fixes

* **docker:** added .dockerignore ([685706a](https://github.com/AEGEE/oms-frontend/commit/685706a))
* **docker:** added traefik labels ([650f16a](https://github.com/AEGEE/oms-frontend/commit/650f16a))


### Features

* **docker:** added proper dockerfile. Fixes MEMB-613 ([bde907a](https://github.com/AEGEE/oms-frontend/commit/bde907a))



<a name="0.22.3"></a>
## [0.22.3](https://github.com/AEGEE/oms-frontend/compare/0.22.2...0.22.3) (2019-09-11)


### Bug Fixes

* **events:** fix event type setting on creating/editing. Fixes HELP-648 ([37f6797](https://github.com/AEGEE/oms-frontend/commit/37f6797))
* **general:** added links to services on /about page. Fixes HELP-643 ([3947723](https://github.com/AEGEE/oms-frontend/commit/3947723))



<a name="0.22.2"></a>
## [0.22.2](https://github.com/AEGEE/oms-frontend/compare/0.22.1...0.22.2) (2019-09-10)


### Bug Fixes

* **general:** fix login password placeholder. Fixes HELP-640 ([ebdd423](https://github.com/AEGEE/oms-frontend/commit/ebdd423))



<a name="0.22.1"></a>
## [0.22.1](https://github.com/AEGEE/oms-frontend/compare/0.22.0...0.22.1) (2019-09-09)


### Bug Fixes

* **general:** fix status page menu permissions ([26d6fad](https://github.com/AEGEE/oms-frontend/commit/26d6fad))



<a name="0.22.0"></a>
# [0.22.0](https://github.com/AEGEE/oms-frontend/compare/0.21.4...0.22.0) (2019-09-09)


### Bug Fixes

* **events:** changed event types. Fixes HELP-629 ([cfbec48](https://github.com/AEGEE/oms-frontend/commit/cfbec48))


### Features

* **general:** added status page menu entry ([cc58d2c](https://github.com/AEGEE/oms-frontend/commit/cc58d2c))



<a name="0.21.4"></a>
## [0.21.4](https://github.com/AEGEE/oms-frontend/compare/0.21.3...0.21.4) (2019-09-07)


### Bug Fixes

* **statutory:** fixes links and tasks page ([07c6593](https://github.com/AEGEE/oms-frontend/commit/07c6593))



<a name="0.21.3"></a>
## [0.21.3](https://github.com/AEGEE/oms-frontend/compare/0.21.2...0.21.3) (2019-09-07)


### Bug Fixes

* **statutory:** added force close deadline for positions. Fixes MEMB-595 ([0fd4c48](https://github.com/AEGEE/oms-frontend/commit/0fd4c48))



<a name="0.21.2"></a>
## [0.21.2](https://github.com/AEGEE/oms-frontend/compare/0.21.1...0.21.2) (2019-09-04)


### Bug Fixes

* **debug:** enable performance tracking ([0323abc](https://github.com/AEGEE/oms-frontend/commit/0323abc))
* **deps:** updated buefy to 0.8.3. Fixes MEMB-610 ([c33c67c](https://github.com/AEGEE/oms-frontend/commit/c33c67c))



<a name="0.21.1"></a>
## [0.21.1](https://github.com/AEGEE/oms-frontend/compare/0.21.0...0.21.1) (2019-08-29)


### Bug Fixes

* **core:** removed circle IDs from listing. Fixes HELP-625 ([0b2324d](https://github.com/AEGEE/oms-frontend/commit/0b2324d))


### Features

* **general:** visualizing Confluence pages. Fixes MEMB-540 ([12915a4](https://github.com/AEGEE/oms-frontend/commit/12915a4))



<a name="0.21.0"></a>
# [0.21.0](https://github.com/AEGEE/oms-frontend/compare/0.20.3...0.21.0) (2019-08-26)


### Features

* **statutory:** allow deleting question lines. Fixes MEMB-603 ([409be7a](https://github.com/AEGEE/oms-frontend/commit/409be7a))



<a name="0.20.3"></a>
## [0.20.3](https://github.com/AEGEE/oms-frontend/compare/0.20.2...0.20.3) (2019-08-25)


### Bug Fixes

* **statutory:** fix pagination offset for applications listing ([fb5f7bc](https://github.com/AEGEE/oms-frontend/commit/fb5f7bc))



<a name="0.20.2"></a>
## [0.20.2](https://github.com/AEGEE/oms-frontend/compare/0.20.1...0.20.2) (2019-08-25)


### Bug Fixes

* **deps:** fixed non-major semver security vulnerabilities ([da7dc20](https://github.com/AEGEE/oms-frontend/commit/da7dc20))
* **statutory:** add statutory applications pagination. Fixes MEMB-599 ([eac2de4](https://github.com/AEGEE/oms-frontend/commit/eac2de4))



<a name="0.20.1"></a>
## [0.20.1](https://github.com/AEGEE/oms-frontend/compare/0.20.0...0.20.1) (2019-08-24)


### Bug Fixes

* **statutory:** changed candidating application consent text. Fixes MEMB-600 ([64501fa](https://github.com/AEGEE/oms-frontend/commit/64501fa))
* **statutory:** refactor tasks page. Fixes MEMB-601 ([f199aea](https://github.com/AEGEE/oms-frontend/commit/f199aea))



<a name="0.20.0"></a>
# [0.20.0](https://github.com/AEGEE/oms-frontend/compare/0.19.0...0.20.0) (2019-08-21)


### Features

* **statutory:** added background tasks list page. Fixes MEMB-594 ([324ccf5](https://github.com/AEGEE/oms-frontend/commit/324ccf5))



<a name="0.19.0"></a>
# [0.19.0](https://github.com/AEGEE/oms-frontend/compare/0.18.3...0.19.0) (2019-08-20)


### Features

* **statutory:** added statutory debug page. Fixes MEMB-594 ([f5dafb4](https://github.com/AEGEE/oms-frontend/commit/f5dafb4))



<a name="0.18.3"></a>
## [0.18.3](https://github.com/AEGEE/oms-frontend/compare/0.18.2...0.18.3) (2019-08-20)


### Bug Fixes

* **general:** use work break for links in markdown. Fixes MEMB-531, HELP-580 ([839d191](https://github.com/AEGEE/oms-frontend/commit/839d191))



<a name="0.18.2"></a>
## [0.18.2](https://github.com/AEGEE/oms-frontend/compare/0.18.1...0.18.2) (2019-08-20)


### Bug Fixes

* **general:** fixes autoprefixer deprecation warning. Fixes MEMB-593 ([968b4a0](https://github.com/AEGEE/oms-frontend/commit/968b4a0))
* **statutory:** added waiting list for massmailer. Fixes MEMB-597 ([62d7a1a](https://github.com/AEGEE/oms-frontend/commit/62d7a1a))
* **statutory:** minor fixes for question lines. Fixes MEMB-590 ([8abda25](https://github.com/AEGEE/oms-frontend/commit/8abda25))



<a name="0.18.1"></a>
## [0.18.1](https://github.com/AEGEE/oms-frontend/compare/0.17.5...0.18.1) (2019-08-19)


### Features

* **statutory:** added question lines management. Fixes MEMB-590 ([ae1396d](https://github.com/AEGEE/oms-frontend/commit/ae1396d))



<a name="0.17.5"></a>
## [0.17.5](https://github.com/AEGEE/oms-frontend/compare/0.17.4...0.17.5) (2019-08-15)


### Bug Fixes

* **statutory:** allow displaying statutory applications after deadline. Fixes HELP-611 ([04c1a65](https://github.com/AEGEE/oms-frontend/commit/04c1a65))



<a name="0.17.4"></a>
## [0.17.4](https://github.com/AEGEE/oms-frontend/compare/0.17.2...0.17.4) (2019-08-15)


### Bug Fixes

* **events:** added events application consent. Fixes HELP-598 ([ec15ba0](https://github.com/AEGEE/oms-frontend/commit/ec15ba0))
* **events:** updated events application consent text. Fixes HELP-598 ([fb09760](https://github.com/AEGEE/oms-frontend/commit/fb09760))



<a name="0.17.2"></a>
## [0.17.2](https://github.com/AEGEE/oms-frontend/compare/0.17.1...0.17.2) (2019-08-12)


### Bug Fixes

* **statutory:** fix memberslist editing. Fixes HELP-607 ([143243d](https://github.com/AEGEE/oms-frontend/commit/143243d))



<a name="0.17.1"></a>
## [0.17.1](https://github.com/AEGEE/oms-frontend/compare/0.17.0...0.17.1) (2019-08-12)


### Bug Fixes

* **core:** fixed activate user icon missing. Fixes MEMB-567 ([71092b3](https://github.com/AEGEE/oms-frontend/commit/71092b3))



<a name="0.17.0"></a>
# [0.17.0](https://github.com/AEGEE/oms-frontend/compare/0.16.6...0.17.0) (2019-08-11)


### Features

* **other:** added /status page. Fixes MEMB-584 ([28789b0](https://github.com/AEGEE/oms-frontend/commit/28789b0))



<a name="0.16.6"></a>
## [0.16.6](https://github.com/AEGEE/oms-frontend/compare/0.16.5...0.16.6) (2019-08-10)


### Bug Fixes

* **statutory:** do not allow saving memberslist if save is in progress ([34eff46](https://github.com/AEGEE/oms-frontend/commit/34eff46))



<a name="0.16.5"></a>
## [0.16.5](https://github.com/AEGEE/oms-frontend/compare/0.16.4...0.16.5) (2019-08-10)


### Bug Fixes

* **deps:** fix security vulnerabilities ([ba52be0](https://github.com/AEGEE/oms-frontend/commit/ba52be0))
* **statutory:** fix statutory stats ticks size. Fixes MEMB-581 ([ba61369](https://github.com/AEGEE/oms-frontend/commit/ba61369))



<a name="0.16.4"></a>
## [0.16.4](https://github.com/AEGEE/oms-frontend/compare/0.16.3...0.16.4) (2019-08-10)


### Bug Fixes

* **statutory:** fix memberslist fee fetching ([55b9003](https://github.com/AEGEE/oms-frontend/commit/55b9003))



<a name="0.16.3"></a>
## [0.16.3](https://github.com/AEGEE/oms-frontend/compare/0.16.0...0.16.3) (2019-08-02)


### Bug Fixes

* **deps:** added conventional-changelog as a dependency ([6866114](https://github.com/AEGEE/oms-frontend/commit/6866114))
* **deps:** reverted buefy to 0.7.x ([cb8686a](https://github.com/AEGEE/oms-frontend/commit/cb8686a))
* **deps:** updated deps to the latest ([085c870](https://github.com/AEGEE/oms-frontend/commit/085c870))
* **events:** switch to "Manage my application" label. Fixes HELP-573 ([affbaf6](https://github.com/AEGEE/oms-frontend/commit/affbaf6))
* **statutory:** fix "Number of event visited" label for statutory stats ([1c5de2c](https://github.com/AEGEE/oms-frontend/commit/1c5de2c))
* **statutory:** fix "Number of events visited" for statutory stats ([e6b3120](https://github.com/AEGEE/oms-frontend/commit/e6b3120))
* **test:** add Circle CI ([066f7cf](https://github.com/AEGEE/oms-frontend/commit/066f7cf))



<a name="0.16.0"></a>
# [0.16.0](https://github.com/AEGEE/oms-frontend/compare/0.15.5...0.16.0) (2019-07-30)


### Features

* **statutory:** added members list submission deadline. Fixes MEMB-578 ([cedbd36](https://github.com/AEGEE/oms-frontend/commit/cedbd36))



<a name="0.15.5"></a>
## [0.15.5](https://github.com/AEGEE/oms-frontend/compare/0.15.4...0.15.5) (2019-07-29)


### Bug Fixes

* **statutory:** added vegan meals option ([c536a5a](https://github.com/AEGEE/oms-frontend/commit/c536a5a))
* **statutory:** fixed memberslist upload permission. Fixes HELP-570 ([cdac90c](https://github.com/AEGEE/oms-frontend/commit/cdac90c))



<a name="0.15.4"></a>
## [0.15.4](https://github.com/AEGEE/oms-frontend/compare/0.15.3...0.15.4) (2019-07-25)


### Bug Fixes

* **statutory:** disabled CSV memberslist upload. Fixes MEMB-574 ([37af227](https://github.com/AEGEE/oms-frontend/commit/37af227))
* **statutory:** fetching membership fee on memberslist upload. Fixes HELP-349 ([90d0b15](https://github.com/AEGEE/oms-frontend/commit/90d0b15))



<a name="0.15.3"></a>
## [0.15.3](https://github.com/AEGEE/oms-frontend/compare/0.15.2...0.15.3) (2019-07-25)


### Bug Fixes

* **deps:** fixed marked deprecation warning ([1405c2c](https://github.com/AEGEE/oms-frontend/commit/1405c2c))
* **statutory:** switched to select on body select for events. Fixed MEMB-576 ([92e1000](https://github.com/AEGEE/oms-frontend/commit/92e1000))
* **statutory:** switched to select on body select for statutory. Fixed MEMB-576 ([ec9892f](https://github.com/AEGEE/oms-frontend/commit/ec9892f))



<a name="0.15.2"></a>
## [0.15.2](https://github.com/AEGEE/oms-frontend/compare/0.15.1...0.15.2) (2019-07-23)


### Bug Fixes

* **deps:** updated outdated packages ([9d21619](https://github.com/AEGEE/oms-frontend/commit/9d21619))
* **statutory:** fixed boardview for unlimited participants ([d50c09b](https://github.com/AEGEE/oms-frontend/commit/d50c09b))



<a name="0.15.1"></a>
## [0.15.1](https://github.com/AEGEE/oms-frontend/compare/0.15.0...0.15.1) (2019-07-23)


### Bug Fixes

* **alastair:** fixed modal interactions and a broken link ([a743b78](https://github.com/AEGEE/oms-frontend/commit/a743b78))
* **alastair:** Shop-Modal didn't open ([6f6a593](https://github.com/AEGEE/oms-frontend/commit/6f6a593))



<a name="0.15.0"></a>
# [0.15.0](https://github.com/AEGEE/oms-frontend/compare/0.14.4...0.15.0) (2019-06-02)


### Features

* **statutory:** add image upload. Fixes MEMB-549 ([12a3194](https://github.com/AEGEE/oms-frontend/commit/12a3194))



<a name="0.14.4"></a>
## [0.14.4](https://github.com/AEGEE/oms-frontend/compare/0.14.3...0.14.4) (2019-05-25)


### Bug Fixes

* **discounts:** updated links to internal education and members manual ([b39d9f8](https://github.com/AEGEE/oms-frontend/commit/b39d9f8))
* **resources:** fixed case. Fixes HELP-391 ([87f5022](https://github.com/AEGEE/oms-frontend/commit/87f5022))
* **resources:** fixed CIA link. Fixes HELP-386, HELP-506 ([cd20df7](https://github.com/AEGEE/oms-frontend/commit/cd20df7))
* **resources:** fixed intranet description ([c801236](https://github.com/AEGEE/oms-frontend/commit/c801236))
* **resources:** fixed Key to Europe link ([ebbe0a1](https://github.com/AEGEE/oms-frontend/commit/ebbe0a1))
* **resources:** removed Strategic Planning link ([fe84b2a](https://github.com/AEGEE/oms-frontend/commit/fe84b2a))
* **resources:** renamed Resources. Fixes HELP-388 ([01439a4](https://github.com/AEGEE/oms-frontend/commit/01439a4))
* **resources:** switched to one color. Fixes HELP-385 ([bd795ab](https://github.com/AEGEE/oms-frontend/commit/bd795ab))
* **statutory:** removed link to old statutory. Fixes MEMB-394 ([83850ec](https://github.com/AEGEE/oms-frontend/commit/83850ec))



<a name="0.14.3"></a>
## [0.14.3](https://github.com/AEGEE/oms-frontend/compare/0.14.2...0.14.3) (2019-05-25)


### Bug Fixes

* **statutory:** added statutory ID. Fixes HELP-239 ([b390661](https://github.com/AEGEE/oms-frontend/commit/b390661))



<a name="0.14.2"></a>
## [0.14.2](https://github.com/AEGEE/oms-frontend/compare/0.14.1...0.14.2) (2019-05-23)


### Features

* **core:** introduce body foundation date. Fixes HELP-513 ([c7ceadf](https://github.com/AEGEE/oms-frontend/commit/c7ceadf))



<a name="0.14.1"></a>
## [0.14.1](https://github.com/AEGEE/oms-frontend/compare/0.14.0...0.14.1) (2019-05-22)


### Bug Fixes

* **statutory:** remove boardview listing sorting ([0f80b8c](https://github.com/AEGEE/oms-frontend/commit/0f80b8c))



<a name="0.14.0"></a>
# [0.14.0](https://github.com/AEGEE/oms-frontend/compare/0.13.0...0.14.0) (2019-05-21)


### Features

* **statutory:** boardview refactor. Fixes MEMB-376 ([91517d4](https://github.com/AEGEE/oms-frontend/commit/91517d4))



<a name="0.13.0"></a>
# [0.13.0](https://github.com/AEGEE/oms-frontend/compare/0.12.5...0.13.0) (2019-05-20)


### Bug Fixes

* **alastair:** forgot to remove dashboard debug output ([1f6c189](https://github.com/AEGEE/oms-frontend/commit/1f6c189))
* **alastair:** removed small fuckups ([f9fd284](https://github.com/AEGEE/oms-frontend/commit/f9fd284))


### Features

* **alastair:** added most of chef and shop view ([f9faeb3](https://github.com/AEGEE/oms-frontend/commit/f9faeb3))
* **alastair:** added welcome and my events page ([f058488](https://github.com/AEGEE/oms-frontend/commit/f058488))
* **alastair:** first usable version of the frontend ([79836d2](https://github.com/AEGEE/oms-frontend/commit/79836d2))



<a name="0.12.5"></a>
## [0.12.5](https://github.com/AEGEE/oms-frontend/compare/0.12.4...0.12.5) (2019-05-19)


### Bug Fixes

* **statutory:** removed sorting on statutory boardview ([50f5109](https://github.com/AEGEE/oms-frontend/commit/50f5109))



<a name="0.12.4"></a>
## [0.12.4](https://github.com/AEGEE/oms-frontend/compare/0.12.3...0.12.4) (2019-05-19)


### Bug Fixes

* **general:** refactored sidebar. Fixes MEMB-498 ([6946c6b](https://github.com/AEGEE/oms-frontend/commit/6946c6b))



<a name="0.12.3"></a>
## [0.12.3](https://github.com/AEGEE/oms-frontend/compare/0.12.2...0.12.3) (2019-05-19)


### Bug Fixes

* **statutory:** added waiting_list status for pax. Fixed MEMB-490 ([45e3f66](https://github.com/AEGEE/oms-frontend/commit/45e3f66))



<a name="0.12.2"></a>
## [0.12.2](https://github.com/AEGEE/oms-frontend/compare/0.12.1...0.12.2) (2019-05-18)


### Bug Fixes

* **discounts:** fixed selecting integration on loading ([f399e7f](https://github.com/AEGEE/oms-frontend/commit/f399e7f))



<a name="0.12.1"></a>
## [0.12.1](https://github.com/AEGEE/oms-frontend/compare/0.11.5...0.12.1) (2019-05-18)


### Bug Fixes

* **discounts:** choosing 1st integration always when claiming codes ([8275c44](https://github.com/AEGEE/oms-frontend/commit/8275c44))


### Features

* **discounts:** discounts management. Fixed MEMB-529 ([c055aa3](https://github.com/AEGEE/oms-frontend/commit/c055aa3))



<a name="0.11.5"></a>
## [0.11.5](https://github.com/AEGEE/oms-frontend/compare/0.11.4...0.11.5) (2019-05-17)


### Bug Fixes

* **statutory:** added pax type filter for massmailer. Fixes MEMB-516 ([973a540](https://github.com/AEGEE/oms-frontend/commit/973a540))



<a name="0.11.4"></a>
## [0.11.4](https://github.com/AEGEE/oms-frontend/compare/0.11.3...0.11.4) (2019-05-17)


### Bug Fixes

* **statutory:** fix stats colors displaying ([2a86699](https://github.com/AEGEE/oms-frontend/commit/2a86699))



<a name="0.11.3"></a>
## [0.11.3](https://github.com/AEGEE/oms-frontend/compare/0.11.2...0.11.3) (2019-05-17)


### Bug Fixes

* **statutory:** more colors to application stats. Fixes HELP-524 ([89e0c4f](https://github.com/AEGEE/oms-frontend/commit/89e0c4f))



<a name="0.11.2"></a>
## [0.11.2](https://github.com/AEGEE/oms-frontend/compare/0.11.1...0.11.2) (2019-05-17)


### Bug Fixes

* **deps:** fixed security vulnerability in node-sass ([51e44cc](https://github.com/AEGEE/oms-frontend/commit/51e44cc))
* **deps:** updated outdated packages ([257fae4](https://github.com/AEGEE/oms-frontend/commit/257fae4))



<a name="0.11.1"></a>
## [0.11.1](https://github.com/AEGEE/oms-frontend/compare/0.11.0...0.11.1) (2019-05-01)


### Bug Fixes

* **discounts:** fixed Flixbus link at discounts page ([cf9cde5](https://github.com/AEGEE/oms-frontend/commit/cf9cde5))
* **discounts:** fixed icons styling on discounts page ([44bbf6f](https://github.com/AEGEE/oms-frontend/commit/44bbf6f))



<a name="0.11.0"></a>
# [0.11.0](https://github.com/AEGEE/oms-frontend/compare/0.10.23...0.11.0) (2019-05-01)


### Bug Fixes

* **deps:** updated node-sass to 4.12.0 ([e3a4df3](https://github.com/AEGEE/oms-frontend/commit/e3a4df3))


### Features

* **discounts:** added discounts things. Fixes MEMB-521 ([e171d97](https://github.com/AEGEE/oms-frontend/commit/e171d97))



<a name="0.10.23"></a>
## [0.10.23](https://github.com/AEGEE/oms-frontend/compare/0.10.22...0.10.23) (2019-04-29)


### Bug Fixes

* **statutory:** fixed Number of SPMs visited. Fixes MEMB-524 ([4e1f50d](https://github.com/AEGEE/oms-frontend/commit/4e1f50d))



<a name="0.10.22"></a>
## [0.10.22](https://github.com/AEGEE/oms-frontend/compare/0.10.21...0.10.22) (2019-04-28)


### Bug Fixes

* **general:** fixed broken Confluence link on /about ([82f353f](https://github.com/AEGEE/oms-frontend/commit/82f353f))
* **statutory:** allow SPM for pax limits ([c8a38f6](https://github.com/AEGEE/oms-frontend/commit/c8a38f6))



<a name="0.10.21"></a>
## [0.10.21](https://github.com/AEGEE/oms-frontend/compare/0.10.20...0.10.21) (2019-04-28)


### Bug Fixes

* **statutory:** added SPM as event type ([378b379](https://github.com/AEGEE/oms-frontend/commit/378b379))



<a name="0.10.20"></a>
## [0.10.20](https://github.com/AEGEE/oms-frontend/compare/0.10.19...0.10.20) (2019-04-28)


### Bug Fixes

* **general:** renamed OMS - MyAEGEE, part 2 ([a1f7101](https://github.com/AEGEE/oms-frontend/commit/a1f7101))



<a name="0.10.19"></a>
## [0.10.19](https://github.com/AEGEE/oms-frontend/compare/0.10.18...0.10.19) (2019-04-28)


### Bug Fixes

* **general:** rename: OMS -> MyAEGEE. Fixes MEMB-523 ([e8e1fa7](https://github.com/AEGEE/oms-frontend/commit/e8e1fa7))



<a name="0.10.18"></a>
## [0.10.18](https://github.com/AEGEE/oms-frontend/compare/0.10.17...0.10.18) (2019-04-24)


### Bug Fixes

* **deps:** fixed security vulnerabilities ([ba78c81](https://github.com/AEGEE/oms-frontend/commit/ba78c81))
* **general:** add appreciation logos. Fixes MEMB-429 ([47f70a5](https://github.com/AEGEE/oms-frontend/commit/47f70a5))
* **general:** added internal mailer info to /about page ([9fd472a](https://github.com/AEGEE/oms-frontend/commit/9fd472a))
* **general:** fix mail confirmations ([e0e3818](https://github.com/AEGEE/oms-frontend/commit/e0e3818))
* **test:** fix Travis CI node version ([ba6f367](https://github.com/AEGEE/oms-frontend/commit/ba6f367))


### Features

* **general:** added appreciation to contributors. Fixes MEMB-515 ([169378b](https://github.com/AEGEE/oms-frontend/commit/169378b))



<a name="0.10.17"></a>
## [0.10.17](https://github.com/AEGEE/oms-frontend/compare/0.10.16...0.10.17) (2019-04-16)


### Bug Fixes

* **statutory:** smaller select on candidate status change ([d01bb73](https://github.com/AEGEE/oms-frontend/commit/d01bb73))
* **statutory:** wrapping text on candidate modal. Fixes MEMB-518 ([131509d](https://github.com/AEGEE/oms-frontend/commit/131509d))


### Features

* **statutory:** changing positions status. Fixes MEMB-502 ([84e2e17](https://github.com/AEGEE/oms-frontend/commit/84e2e17))



<a name="0.10.16"></a>
## [0.10.16](https://github.com/AEGEE/oms-frontend/compare/0.10.15...0.10.16) (2019-04-11)


### Bug Fixes

* **statutory:** fixed links displaying for join requests ([d4adddc](https://github.com/AEGEE/oms-frontend/commit/d4adddc))



<a name="0.10.15"></a>
## [0.10.15](https://github.com/AEGEE/oms-frontend/compare/0.10.14...0.10.15) (2019-04-11)


### Bug Fixes

* **core:** display links to join requests profiles. Fixes HELP-429 ([e94d9a0](https://github.com/AEGEE/oms-frontend/commit/e94d9a0))



<a name="0.10.14"></a>
## [0.10.14](https://github.com/AEGEE/oms-frontend/compare/0.10.13...0.10.14) (2019-04-11)


### Bug Fixes

* **statutory:** separate empty table stub to a component. Fixes MEMB-504 ([9943050](https://github.com/AEGEE/oms-frontend/commit/9943050))



<a name="0.10.13"></a>
## [0.10.13](https://github.com/AEGEE/oms-frontend/compare/0.10.12...0.10.13) (2019-04-11)


### Bug Fixes

* **statutory:** fixed body name displaying in candidates listing ([d63771d](https://github.com/AEGEE/oms-frontend/commit/d63771d))



<a name="0.10.12"></a>
## [0.10.12](https://github.com/AEGEE/oms-frontend/compare/0.10.11...0.10.12) (2019-04-10)


### Bug Fixes

* **core:** disable automatically confirming with token. Fixed MEMB-504 ([2a86cab](https://github.com/AEGEE/oms-frontend/commit/2a86cab))



<a name="0.10.11"></a>
## [0.10.11](https://github.com/AEGEE/oms-frontend/compare/0.10.10...0.10.11) (2019-04-10)


### Bug Fixes

* **statutory:** display more fields in candidate modal ([0760faa](https://github.com/AEGEE/oms-frontend/commit/0760faa))
* **statutory:** refactored positions listing tables ([96c4b33](https://github.com/AEGEE/oms-frontend/commit/96c4b33))



<a name="0.10.10"></a>
## [0.10.10](https://github.com/AEGEE/oms-frontend/compare/0.10.9...0.10.10) (2019-04-09)


### Bug Fixes

* **statutory:** added disclaimer for positions listing ([c2f9ea7](https://github.com/AEGEE/oms-frontend/commit/c2f9ea7))
* **statutory:** added timestamps and email for candidates ([19eea2a](https://github.com/AEGEE/oms-frontend/commit/19eea2a))


### Features

* **statutory:** added email for candidates ([837e58c](https://github.com/AEGEE/oms-frontend/commit/837e58c))



<a name="0.10.9"></a>
## [0.10.9](https://github.com/AEGEE/oms-frontend/compare/0.10.8...0.10.9) (2019-04-08)


### Bug Fixes

* **statutory:** allowing late editing candidates ([467064a](https://github.com/AEGEE/oms-frontend/commit/467064a))



<a name="0.10.8"></a>
## [0.10.8](https://github.com/AEGEE/oms-frontend/compare/0.10.7...0.10.8) (2019-04-04)


### Bug Fixes

* **core:** added join_request permissions scope ([9c18adc](https://github.com/AEGEE/oms-frontend/commit/9c18adc))



<a name="0.10.7"></a>
## [0.10.7](https://github.com/AEGEE/oms-frontend/compare/0.10.6...0.10.7) (2019-03-31)


### Bug Fixes

* **statutory:** display basic info of pending candidates ([02c7a4a](https://github.com/AEGEE/oms-frontend/commit/02c7a4a))



<a name="0.10.6"></a>
## [0.10.6](https://github.com/AEGEE/oms-frontend/compare/0.10.5...0.10.6) (2019-03-31)


### Features

* **statutory:** added acceptance info to some pages. Fixes HELP-447 ([b25413e](https://github.com/AEGEE/oms-frontend/commit/b25413e))



<a name="0.10.5"></a>
## [0.10.5](https://github.com/AEGEE/oms-frontend/compare/0.10.4...0.10.5) (2019-03-31)


### Bug Fixes

* **statutory:** proper sorting on participants list. Fixes HELP-430 ([e54e73e](https://github.com/AEGEE/oms-frontend/commit/e54e73e))



<a name="0.10.4"></a>
## [0.10.4](https://github.com/AEGEE/oms-frontend/compare/0.10.3...0.10.4) (2019-03-31)


### Bug Fixes

* **statutory:** fixed memberslists permissions ([af1ddf7](https://github.com/AEGEE/oms-frontend/commit/af1ddf7))



<a name="0.10.3"></a>
## [0.10.3](https://github.com/AEGEE/oms-frontend/compare/0.10.2...0.10.3) (2019-03-31)


### Bug Fixes

* **statutory:** round fee values for memberslist modal ([603dc70](https://github.com/AEGEE/oms-frontend/commit/603dc70))



<a name="0.10.2"></a>
## [0.10.2](https://github.com/AEGEE/oms-frontend/compare/0.10.1...0.10.2) (2019-03-31)


### Bug Fixes

* **statutory:** pre-load bodies before setting on memberslists list page ([0b8666c](https://github.com/AEGEE/oms-frontend/commit/0b8666c))



<a name="0.10.1"></a>
## [0.10.1](https://github.com/AEGEE/oms-frontend/compare/0.9.2...0.10.1) (2019-03-31)


### Bug Fixes

* **statutory:** rounding fee to AEGEE on memberslists listing ([1c041d4](https://github.com/AEGEE/oms-frontend/commit/1c041d4))


### Features

* **statutory:** added fee_paid management and displaying ([60a5188](https://github.com/AEGEE/oms-frontend/commit/60a5188))



<a name="0.9.2"></a>
## [0.9.2](https://github.com/AEGEE/oms-frontend/compare/0.9.1...0.9.2) (2019-03-26)


### Features

* **statutory:** display fee to AEGEE-Europe on ND listing ([a06c46a](https://github.com/AEGEE/oms-frontend/commit/a06c46a))



<a name="0.9.1"></a>
## [0.9.1](https://github.com/AEGEE/oms-frontend/compare/0.9.0...0.9.1) (2019-03-25)


### Bug Fixes

* **statutory:** fix memberslists and boardview permissions ([4fa2ebc](https://github.com/AEGEE/oms-frontend/commit/4fa2ebc))



<a name="0.9.0"></a>
# [0.9.0](https://github.com/AEGEE/oms-frontend/compare/0.8.0...0.9.0) (2019-03-24)


### Bug Fixes

* **general:** fixed security vulnerability ([e45f8ae](https://github.com/AEGEE/oms-frontend/commit/e45f8ae))
* **statutory:** added boardview filtering ([219c3fe](https://github.com/AEGEE/oms-frontend/commit/219c3fe))
* **statutory:** fixed text wrap for application fields. Fixes HELP-353 ([32d430c](https://github.com/AEGEE/oms-frontend/commit/32d430c))


### Features

* **statutory:** added fee paid reporting. Fixes HELP-428 ([23bf526](https://github.com/AEGEE/oms-frontend/commit/23bf526))



<a name="0.8.0"></a>
# [0.8.0](https://github.com/AEGEE/oms-frontend/compare/0.7.13...0.8.0) (2019-03-22)


### Bug Fixes

* **statutory:** add datetimeseconds view and use it on plenary listing ([dfa2beb](https://github.com/AEGEE/oms-frontend/commit/dfa2beb))
* **statutory:** added plenaries management link ([712f417](https://github.com/AEGEE/oms-frontend/commit/712f417))
* **statutory:** display participant type on ND view. Fixed HELP-433 ([706cc04](https://github.com/AEGEE/oms-frontend/commit/706cc04))
* **statutory:** fix participant type displaying on ND view ([82da155](https://github.com/AEGEE/oms-frontend/commit/82da155))


### Features

* **statutory:** add plenary attendance management. Fixed MEMB-456 ([b980642](https://github.com/AEGEE/oms-frontend/commit/b980642))
* **statutory:** export plenary data as XLSX ([2b94f5b](https://github.com/AEGEE/oms-frontend/commit/2b94f5b))
* **statutory:** plenary details and marking attendance view ([a3e19fe](https://github.com/AEGEE/oms-frontend/commit/a3e19fe))



<a name="0.7.13"></a>
## [0.7.13](https://github.com/AEGEE/oms-frontend/compare/0.7.12...0.7.13) (2019-03-19)


### Bug Fixes

* **event:** ignoring errors on auto-completing organizers on adding ([3435b39](https://github.com/AEGEE/oms-frontend/commit/3435b39))



<a name="0.7.12"></a>
## [0.7.12](https://github.com/AEGEE/oms-frontend/compare/0.7.11...0.7.12) (2019-03-13)


### Bug Fixes

* **event:** fix organizers management. Fixes MEMB-191 ([16d80b2](https://github.com/AEGEE/oms-frontend/commit/16d80b2))



<a name="0.7.11"></a>
## [0.7.11](https://github.com/AEGEE/oms-frontend/compare/0.7.10...0.7.11) (2019-03-12)


### Bug Fixes

* **events:** display event description formatted on change events page ([87a7b6d](https://github.com/AEGEE/oms-frontend/commit/87a7b6d))



<a name="0.7.10"></a>
## [0.7.10](https://github.com/AEGEE/oms-frontend/compare/0.7.9...0.7.10) (2019-03-12)


### Bug Fixes

* **events:** fixed deleting event question. Fixes HELP-422 ([21fb9a5](https://github.com/AEGEE/oms-frontend/commit/21fb9a5))



<a name="0.7.9"></a>
## [0.7.9](https://github.com/AEGEE/oms-frontend/compare/0.7.8...0.7.9) (2019-03-11)


### Bug Fixes

* **general:** removed non-lazy loading ([dd43b9d](https://github.com/AEGEE/oms-frontend/commit/dd43b9d))



<a name="0.7.8"></a>
## [0.7.8](https://github.com/AEGEE/oms-frontend/compare/0.7.7...0.7.8) (2019-03-11)


### Bug Fixes

* **statutory:** pre-load all bodies on memberslist page. Fixes MEMB-488 ([020a782](https://github.com/AEGEE/oms-frontend/commit/020a782))



<a name="0.7.7"></a>
## [0.7.7](https://github.com/AEGEE/oms-frontend/compare/0.7.6...0.7.7) (2019-03-11)


### Bug Fixes

* **general:** fixed vulnerabilities ([b596f46](https://github.com/AEGEE/oms-frontend/commit/b596f46))


### Features

* **general:** switched to Webpack 4. Fixes MEMB-346, MEMB-355 ([4b1fb9b](https://github.com/AEGEE/oms-frontend/commit/4b1fb9b))
* **test:** add npm audit check on Travis ([1abfd0b](https://github.com/AEGEE/oms-frontend/commit/1abfd0b))



<a name="0.7.6"></a>
## [0.7.6](https://github.com/AEGEE/oms-frontend/compare/0.7.5...0.7.6) (2019-03-11)


### Bug Fixes

* **events:** fixed events listing. Fixes MEMB-469, MEMB-470 ([411f47d](https://github.com/AEGEE/oms-frontend/commit/411f47d))



<a name="0.7.5"></a>
## [0.7.5](https://github.com/AEGEE/oms-frontend/compare/0.7.4...0.7.5) (2019-03-11)


### Bug Fixes

* **general:** improve CSV upload. Fixes MEMB-486 ([c31ed67](https://github.com/AEGEE/oms-frontend/commit/c31ed67))



<a name="0.7.4"></a>
## [0.7.4](https://github.com/AEGEE/oms-frontend/compare/0.7.3...0.7.4) (2019-03-11)


### Bug Fixes

* **statutory:** grouping genders on stats page ([9b6d03a](https://github.com/AEGEE/oms-frontend/commit/9b6d03a))



<a name="0.7.3"></a>
## [0.7.3](https://github.com/AEGEE/oms-frontend/compare/0.7.2...0.7.3) (2019-03-05)


### Bug Fixes

* **body:** display pending join request button. Fixes MEMB-485 ([59dad37](https://github.com/AEGEE/oms-frontend/commit/59dad37))



<a name="0.7.2"></a>
## [0.7.2](https://github.com/AEGEE/oms-frontend/compare/0.7.1...0.7.2) (2019-03-04)


### Bug Fixes

* **statutory:** fixed filtering on JC listing page ([795337c](https://github.com/AEGEE/oms-frontend/commit/795337c))
* **statutory:** fixed filtering on ND listing page ([f2c6137](https://github.com/AEGEE/oms-frontend/commit/f2c6137))



<a name="0.7.1"></a>
## [0.7.1](https://github.com/AEGEE/oms-frontend/compare/0.7.0...0.7.1) (2019-03-04)


### Bug Fixes

* **statutory:** fixed filtering on applications listings ([be7a53e](https://github.com/AEGEE/oms-frontend/commit/be7a53e))



<a name="0.7.0"></a>
# [0.7.0](https://github.com/AEGEE/oms-frontend/compare/0.6.4...0.7.0) (2019-03-04)


### Features

* **statutory:** added members list status management. Fixes MEMB-481 ([de3957d](https://github.com/AEGEE/oms-frontend/commit/de3957d))



<a name="0.6.4"></a>
## [0.6.4](https://github.com/AEGEE/oms-frontend/compare/0.6.3...0.6.4) (2019-03-02)


### Bug Fixes

* **general:** fix link preview. Fixes MEMB-484 ([b257b44](https://github.com/AEGEE/oms-frontend/commit/b257b44))
* **statutory:** fix stats label displaying for bodies. Fixes HELP-332 ([09a57c4](https://github.com/AEGEE/oms-frontend/commit/09a57c4))



<a name="0.6.3"></a>
## [0.6.3](https://github.com/AEGEE/oms-frontend/compare/0.6.2...0.6.3) (2019-02-24)


### Bug Fixes

* **events:** focus on single event location ([7e7dc32](https://github.com/AEGEE/oms-frontend/commit/7e7dc32))



<a name="0.6.2"></a>
## [0.6.2](https://github.com/AEGEE/oms-frontend/compare/0.6.1...0.6.2) (2019-02-24)


### Bug Fixes

* **events:** fix zoom on single event page. Fixes MEMB-466 ([183e538](https://github.com/AEGEE/oms-frontend/commit/183e538))



<a name="0.6.1"></a>
## [0.6.1](https://github.com/AEGEE/oms-frontend/compare/0.6.0...0.6.1) (2019-02-23)


### Bug Fixes

* **events:** fix changing participants statuses ([b325ff2](https://github.com/AEGEE/oms-frontend/commit/b325ff2))
* **general:** fix members listing type-ahead ([aedcc8e](https://github.com/AEGEE/oms-frontend/commit/aedcc8e))
* **statutory:** display boardviw validation. Fixes HELP-328 ([9814cb9](https://github.com/AEGEE/oms-frontend/commit/9814cb9))



<a name="0.6.0"></a>
# [0.6.0](https://github.com/AEGEE/oms-frontend/compare/0.5.3...0.6.0) (2019-02-23)


### Bug Fixes

* **general:** b-table on bodies listing. Fixes MEMB-397 ([adcde10](https://github.com/AEGEE/oms-frontend/commit/adcde10))
* **general:** b-table on body campaigns listing. Fixes MEMB-397 ([dd4fdd2](https://github.com/AEGEE/oms-frontend/commit/dd4fdd2))
* **general:** b-table on bulk import listing. Fixes MEMB-397 ([4198683](https://github.com/AEGEE/oms-frontend/commit/4198683))
* **general:** b-table on campaigns listing. Fixes MEMB-397 ([db7832a](https://github.com/AEGEE/oms-frontend/commit/db7832a))
* **general:** b-table on circles listing. Fixes MEMB-397 ([82b7b11](https://github.com/AEGEE/oms-frontend/commit/82b7b11))
* **general:** b-table on circles members listing. Fixes MEMB-397 ([01824d2](https://github.com/AEGEE/oms-frontend/commit/01824d2))
* **general:** b-table on event approve listing. Fixes MEMB-397 ([8e838e1](https://github.com/AEGEE/oms-frontend/commit/8e838e1))
* **general:** b-table on event boardview listing. Fixes MEMB-397 ([bb43393](https://github.com/AEGEE/oms-frontend/commit/bb43393))
* **general:** b-table on join requests listing. Fixes MEMB-397 ([dc972a9](https://github.com/AEGEE/oms-frontend/commit/dc972a9))
* **general:** b-table on members listing. Fixes MEMB-397 ([2195e5b](https://github.com/AEGEE/oms-frontend/commit/2195e5b))
* **general:** b-table on permissions listing. Fixes MEMB-397 ([2acbef6](https://github.com/AEGEE/oms-frontend/commit/2acbef6))
* **general:** events pax page refactor. Fixes MEMB-397, MEMB-476 ([31b9ab1](https://github.com/AEGEE/oms-frontend/commit/31b9ab1))
* **general:** fix circle link on circle listing ([3640360](https://github.com/AEGEE/oms-frontend/commit/3640360))
* **statutory:** added participants count. Fixes MEMB-468 ([32ba940](https://github.com/AEGEE/oms-frontend/commit/32ba940))
* **statutory:** refactored members list view. Fixes MEBM-397, MEMB-455 ([97eb5a7](https://github.com/AEGEE/oms-frontend/commit/97eb5a7))



<a name="0.5.3"></a>
## [0.5.3](https://github.com/AEGEE/oms-frontend/compare/0.5.2...0.5.3) (2019-02-21)


### Bug Fixes

* **general:** fixed changing page title on route change. Fixes MEMB-475 ([4f8ccd5](https://github.com/AEGEE/oms-frontend/commit/4f8ccd5))



<a name="0.5.2"></a>
## [0.5.2](https://github.com/AEGEE/oms-frontend/compare/0.5.1...0.5.2) (2019-02-20)


### Bug Fixes

* **general:** fixed loading local permissions for campaign ([70d042e](https://github.com/AEGEE/oms-frontend/commit/70d042e))


### Features

* **statutory:** allow boards to see applications. Fixes MEMB-462 ([c13bce7](https://github.com/AEGEE/oms-frontend/commit/c13bce7))



<a name="0.5.1"></a>
## [0.5.1](https://github.com/AEGEE/oms-frontend/compare/0.5.0...0.5.1) (2019-02-20)


### Bug Fixes

* **general:** refactor campaigns page. Fixes HELP-320. Related: MEMB-397 ([e1efc8a](https://github.com/AEGEE/oms-frontend/commit/e1efc8a))



<a name="0.5.0"></a>
# [0.5.0](https://github.com/AEGEE/oms-frontend/compare/0.4.6...0.5.0) (2019-02-19)


### Bug Fixes

* **events:** fixed selecting body for event application ([34ef678](https://github.com/AEGEE/oms-frontend/commit/34ef678))


### Features

* **events:** add applications export. Fixed MEMB-406 ([1f93691](https://github.com/AEGEE/oms-frontend/commit/1f93691))



<a name="0.4.6"></a>
## [0.4.6](https://github.com/AEGEE/oms-frontend/compare/0.4.5...0.4.6) (2019-02-19)


### Bug Fixes

* **events:** display if there are errors on application. Fixes MEMB-471 ([efe91b7](https://github.com/AEGEE/oms-frontend/commit/efe91b7))



<a name="0.4.5"></a>
## [0.4.5](https://github.com/AEGEE/oms-frontend/compare/0.4.4...0.4.5) (2019-02-19)


### Bug Fixes

* **general:** generate year in footer automatically. Fixes HELP-314 ([e4d9d77](https://github.com/AEGEE/oms-frontend/commit/e4d9d77))



<a name="0.4.4"></a>
## [0.4.4](https://github.com/AEGEE/oms-frontend/compare/0.4.3...0.4.4) (2019-02-18)


### Bug Fixes

* **general:** confirm body deletion ([24c9181](https://github.com/AEGEE/oms-frontend/commit/24c9181))



<a name="0.4.3"></a>
## [0.4.3](https://github.com/AEGEE/oms-frontend/compare/0.4.2...0.4.3) (2019-02-18)


### Bug Fixes

* **general:** fixed Atlassian link. Fixed HELP-306 ([db1e0ba](https://github.com/AEGEE/oms-frontend/commit/db1e0ba))



<a name="0.4.2"></a>
## [0.4.2](https://github.com/AEGEE/oms-frontend/compare/0.4.1...0.4.2) (2019-02-18)


### Bug Fixes

* **general:** trimming input-tag values. Fixes MEMB-436 ([0bc2f15](https://github.com/AEGEE/oms-frontend/commit/0bc2f15))



<a name="0.4.1"></a>
## [0.4.1](https://github.com/AEGEE/oms-frontend/compare/0.4.0...0.4.1) (2019-02-17)


### Features

* **core:** add fee management. Fixes MEMB-462. Related: MEMB-397 ([0511fbb](https://github.com/AEGEE/oms-frontend/commit/0511fbb))



<a name="0.4.0"></a>
# [0.4.0](https://github.com/AEGEE/oms-frontend/compare/0.3.0...0.4.0) (2019-02-15)


### Features

* **core:** add membership fee management ([a9e0688](https://github.com/AEGEE/oms-frontend/commit/a9e0688))



<a name="0.3.0"></a>
# [0.3.0](https://github.com/AEGEE/oms-frontend/compare/v0.2.4...0.3.0) (2019-02-15)


### Bug Fixes

* **bodies:** fixed single bodies page ([60b532a](https://github.com/AEGEE/oms-frontend/commit/60b532a))
* **core:** respect local permissions to suspend users. Fixes HELP-290 ([4cc7466](https://github.com/AEGEE/oms-frontend/commit/4cc7466))
* **statutory:** fix filtering exporting data ([5535eba](https://github.com/AEGEE/oms-frontend/commit/5535eba))
* **statutory:** fixed error typo on boardview ([609decb](https://github.com/AEGEE/oms-frontend/commit/609decb))
* **statutory:** required booleans as answers ([1b7a4f2](https://github.com/AEGEE/oms-frontend/commit/1b7a4f2))


### Features

* **general:** add conventional commits. Fixes MEMB-463 ([a90216e](https://github.com/AEGEE/oms-frontend/commit/a90216e))
* **statutory:** add export fields for statutory ([225883f](https://github.com/AEGEE/oms-frontend/commit/225883f))
* **statutory:** added filtering on export statutory data. ([64c4e14](https://github.com/AEGEE/oms-frontend/commit/64c4e14))



<a name="0.2.4"></a>
## [0.2.4](https://github.com/AEGEE/oms-frontend/compare/v0.1.12...v0.2.4) (2019-02-09)


### Bug Fixes

* **general:** display/hide menu on swipe. Fixes MEMB-426 ([1ba0837](https://github.com/AEGEE/oms-frontend/commit/1ba0837))
* **statutory:** refactor massmailer. Fixes MEMB-389 ([f6e2989](https://github.com/AEGEE/oms-frontend/commit/f6e2989))
* **statutory:** refactor statutory statistics. Fixes MEMB-437 ([c31336d](https://github.com/AEGEE/oms-frontend/commit/c31336d))
* Homepage bulma version info. ([07bcdb5](https://github.com/AEGEE/oms-frontend/commit/07bcdb5))
* l10n for Datepicker ([8ce8761](https://github.com/AEGEE/oms-frontend/commit/8ce8761))


### Features

* **statutory:** add exporting for incoming ([38dbecc](https://github.com/AEGEE/oms-frontend/commit/38dbecc))
* **statutory:** display if user is on memberslist. Fixes MEMB-447 ([a7de10d](https://github.com/AEGEE/oms-frontend/commit/a7de10d))
* **statutory:** select fields for export statutory info. Fixes MEMB-387 ([c74de23](https://github.com/AEGEE/oms-frontend/commit/c74de23))



<a name="0.1.12"></a>
## [0.1.12](https://github.com/AEGEE/oms-frontend/compare/v0.1.11...v0.1.12) (2016-12-26)



<a name="0.1.11"></a>
## [0.1.11](https://github.com/AEGEE/oms-frontend/compare/v0.1.10...v0.1.11) (2016-11-26)



<a name="0.1.10"></a>
## [0.1.10](https://github.com/AEGEE/oms-frontend/compare/v0.1.9...v0.1.10) (2016-11-22)



<a name="0.1.9"></a>
## [0.1.9](https://github.com/AEGEE/oms-frontend/compare/v0.1.8...v0.1.9) (2016-11-07)



<a name="0.1.8"></a>
## [0.1.8](https://github.com/AEGEE/oms-frontend/compare/v0.1.7...v0.1.8) (2016-10-25)



<a name="0.1.7"></a>
## [0.1.7](https://github.com/AEGEE/oms-frontend/compare/v0.1.6...v0.1.7) (2016-10-17)



<a name="0.1.6"></a>
## [0.1.6](https://github.com/AEGEE/oms-frontend/compare/v0.1.5...v0.1.6) (2016-10-17)



<a name="0.1.5"></a>
## [0.1.5](https://github.com/AEGEE/oms-frontend/compare/v0.1.4...v0.1.5) (2016-10-11)



<a name="0.1.4"></a>
## [0.1.4](https://github.com/AEGEE/oms-frontend/compare/v0.1.3...v0.1.4) (2016-10-04)



<a name="0.1.3"></a>
## [0.1.3](https://github.com/AEGEE/oms-frontend/compare/v0.1.2...v0.1.3) (2016-10-04)



<a name="0.1.2"></a>
## [0.1.2](https://github.com/AEGEE/oms-frontend/compare/v0.1.1...v0.1.2) (2016-10-03)



<a name="0.1.1"></a>
## [0.1.1](https://github.com/AEGEE/oms-frontend/compare/v0.1.0...v0.1.1) (2016-10-03)



<a name="0.1.0"></a>
# 0.1.0 (2016-09-26)



