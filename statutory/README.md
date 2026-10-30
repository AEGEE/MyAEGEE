# Statutory module
![CircleCI](https://img.shields.io/circleci/build/github/AEGEE/statutory)
![Codecov branch for stable](https://img.shields.io/codecov/c/github/AEGEE/statutory.svg)


## General

The statutory module of MyAEGEE is responsible for managing statutory events, their applications, votings, proposals and motions.

## Votings

A voting is one question that the Agora votes on: a proposal or a rollcall.
The JC (permission `global:manage_juridical:agora`) creates a voting with a fixed time window, `opens_at` and `closes_at`.
There is no manual opening or closing: the voting is `scheduled` until `opens_at`, `open` until `closes_at`, and then `closed`.
A job per voting (`lib/cron.js`) moves it on time, and every request that reads a voting moves it too, so a missed job or a restart breaks nothing (`lib/voting_lifecycle.js`).
This section describes a voting on the Agora; [Pre-Agora Voting](#pre-agora-voting) gives what is different for a voting before the Agora.

- At `opens_at` the voting takes a snapshot: one row per body in `voting_body_allotments` with the votes of the body (copied from `votes_per_antenna`), and one row per present delegate (confirmed, registered, not departed, not cancelled) in `voting_delegate_votes`.
An open voting keeps its snapshot; changes to members lists or delegates count from the next voting.
- A delegate votes once with `PUT /events/:event_id/votings/:voting_id/my-vote` and the amounts `in_favour`, `against` and `abstention`.
A delegate can use from 1 vote up to the maximum of the delegate; using all votes, or voting at all, is not required.
This route asks core only for `GET /members/me`, once per request.
`GET .../my-vote` shows the own vote, and for the own body the votes, the delegates and the votes cast so far.
- At `closes_at` the voting counts the votes and stores the result with the majority of the voting (`simple`, `absolute` or `two_thirds`).
- While a voting is open, only the JC sees `GET .../progress`: who voted per body and delegate, the total votes, the votes cast and their percentage, but not in favour, against or abstention.
- After closing, the JC sees `GET .../result`: the totals with percentages and the votes of each body that voted.
When the JC publishes the result (`PUT .../publish`), every logged-in user sees it, as in the old OMS JC module.

The database enforces the division rule, not only the application.
The votes of a body are divided as equally as possible over its delegates: every delegate has the minimum (votes divided by delegates, rounded down), and the extra votes that are left go to the first delegates who use them, one each.
The trigger `count_delegate_votes` keeps the counters of the body up to date under a lock per body, and three CHECK constraints refuse every vote that breaks the rule:

- `body_vote_limit`: all delegates of a body together never cast more votes than the body has.
- `delegate_vote_limit`: no delegate casts more than the minimum plus one.
- `extra_vote_limit`: no more delegates go above the minimum than there are extra votes.

The trigger also refuses a second vote (`already_voted`), a vote on a voting that is not open or after `closes_at` (`voting_not_open`) and a vote of a delegate who departed or was cancelled after the voting opened (`delegate_not_present`).
A second trigger, `guard_body_vote_counters`, refuses every other write to the counters of the body (`counters_are_derived`), so a direct UPDATE cannot reset them to make room for more votes.
`test/api/votings-concurrency.test.js` sends the votes of one body at the same moment and checks that the rule always holds, for both phases.

### Pre-Agora Voting

A voting has a `phase`: `agora` (the default, on the Agora itself) or `pre_agora` (online before the Agora, Working Format of the Agora, Art. 20).
The phase decides four things, plus the limits of the time window below; everything else (opening and closing on time, snapshot, division rule, count) is the same.

- **Electorate**: a Pre-Agora voting takes the delegates of the coming Agora (delegate, accepted, confirmed, not cancelled), not only the delegates who are checked in.
Nobody is checked in before the Agora, so `registered` and `departed` do not count.
The trigger checks the same on every vote and refuses a delegate whose application changed after the opening (`delegate_withdrawn`).
- **Majority**: always `two_thirds`; the API sets it when the JC gives none, and the constraint `pre_agora_majority` refuses any other.
- **Quorum**: at opening, the voting asks core (with the service login of `config.core.user`) for the number of active Antennae and stores `antennae_total` and `quorum_required` (half, rounded up).
At closing it stores `antennae_voted` (Antennae that cast at least one vote) and `quorum_reached`.
If core cannot be reached at opening, the voting stays scheduled and the next request or server start opens it.
Until then, `GET .../:voting_id` for that voting gives an error, and the list of votings shows it as scheduled.
- **Publishing and outcome**: at closing, the result is published at once (`published_by` is null), and `outcome` says what it means for the Agora.
`decided`: accepted with quorum, binding.
`to_agora`: the Agora votes again, with `outcome_reason` `no_quorum`, `rejected`, `statutes` (the JC set `concerns_statutes`) or `amendment` (the JC marked with `PUT .../amendment` that an amendment came in at least five days before the Agora).
When more reasons apply, the first one in that order counts.

A Pre-Agora voting must open at the earliest 14 days and close at the latest 9 days before `events.starts`.
A voting on the Agora can set `follows_voting_id` to a closed Pre-Agora voting of the same Agora with outcome `to_agora`; the client gets the result and outcome of that voting with `GET .../:follows_voting_id`.
`GET /events/:event_id/votings?phase=pre_agora` lists only the Pre-Agora votings, with their result, quorum and outcome: the overview of the round.
CHECK constraints on `votings` keep these fields consistent (for example `pre_agora_closed`: a closed Pre-Agora voting is published and has its quorum and outcome).

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
