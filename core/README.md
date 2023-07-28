# core

![CircleCI](https://img.shields.io/circleci/build/github/AEGEE/core)
![Codecov branch for stable](https://img.shields.io/codecov/c/github/AEGEE/core.svg)

Another implementation of oms-core, the main part of MyAEGEE, this time in JS.



## Technologies used

- Node.js + JS
- PostgreSQL as a DB
- Express as a webserver
- Sequelize as an ORM

## Folders structure
- `config/` - application config
- `models/` - ORM models
- `migrations/` - DB migrations
- `middlewares/` - endpoint middlewares (basically functions used to process a request)
- `test/` - everything test-related
- `docker/` - everything related to running and building the Docker image and using this image as a pat of MyAEGEE
- `lib/` - pretty much the rest.
- `lib/server.js` - the list of endpoints and the actual server startup
- `lib/cron.js` - background tasks and a wrapper to run them
- `lib/permission-manager.js` - a class which is used to calculate permissions-related things

## How do I...

- **...run tests?**  
- Just run `npm test` in the local folder. Do not forget to have a working Node.js installation and run `npm install` before running tests. Also you need to have Postgres DB working on localhost (either use Docker image and expose it, or on Mac use Postgres.app)
- **...debug a test that is not working?**
- You can enable logging and run only a single file using a command like this: `NODE_ENV=test npm run db:setup && ENABLE_LOGGING=1 npx jest <file-name.test.js> --runInBand --forceExit --no-cache`. The `ENABLE_LOGGING` variable displays all the app logs (disabled by default to not spam).
- **...check if my code style is compliant?**
- Use ESLint by running `npm run lint`. You can automatically fix some errors by running `npm run lint:fix`.
- **...check if my deps are vulnerable?**
- Run `npm audit`.
- **...have a CLI for playing with models/objects?**
- Run `npm run cli`. You probably want to do it inside a container, with oms-docker you can do it this way: `./helper.sh --execute core bash`, then run `npm run cli` there.
- **...contribute to this repo?**
- Contributions are always welcome! Just contact somebody from maintainers, we'll help you figuring things out.

## Test users

All users have `5ecr3t5ecr3t` as password.

- `admin@example.com` - admin
- `board@example.com` - board member of antenna
- `member@example.com` - regular member of antenna
- `not-confirmed@example.com` - member who is not confirmed
- `password-reset@example.com` - member who requested a password reset
- `suspended@example.com` - a suspended member

You can use `5ecr3t` for a password reset token (for a member with email `password-reset@example.com`) and `5ecr3t` for a mail confirmation (for a member with email `not-confirmed@example.com`).

Easy way to recreate user session as admin: run this in the DevTools console with localhost opened:

```js
// replace 'admin@example.com' with other email for other account
// replace '5ecr3t5ecr3t' with password if you want another password
// replace 'http://localhost' with other URL if you want to try it on other domain

fetch(`http://localhost/api/core/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'admin@example.com', password: '5ecr3t5ecr3t' }),
    headers: { 'Content-Type': 'application/json' }
})
.then(res => res.json())
.then(res => {
    window.localStorage.setItem('access-token', res.access_token)
    window.localStorage.setItem('refresh-token', res.refresh_token)
    window.location = `http://localhost/dashboard`
})
```

Easy way to recreate all data in the system:
```sh
./helper.sh --execute -- core npm run db:clear # or db:setup to drop the db schema and create it again
./helper.sh --execute -- core npm run db:seed
```

## LICENSE

Copyright 2020 Sergey Peshkov (AEGEE-Europe) and contributors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

<http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
