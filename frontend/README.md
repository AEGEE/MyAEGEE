# OMS Frontend

[![Maintainability](https://api.codeclimate.com/v1/badges/fab731e5b48ec139320b/maintainability)](https://codeclimate.com/github/AEGEE/oms-frontend/maintainability)

This repository contains the united frontend for MyAEGEE (aka "the new frontend for AEGEE", aka https://my.aegee.ae), written in Vue.

## Technologies used

- Node.js >= 5
- NPM >= 3
- Webpack
- [Bulma](https://bulma.io/)
- [Buefy](https://buefy.github.io/#/)
- [Vue.js JS framework](https://vuejs.org/)

## Development

The official way to run this project is to get the copy of [oms-docker project](github.com/AEGEE/oms-docker), which contains all of the repositories, including this one. See `oms-docker`'s README for the instructions for installation.

## Local development

To save time/access debug, do the following on your local machine:

- `npm install`
- `npm run serve`

This will run a process which builds the frontend once the files are saved. The server would be accessible at `htt://localhost:8081`, but that doesn't matter, as the `dist` folder is mounted to a container in a dev mode, so all the changes would be reflected at `http://localhost`.

Additionally, you can do the following:

- `npm i -g @vue/cli`
- `vue ui`

That'll open the Vue CLI UI at `http://localhost:8000` which you can use to manage your project, run tasks, analyze webpack bundle size etc.

## Maintainers

This project is a fork and rewrite of the [vue-admin project](https://github.com/vue-bulma/vue-admin). It's licensed under MIT license (see LICENSE file)

## Contributors

This project is maintained and developed by Sergey Peshkov (https://github.com/serge1peshcoff).

Also this project wouldn't be done without the vue-admin authors, which are [Fangdun Cai](https://twitter.com/_fundon) and [other contributors](https://github.com/vue-bulma/vue-admin/graphs/contributors)
