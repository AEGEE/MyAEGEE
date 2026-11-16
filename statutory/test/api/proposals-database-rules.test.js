const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { sequelize } = require('../../lib/sequelize');

// The rules of a proposal live in the database itself (triggers proposal_guard and guard_proposal_voting,
// CHECK constraints and foreign keys), so they also hold for writes that do not go through the API.
// These tests write to the tables directly and expect the database to refuse what breaks a rule.
// All people, bodies and texts are made up.
describe('Proposals database rules', () => {
    const PROPOSER = 101;
    const JC = 900;

    let agora;
    let otherAgora;

    beforeEach(async () => {
        agora = await generator.createEvent({ type: 'agora', applications: [] });
        otherAgora = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        cron.clearAll();
        await generator.clearAll();
    });

    const query = async (sql, bind = [], options = {}) => {
        const [rows] = await sequelize.query(sql, { bind, ...options });
        return rows;
    };

    const refusalOf = async (promise) => {
        try {
            await promise;
        } catch (err) {
            return err.parent ? err.parent.constraint : err.message;
        }
        throw new Error('The database accepted the write.');
    };

    // The proposer submits a proposal; by default on other parts of the CIA, so a simple majority.
    const submit = async (eventId = agora.id, { title = 'Longer draft period', ciaPart = 'other' } = {}) => {
        const [row] = await query(
            `INSERT INTO proposals (event_id, title, proposers, cia_part, text_url, created_by)
            VALUES ($1, $2, 'A. Example on behalf of AEGEE-Atlantis', $3, 'https://example.org/proposal-text', $4) RETURNING id`,
            [eventId, title, ciaPart, PROPOSER]
        );
        return row.id;
    };
    const setStatus = (id, status, reason = null) => query('UPDATE proposals SET status = $2, jc_reason = $3 WHERE id = $1', [id, status, reason]);
    const putOnAgenda = (id) => setStatus(id, 'on_agenda');
    const withdraw = (id) => setStatus(id, 'withdrawn');
    const onAgenda = async (eventId = agora.id, options = {}) => {
        const id = await submit(eventId, options);
        await putOnAgenda(id);
        return id;
    };
    const proposalRow = async (id) => (await query('SELECT * FROM proposals WHERE id = $1', [id]))[0];

    const newVoting = async (eventId, {
        proposalId = null,
        kind = 'proposal',
        majority = 'simple',
        phase = 'agora',
        statutes = false,
        follows = null
    } = {}) => {
        const [row] = await query(
            `INSERT INTO votings (event_id, kind, title, majority, opens_at, closes_at, phase, concerns_statutes,
                proposal_id, follows_voting_id, created_at, updated_at)
            VALUES ($1, $2, 'A voting', $3, now() + interval '1 hour', now() + interval '2 hours', $4, $5, $6, $7, now(), now()) RETURNING id`,
            [eventId, kind, majority, phase, statutes, proposalId, follows]
        );
        return row.id;
    };
    const openVoting = (id) => query("UPDATE votings SET status = 'open', opened_at = now() WHERE id = $1", [id]);
    const closeVoting = (id, result) => query("UPDATE votings SET status = 'closed', closed_at = now(), result = $2 WHERE id = $1", [id, result]);
    const publishVoting = (id) => query('UPDATE votings SET published = true, published_at = now(), published_by = $2 WHERE id = $1', [id, JC]);
    const decide = (proposalId, decision, votingId) => query(
        'UPDATE proposals SET decision = $2, decided_by_voting_id = $3 WHERE id = $1',
        [proposalId, decision, votingId]
    );

    // An Agora voting on the proposal that opened, closed with this result and was published.
    const votedOn = async (proposalId, result, eventId = agora.id) => {
        const votingId = await newVoting(eventId, { proposalId });
        await openVoting(votingId);
        await closeVoting(votingId, result);
        await publishVoting(votingId);
        return votingId;
    };

    // A Pre-Agora voting opens with its quorum base and closes published, with this outcome.
    const closePreAgora = async (id, outcome, reason = null) => {
        await query("UPDATE votings SET status = 'open', opened_at = now(), antennae_total = 100, quorum_required = 50 WHERE id = $1", [id]);
        await query(`UPDATE votings SET status = 'closed', closed_at = now(), result = 'accepted', antennae_voted = 70, quorum_reached = true,
            outcome = $2, outcome_reason = $3, published = true, published_at = now() WHERE id = $1`, [id, outcome, reason]);
    };

    describe('a proposal', () => {
        test('starts as submitted, without a decision (proposal_starts_submitted)', async () => {
            const insert = (fields) => query(`INSERT INTO proposals (event_id, title, proposers, cia_part, text_url, created_by, status, decision)
                VALUES ($1, 'A title', 'A. Example', 'other', 'https://example.org/x', $2, $3, $4)`, [agora.id, PROPOSER, fields.status, fields.decision]);

            expect(await refusalOf(insert({ status: 'on_agenda', decision: null }))).toEqual('proposal_starts_submitted');
            expect(await refusalOf(insert({ status: 'submitted', decision: 'accepted' }))).toEqual('proposal_starts_submitted');

            const id = await submit();
            expect(await proposalRow(id)).toMatchObject({ status: 'submitted', decision: null, created_by: PROPOSER });
        });

        test('changes while it is submitted', async () => {
            const id = await submit();
            await query(`UPDATE proposals SET title = 'Longer period for drafts', proposers = 'A. Example and B. Example',
                cia_part = 'working_format', text_url = 'https://example.org/new-text' WHERE id = $1`, [id]);

            expect(await proposalRow(id)).toMatchObject({ title: 'Longer period for drafts', cia_part: 'working_format' });
        });

        test.each([
            ['title', "title = 'Other title'"],
            ['proposers', "proposers = 'C. Example'"],
            ['part of the CIA', "cia_part = 'statutes'"],
            ['link to the text', "text_url = 'https://example.org/other'"]
        ])('keeps its %s once it is not submitted any more (proposal_text_is_fixed)', async (field, change) => {
            const onTheAgenda = await onAgenda();
            const notAdmitted = await submit();
            await setStatus(notAdmitted, 'not_admitted', 'Not a change of the CIA.');
            const withdrawn = await submit();
            await withdraw(withdrawn);

            for (const id of [onTheAgenda, notAdmitted, withdrawn]) {
                expect(await refusalOf(query(`UPDATE proposals SET ${change} WHERE id = $1`, [id]))).toEqual('proposal_text_is_fixed');
            }
        });

        test('keeps its Agora and the account of its proposer (proposal_identity_is_fixed)', async () => {
            const id = await submit();
            expect(await refusalOf(query('UPDATE proposals SET event_id = $2 WHERE id = $1', [id, otherAgora.id]))).toEqual('proposal_identity_is_fixed');
            expect(await refusalOf(query('UPDATE proposals SET created_by = 7 WHERE id = $1', [id]))).toEqual('proposal_identity_is_fixed');
        });

        test('has a link to its text, not the text itself (text_url_is_link)', async () => {
            const id = await submit();
            expect(await refusalOf(query("UPDATE proposals SET text_url = 'page 4 of my document' WHERE id = $1", [id]))).toEqual('text_url_is_link');
            await query("UPDATE proposals SET text_url = 'http://example.org/text' WHERE id = $1", [id]);
        });

        test('has a title, proposers and one of three parts of the CIA', async () => {
            const id = await submit();
            expect(await refusalOf(query("UPDATE proposals SET title = '' WHERE id = $1", [id]))).toEqual('proposals_title_check');
            expect(await refusalOf(query("UPDATE proposals SET proposers = '' WHERE id = $1", [id]))).toEqual('proposals_proposers_check');
            expect(await refusalOf(query("UPDATE proposals SET cia_part = 'regulations' WHERE id = $1", [id]))).toEqual('proposals_cia_part_check');
        });

        test.each([
            ['submitted', 'on_agenda'],
            ['submitted', 'not_admitted'],
            ['submitted', 'withdrawn'],
            ['on_agenda', 'withdrawn']
        ])('goes from %s to %s', async (from, to) => {
            const id = await submit();
            if (from !== 'submitted') await setStatus(id, from);
            await setStatus(id, to, to === 'not_admitted' ? 'Not a change of the CIA.' : null);
            expect((await proposalRow(id)).status).toEqual(to);
        });

        test.each([
            ['on_agenda', 'submitted'],
            ['on_agenda', 'not_admitted'],
            ['not_admitted', 'on_agenda'],
            ['not_admitted', 'withdrawn'],
            ['withdrawn', 'submitted'],
            ['withdrawn', 'on_agenda']
        ])('does not go from %s to %s (proposal_status_flow)', async (from, to) => {
            const id = await submit();
            await setStatus(id, from, from === 'not_admitted' ? 'Not a change of the CIA.' : null);
            expect(await refusalOf(setStatus(id, to, 'A reason.'))).toEqual('proposal_status_flow');
        });

        test('is not admitted only with a reason of the JC (not_admitted_needs_reason)', async () => {
            const id = await submit();
            expect(await refusalOf(setStatus(id, 'not_admitted'))).toEqual('not_admitted_needs_reason');
            expect(await refusalOf(setStatus(id, 'not_admitted', ''))).toEqual('not_admitted_needs_reason');
            await setStatus(id, 'not_admitted', 'Not a change of the CIA.');
            expect(await proposalRow(id)).toMatchObject({ status: 'not_admitted', jc_reason: 'Not a change of the CIA.' });
        });
    });

    describe('a voting on a proposal', () => {
        // proposal_id is optional for now: a proposal voting with a title only, with any majority, works as
        // before, and the rules of a proposal apply only to a voting that points to one.
        test('without a proposal still works as before: with any majority it opens, closes and is published', async () => {
            const votingId = await newVoting(agora.id, { majority: 'absolute' });
            await query("UPDATE votings SET title = 'Proposal with a title only, edited' WHERE id = $1", [votingId]);
            await openVoting(votingId);
            await closeVoting(votingId, 'accepted');
            await publishVoting(votingId);
            expect((await query('SELECT status, published, proposal_id FROM votings WHERE id = $1', [votingId]))[0])
                .toEqual({ status: 'closed', published: true, proposal_id: null });

            const rollcall = await newVoting(agora.id, { kind: 'rollcall', majority: 'absolute' });
            await query("UPDATE votings SET kind = 'proposal' WHERE id = $1", [rollcall]);
        });

        test('is about a proposal of the same Agora (voting_of_proposal_of_same_agora)', async () => {
            const elsewhere = await onAgenda(otherAgora.id);
            expect(await refusalOf(newVoting(agora.id, { proposalId: elsewhere }))).toEqual('voting_of_proposal_of_same_agora');
        });

        test('is the only kind of voting that points to a proposal (proposal_only_for_proposals)', async () => {
            const id = await onAgenda();
            expect(await refusalOf(newVoting(agora.id, { kind: 'rollcall', proposalId: id }))).toEqual('proposal_only_for_proposals');
        });

        test.each([
            ['submitted', null],
            ['not_admitted', 'Not a change of the CIA.'],
            ['withdrawn', null]
        ])('is not about a proposal that is %s (proposal_not_on_agenda)', async (status, reason) => {
            const id = await submit();
            await setStatus(id, status, reason);
            expect(await refusalOf(newVoting(agora.id, { proposalId: id }))).toEqual('proposal_not_on_agenda');
        });

        test('does not open when its proposal was withdrawn after it was planned (proposal_not_on_agenda)', async () => {
            const id = await onAgenda();
            const votingId = await newVoting(agora.id, { proposalId: id });
            await withdraw(id);

            expect(await refusalOf(openVoting(votingId))).toEqual('proposal_not_on_agenda');
            expect((await query('SELECT status FROM votings WHERE id = $1', [votingId]))[0].status).toEqual('scheduled');
        });

        test.each([
            ['working_format', 'agora', 'absolute'],
            ['working_format', 'agora', 'two_thirds'],
            ['other', 'agora', 'absolute'],
            ['statutes', 'agora', 'simple'],
            ['statutes', 'agora', 'absolute']
        ])('on %s in phase %s does not count with an %s majority (majority_matches_proposal)', async (ciaPart, phase, majority) => {
            const id = await onAgenda(agora.id, { ciaPart });
            expect(await refusalOf(newVoting(agora.id, { proposalId: id, majority, phase }))).toEqual('majority_matches_proposal');
        });

        test('takes the majority of its proposal: simple, or 2/3 for the Statutes and before the Agora', async () => {
            const other = await onAgenda(agora.id, { ciaPart: 'other' });
            const workingFormat = await onAgenda(agora.id, { ciaPart: 'working_format' });
            const statutes = await onAgenda(agora.id, { ciaPart: 'statutes' });

            await newVoting(agora.id, { proposalId: other, majority: 'simple' });
            await newVoting(agora.id, { proposalId: workingFormat, majority: 'simple' });
            await newVoting(agora.id, { proposalId: statutes, majority: 'two_thirds' });
            await newVoting(agora.id, { proposalId: other, majority: 'two_thirds', phase: 'pre_agora' });
            await newVoting(agora.id, { proposalId: statutes, majority: 'two_thirds', phase: 'pre_agora', statutes: true });
        });

        test('before the Agora concerns the Statutes exactly when its proposal does (statutes_flag_matches_proposal)', async () => {
            const statutes = await onAgenda(agora.id, { ciaPart: 'statutes' });
            const other = await onAgenda(agora.id, { ciaPart: 'other' });

            expect(await refusalOf(newVoting(agora.id, { proposalId: statutes, majority: 'two_thirds', phase: 'pre_agora' })))
                .toEqual('statutes_flag_matches_proposal');
            expect(await refusalOf(newVoting(agora.id, { proposalId: other, majority: 'two_thirds', phase: 'pre_agora', statutes: true })))
                .toEqual('statutes_flag_matches_proposal');
        });

        test('can move to another proposal while scheduled, not once it opened (voting_subject_is_fixed)', async () => {
            const first = await onAgenda();
            const second = await onAgenda(agora.id, { title: 'Second proposal' });
            const votingId = await newVoting(agora.id, { proposalId: first });

            await query('UPDATE votings SET proposal_id = $2 WHERE id = $1', [votingId, second]);
            await openVoting(votingId);
            expect(await refusalOf(query('UPDATE votings SET proposal_id = $2 WHERE id = $1', [votingId, first]))).toEqual('voting_subject_is_fixed');
        });

        test('is not about a proposal that the Agora already decided (proposal_already_decided)', async () => {
            const id = await onAgenda();
            const decidedBy = await votedOn(id, 'accepted');
            await decide(id, 'accepted', decidedBy);

            expect(await refusalOf(newVoting(agora.id, { proposalId: id }))).toEqual('proposal_already_decided');
        });
    });

    describe('withdrawing a proposal', () => {
        test('works while its voting is only planned', async () => {
            const id = await onAgenda();
            await newVoting(agora.id, { proposalId: id });
            await withdraw(id);
            expect((await proposalRow(id)).status).toEqual('withdrawn');
        });

        test('is refused while a voting on it is open, in both phases (proposal_in_voting)', async () => {
            const id = await onAgenda();
            const votingId = await newVoting(agora.id, { proposalId: id });
            await openVoting(votingId);
            expect(await refusalOf(withdraw(id))).toEqual('proposal_in_voting');

            const before = await onAgenda(agora.id, { title: 'Pre-Agora proposal' });
            const preAgora = await newVoting(agora.id, { proposalId: before, majority: 'two_thirds', phase: 'pre_agora' });
            await query("UPDATE votings SET status = 'open', opened_at = now(), antennae_total = 100, quorum_required = 50 WHERE id = $1", [preAgora]);
            expect(await refusalOf(withdraw(before))).toEqual('proposal_in_voting');
        });

        test('is refused once the Agora voted on it, also before the result is published (proposal_in_voting)', async () => {
            const id = await onAgenda();
            const votingId = await newVoting(agora.id, { proposalId: id });
            await openVoting(votingId);
            await closeVoting(votingId, 'rejected');
            expect(await refusalOf(withdraw(id))).toEqual('proposal_in_voting');
        });

        test('works when Pre-Agora Voting sent the proposal to the Agora', async () => {
            const id = await onAgenda();
            const preAgora = await newVoting(agora.id, { proposalId: id, majority: 'two_thirds', phase: 'pre_agora' });
            await closePreAgora(preAgora, 'to_agora', 'amendment');
            await withdraw(id);
            expect((await proposalRow(id)).status).toEqual('withdrawn');
        });

        test('is refused once the proposal is decided (decision_when_on_agenda)', async () => {
            const id = await onAgenda();
            const preAgora = await newVoting(agora.id, { proposalId: id, majority: 'two_thirds', phase: 'pre_agora' });
            await closePreAgora(preAgora, 'decided');
            await decide(id, 'accepted', preAgora);

            expect(await refusalOf(withdraw(id))).toEqual('decision_when_on_agenda');
        });
    });

    describe('the decision on a proposal', () => {
        test('comes with the voting that decided it and its time (decision_has_voting)', async () => {
            const id = await onAgenda();
            expect(await refusalOf(query("UPDATE proposals SET decision = 'accepted' WHERE id = $1", [id]))).toEqual('decision_has_voting');
            expect(await refusalOf(query('UPDATE proposals SET decided_at = now() WHERE id = $1', [id]))).toEqual('decision_has_voting');
        });

        test('is the published result of the Agora voting on it, with the time set by the database', async () => {
            const id = await onAgenda();
            const votingId = await newVoting(agora.id, { proposalId: id });
            await openVoting(votingId);
            await closeVoting(votingId, 'rejected');

            expect(await refusalOf(decide(id, 'rejected', votingId))).toEqual('decision_matches_voting');
            await publishVoting(votingId);
            expect(await refusalOf(decide(id, 'accepted', votingId))).toEqual('decision_matches_voting');
            await decide(id, 'rejected', votingId);

            const row = await proposalRow(id);
            expect(row).toMatchObject({ status: 'on_agenda', decision: 'rejected', decided_by_voting_id: votingId });
            expect(row.decided_at).not.toEqual(null);
        });

        test('comes from a voting on this proposal (decided_by_voting_of_proposal)', async () => {
            const id = await onAgenda();
            const other = await onAgenda(agora.id, { title: 'Other proposal' });
            const otherVoting = await votedOn(other, 'accepted');

            expect(await refusalOf(decide(id, 'accepted', otherVoting))).toEqual('decided_by_voting_of_proposal');
        });

        test('from Pre-Agora Voting is "accepted", and only when the item is decided there (decision_matches_voting)', async () => {
            const sent = await onAgenda(agora.id, { ciaPart: 'statutes' });
            const sentVoting = await newVoting(agora.id, { proposalId: sent, majority: 'two_thirds', phase: 'pre_agora', statutes: true });
            await closePreAgora(sentVoting, 'to_agora', 'statutes');
            expect(await refusalOf(decide(sent, 'accepted', sentVoting))).toEqual('decision_matches_voting');

            const decided = await onAgenda(agora.id, { title: 'Decided before the Agora' });
            const decidedVoting = await newVoting(agora.id, { proposalId: decided, majority: 'two_thirds', phase: 'pre_agora' });
            await closePreAgora(decidedVoting, 'decided');
            expect(await refusalOf(decide(decided, 'rejected', decidedVoting))).toEqual('decision_matches_voting');
            await decide(decided, 'accepted', decidedVoting);
            expect(await refusalOf(newVoting(agora.id, { proposalId: decided }))).toEqual('proposal_already_decided');
        });

        test('of the Agora cannot change or go away (decision_is_final)', async () => {
            const id = await onAgenda();
            const votingId = await votedOn(id, 'accepted');
            await decide(id, 'accepted', votingId);

            expect(await refusalOf(query("UPDATE proposals SET decision = 'rejected' WHERE id = $1", [id]))).toEqual('decision_is_final');
            expect(await refusalOf(query('UPDATE proposals SET decision = NULL, decided_by_voting_id = NULL, decided_at = NULL WHERE id = $1', [id])))
                .toEqual('decision_is_final');
        });

        test('stays a copy of its voting: the voting cannot change under it (decision_matches_voting, at commit)', async () => {
            const id = await onAgenda();
            const votingId = await votedOn(id, 'accepted');
            await decide(id, 'accepted', votingId);

            expect(await refusalOf(query("UPDATE votings SET result = 'rejected' WHERE id = $1", [votingId]))).toEqual('decision_matches_voting');
            expect(await refusalOf(query('UPDATE votings SET published = false WHERE id = $1', [votingId]))).toEqual('decision_matches_voting');
        });

        // An amendment submitted at least five days before the Agora sends an item that Pre-Agora Voting
        // decided to the Agora after all (WF Agora Art. 20(5)). The JC marks it on the voting; in the same
        // transaction the decision goes away. That is the only way a decision goes away.
        test('from Pre-Agora Voting goes away when an amendment sends the item to the Agora', async () => {
            const id = await onAgenda();
            const preAgora = await newVoting(agora.id, { proposalId: id, majority: 'two_thirds', phase: 'pre_agora' });
            await closePreAgora(preAgora, 'decided');
            await decide(id, 'accepted', preAgora);

            const clear = (transaction) => query('UPDATE proposals SET decision = NULL, decided_by_voting_id = NULL WHERE id = $1', [id], { transaction });
            const markAmendment = (transaction) => query(`UPDATE votings SET amendment_submitted = true, outcome = 'to_agora', outcome_reason = 'amendment'
                WHERE id = $1`, [preAgora], { transaction });

            // Not while the voting still decides the item, and the voting not without the decision going away.
            expect(await refusalOf(sequelize.transaction(clear))).toEqual('decision_is_final');
            // The check at commit runs earlier with SET CONSTRAINTS, so the refusal comes before the commit.
            expect(await refusalOf(sequelize.transaction(async (transaction) => {
                await markAmendment(transaction);
                await query('SET CONSTRAINTS ALL IMMEDIATE', [], { transaction });
            }))).toEqual('decision_matches_voting');

            await sequelize.transaction(async (transaction) => {
                await markAmendment(transaction);
                await clear(transaction);
            });
            expect(await proposalRow(id)).toMatchObject({ decision: null, decided_by_voting_id: null, decided_at: null, status: 'on_agenda' });
        });
    });

    test('goes with its Agora: deleting an Agora deletes its proposals and their votings, also decided ones', async () => {
        const id = await onAgenda();
        const votingId = await votedOn(id, 'accepted');
        await decide(id, 'accepted', votingId);
        const submitted = await submit();
        await newVoting(agora.id, { proposalId: await onAgenda(agora.id, { title: 'Planned' }) });

        await query('DELETE FROM events WHERE id = $1', [agora.id]);
        const [left] = await query(`SELECT (SELECT count(*) FROM proposals WHERE event_id = $1)::int AS proposals,
            (SELECT count(*) FROM votings WHERE event_id = $1)::int AS votings`, [agora.id]);
        expect(left).toEqual({ proposals: 0, votings: 0 });
        expect(await proposalRow(submitted)).toEqual(undefined);
    });

    // Two connections do two things at the same moment. Each keeps its transaction open for a while
    // before committing, so without a lock both checks would miss the other write.
    describe('two things at the same moment', () => {
        const ROUNDS = 20;
        const GAP_MS = 40;
        const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

        const attempt = async (delay, act) => {
            await sleep(delay);
            try {
                await sequelize.transaction(async (transaction) => {
                    await act(transaction);
                    await sleep(GAP_MS);
                });
                return 'stored';
            } catch (err) {
                if (!err.parent || !err.parent.constraint) throw err;
                return 'refused:' + err.parent.constraint;
            }
        };

        // The opening takes a share lock on the proposal, and the withdrawal updates it, so one waits
        // for the other and sees what it did. Never both: a withdrawn proposal with an open voting.
        test('the proposer withdraws while the Agora voting opens: never both', async () => {
            const counts = {};
            for (let round = 0; round < ROUNDS; round++) {
                const id = await onAgenda(agora.id, { title: 'Race ' + round });
                const votingId = await newVoting(agora.id, { proposalId: id });
                const flip = round % 2;

                const results = await Promise.all([
                    attempt(flip ? 0 : 3, (transaction) => query("UPDATE proposals SET status = 'withdrawn' WHERE id = $1", [id], { transaction })),
                    attempt(flip ? 3 : 0, (transaction) => query("UPDATE votings SET status = 'open', opened_at = now() WHERE id = $1", [votingId], { transaction }))
                ]);
                for (const result of results) counts[result] = (counts[result] || 0) + 1;

                const [state] = await query(`SELECT (SELECT status FROM proposals WHERE id = $1) AS proposal,
                    (SELECT status FROM votings WHERE id = $2) AS voting`, [id, votingId]);
                expect(state.proposal === 'withdrawn' && state.voting === 'open').toEqual(false);
            }

            // Every round, exactly one of the two went through.
            expect(counts.stored).toEqual(ROUNDS);
            expect((counts['refused:proposal_in_voting'] || 0) + (counts['refused:proposal_not_on_agenda'] || 0)).toEqual(ROUNDS);
        });
    });
});
