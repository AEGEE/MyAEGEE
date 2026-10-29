# Statutory module
![CircleCI](https://img.shields.io/circleci/build/github/AEGEE/statutory)
![Codecov branch for stable](https://img.shields.io/codecov/c/github/AEGEE/statutory.svg)


## General

The statutory module of MyAEGEE is responsible for managing statutory events, their applications, votings, proposals and motions.

## Votings

A voting is one question that the Agora votes on: a proposal or a rollcall.
The JC (permission `global:manage_juridical:agora`) creates a voting as a draft, opens it and closes it.

- Opening takes a snapshot: one row per body in `voting_body_allotments` with the votes of the body (copied from `votes_per_antenna`), and one row per present delegate (confirmed, registered, not departed, not cancelled) in `voting_delegate_votes`.
An open voting keeps its snapshot; changes to members lists or delegates count from the next voting.
- A delegate votes once with `PUT /events/:event_id/votings/:voting_id/my-vote` and the amounts `in_favour`, `against` and `abstention`.
This route asks core only for `GET /members/me`, once per request.
- Closing counts the votes and stores the result with the majority of the voting (`simple`, `absolute` or `two_thirds`).
While a voting is open, only the JC sees `GET .../progress`, which shows who voted per body and delegate, and the total votes, the votes cast and their percentage, but not in favour, against or abstention.
After closing, every logged-in user sees `GET .../result` with the count in favour, against and abstention, the majority and the result.
- A delegate can use from 1 vote up to the maximum of the delegate; using all votes is not required.

The database enforces the division rule, not only the application.
The votes of a body are divided as equally as possible over its delegates: every delegate has the minimum (votes divided by delegates, rounded down), and the extra votes that are left go to the first delegates who use them, one each.
The trigger `count_delegate_votes` keeps the counters of the body up to date under a lock per body, and three CHECK constraints refuse every vote that breaks the rule:

- `body_vote_limit`: all delegates of a body together never cast more votes than the body has.
- `delegate_vote_limit`: no delegate casts more than the minimum plus one.
- `extra_vote_limit`: no more delegates go above the minimum than there are extra votes.

The trigger also refuses a second vote (`already_voted`), a vote on a voting that is not open (`voting_not_open`) and a vote of a delegate who departed or was cancelled after the voting opened (`delegate_not_present`).
A second trigger, `guard_body_vote_counters`, refuses every other write to the counters of the body (`counters_are_derived`), so a direct UPDATE cannot reset them to make room for more votes.
`test/api/votings-concurrency.test.js` sends the votes of one body at the same moment and checks that the rule always holds.

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
