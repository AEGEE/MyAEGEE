import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  autoSwitchTarget,
  closedWithUnsentVote,
  bodyProgressStatus,
  delegateVotings,
  describeAllowance,
  explainMajority,
  explainRefusal,
  noVotesLeftNotice,
  myVoteState,
  openVotingWithoutVote,
  pickVoting,
  resultTag,
  statusTag,
  unusedVotesNote
} from '../src/votings.js'

// The answer of GET /events/:id/votings/:voting_id/my-vote, for a body with 4 votes and 3 delegates.
const myVote = (overrides = {}) => ({
  voting: { id: 5, status: 'open', ...overrides.voting },
  body: { body_id: 7, votes_total: 4, delegates_count: 3, votes_cast: 0, ...overrides.body },
  max_votes: 2,
  votes_available: 2,
  in_favour: 0,
  against: 0,
  abstention: 0,
  submitted_at: null,
  ...overrides.own
})

describe('describeAllowance', () => {
  it('explains the extra vote of a body that is still free', () => {
    const allowance = describeAllowance(myVote(), 'AEGEE-Enschede')

    assert.equal(allowance.range, 'You can cast 1 or 2 votes')
    assert.equal(allowance.guaranteedDots, 1)
    assert.equal(allowance.extraFree, true)
    assert.deepEqual(allowance.explanation, [
      'AEGEE-Enschede has 4 votes and 3 delegates. Every delegate has 1 vote.',
      'The 1 extra vote goes to the first delegate who uses it.',
      'The 1 extra vote of your body is still free.'
    ])
  })

  it('says when another delegate used the extra vote', () => {
    const allowance = describeAllowance(myVote({ body: { votes_cast: 2 }, own: { votes_available: 1 } }), 'AEGEE-Enschede')

    assert.equal(allowance.range, 'You can cast 1 vote')
    assert.equal(allowance.extraFree, false)
    assert.equal(allowance.explanation[2], 'The extra votes of your body are used by other delegates.')
  })

  it('gives a range from 1 for more than 2 votes', () => {
    const allowance = describeAllowance(myVote({ body: { votes_total: 7, delegates_count: 2 }, own: { votes_available: 4 } }), 'AEGEE-Delft')

    assert.equal(allowance.range, 'You can cast 1 to 4 votes')
    assert.equal(allowance.guaranteedDots, 3)
    assert.equal(allowance.extraFree, true)
  })

  it('explains a body with one delegate', () => {
    const allowance = describeAllowance(myVote({ body: { votes_total: 3, delegates_count: 1 }, own: { votes_available: 3 } }), 'AEGEE-Leiden')

    assert.deepEqual(allowance.explanation, ['AEGEE-Leiden has 3 votes and you are its only delegate, so you have all of them.'])
    assert.equal(allowance.extraFree, false)
  })
})

describe('unusedVotesNote', () => {
  const allowance = describeAllowance(myVote(), 'AEGEE-Enschede')

  it('says that an unused extra vote stays free', () => {
    assert.equal(
      unusedVotesNote(1, allowance, 'AEGEE-Enschede'),
      'You use 1 of 2 possible votes. The extra vote stays free for the other delegates of AEGEE-Enschede.'
    )
  })

  it('says nothing when all votes or no votes are used', () => {
    assert.equal(unusedVotesNote(2, allowance, 'AEGEE-Enschede'), null)
    assert.equal(unusedVotesNote(0, allowance, 'AEGEE-Enschede'), null)
  })
})

describe('explainRefusal', () => {
  const sent = { in_favour: 2, against: 0, abstention: 0 }

  it('treats a retry of a vote that did arrive as recorded', () => {
    const outcome = explainRefusal(sent, myVote({ own: { in_favour: 2, submitted_at: '2026-10-29T12:31:02Z' } }), 'AEGEE-Enschede')

    assert.equal(outcome.kind, 'recorded')
  })

  it('tells that a vote from another device counts', () => {
    const outcome = explainRefusal(sent, myVote({ own: { against: 1, submitted_at: '2026-10-29T12:31:02Z' } }), 'AEGEE-Enschede')

    assert.equal(outcome.kind, 'already_voted')
    assert.equal(outcome.title, 'You already voted')
  })

  it('tells that the voting closed', () => {
    const outcome = explainRefusal(sent, myVote({ voting: { status: 'closed' } }), 'AEGEE-Enschede')

    assert.equal(outcome.kind, 'closed')
  })

  it('keeps a single choice with fewer votes when the body has fewer left', () => {
    const outcome = explainRefusal(sent, myVote({ body: { votes_cast: 3 }, own: { votes_available: 1 } }), 'AEGEE-Enschede')

    assert.equal(outcome.kind, 'body_vote_limit')
    assert.equal(outcome.title, 'Not saved: your body has 1 vote left')
    assert.deepEqual(outcome.lines, [
      'Other delegates of AEGEE-Enschede voted just before you. Together they used 3 of the 4 votes.',
      'Your choice is kept, now with 1 vote. Check it and confirm again.'
    ])
    assert.deepEqual(outcome.kept, { in_favour: 1, against: 0, abstention: 0 })
  })

  it('tells that the extra vote is taken, and asks to choose again after a split', () => {
    const split = { in_favour: 1, against: 1, abstention: 0 }
    const outcome = explainRefusal(split, myVote({ body: { votes_cast: 2 }, own: { votes_available: 1 } }), 'AEGEE-Enschede')

    assert.equal(outcome.kind, 'extra_vote_limit')
    assert.equal(outcome.title, 'Not saved: the extra vote is taken')
    assert.equal(outcome.lines[1], 'Choose again with 1 vote and confirm.')
    assert.equal(outcome.kept, null)
  })

  it('tells when the body has no votes left at all', () => {
    const outcome = explainRefusal(sent, myVote({ body: { votes_cast: 4 }, own: { votes_available: 0 } }), 'AEGEE-Enschede')

    assert.equal(outcome.title, 'Not saved: your body has no votes left')
    assert.equal(outcome.kept, null)
  })
})

describe('explainMajority', () => {
  const tally = { in_favour: 183, against: 40, abstention: 25 }

  it('explains each majority as the statutory service counts it', () => {
    assert.equal(explainMajority('simple', tally).calculation, '183 in favour, 40 against')
    assert.equal(explainMajority('absolute', tally).calculation, '183 in favour, 65 against and abstention')
    assert.equal(explainMajority('two_thirds', tally).calculation, '183 in favour, needed more than 2 × 65 = 130')
  })
})

describe('tags', () => {
  it('shows the four statuses of a voting', () => {
    assert.equal(statusTag({ status: 'scheduled' }).label, 'Scheduled')
    assert.equal(statusTag({ status: 'open' }).label, 'Open')
    assert.equal(statusTag({ status: 'closed', published: false }).label, 'Closed')
    assert.equal(statusTag({ status: 'closed', published: true }).label, 'Published')
  })

  it('shows the result only when the API gives it', () => {
    assert.equal(resultTag({ result: null }), null)
    assert.equal(resultTag({ result: 'accepted' }).label, 'Accepted')
  })

  it('shows the progress of a body', () => {
    assert.equal(bodyProgressStatus({ delegates_voted: 2, delegates_count: 2, votes_cast: 3, votes_total: 4 }).key, 'complete')
    assert.equal(bodyProgressStatus({ delegates_voted: 1, delegates_count: 3, votes_cast: 4, votes_total: 4 }).key, 'complete')
    assert.equal(bodyProgressStatus({ delegates_voted: 1, delegates_count: 3, votes_cast: 2, votes_total: 4 }).key, 'partly')
    assert.equal(bodyProgressStatus({ delegates_voted: 0, delegates_count: 3, votes_cast: 0, votes_total: 4 }).key, 'none')
  })
})

describe('noVotesLeftNotice', () => {
  it('says nothing while the delegate can vote', () => {
    assert.equal(noVotesLeftNotice(myVote(), 'AEGEE-Enschede'), null)
  })

  it('says that the other delegates used all votes of the body', () => {
    const notice = noVotesLeftNotice(myVote({ body: { votes_cast: 4 }, own: { votes_available: 0 } }), 'AEGEE-Enschede')
    assert.equal(notice.title, 'Your body has no votes left')
    assert.equal(notice.line, 'Other delegates of AEGEE-Enschede used all 4 votes of your body.')
  })

  it('says that a body without votes in the Agora has none, not that they are used', () => {
    const notice = noVotesLeftNotice(myVote({ body: { votes_total: 0 }, own: { votes_available: 0, max_votes: 0 } }), 'AEGEE-Enschede')
    assert.equal(notice.title, 'Your body has no votes in this Agora')
    assert.equal(notice.line, 'AEGEE-Enschede has no votes in this Agora, so you can not vote in this voting.')
  })
})

describe('choosing the voting of the delegate', () => {
  const closed = { id: 1, status: 'closed' }
  const openA = { id: 2, status: 'open' }
  const openB = { id: 3, status: 'open' }
  const scheduled = { id: 4, status: 'scheduled' }

  it('never shows a scheduled voting to the delegate, also not to a JC member', () => {
    assert.deepEqual(delegateVotings([closed, openA, scheduled]), [closed, openA])
    assert.equal(pickVoting(delegateVotings([closed, scheduled]), []), 1)
  })

  it('picks the first open voting without a vote, else the first open one, else the last one', () => {
    assert.equal(pickVoting([closed, openA, openB], [2]), 3)
    assert.equal(pickVoting([closed, openA, openB], [2, 3]), 2)
    assert.equal(pickVoting([closed], []), 1)
    assert.equal(pickVoting([], []), null)
  })

  it('moves on from a closed voting to the next open one', () => {
    assert.equal(autoSwitchTarget([{ ...openA, status: 'closed' }, openB], [], { ...openA, status: 'closed' }, false), 3)
  })

  it('stays when the delegate holds a vote on a voting that just closed', () => {
    assert.equal(autoSwitchTarget([{ ...openA, status: 'closed' }, openB], [], { ...openA, status: 'closed' }, true), null)
  })

  it('stays on an open voting without a vote, and moves on after the vote', () => {
    assert.equal(autoSwitchTarget([openA, openB], [], openA, false), null)
    assert.equal(autoSwitchTarget([openA, openB], [2], openA, false), 3)
  })

  it('points to the open voting in which the delegate did not vote yet', () => {
    const closedA = { ...openA, status: 'closed' }
    assert.equal(openVotingWithoutVote([closedA, openB], []), openB)
    assert.equal(openVotingWithoutVote([closedA, openB], [3]), null)
    assert.equal(openVotingWithoutVote([closedA, scheduled], []), null)
  })

  it('shows a voting when none is shown yet', () => {
    assert.equal(autoSwitchTarget([openA], [], null, false), 2)
    assert.equal(autoSwitchTarget([], [], null, false), null)
  })
})

describe('myVoteState', () => {
  it('is done when the delegate voted, or has no votes in the voting', () => {
    assert.equal(myVoteState({ submitted_at: '2026-10-29T14:02:00Z' }, null), 'done')
    assert.equal(myVoteState(null, 403), 'done')
  })

  it('is open when the delegate can still vote', () => {
    assert.equal(myVoteState({ submitted_at: null }, null), 'open')
  })

  it('is unknown without an answer, so the page asks again later', () => {
    assert.equal(myVoteState(null, null), 'unknown')
    assert.equal(myVoteState(null, 500), 'unknown')
    assert.equal(myVoteState(null, 404), 'unknown')
  })
})

describe('closedWithUnsentVote', () => {
  it('says a vote was lost when the delegate was checking it or had chosen votes', () => {
    assert.equal(closedWithUnsentVote(myVote(), 'confirm', 2), true)
    assert.equal(closedWithUnsentVote(myVote(), 'form', 1), true)
  })

  it('says nothing when the delegate had chosen nothing', () => {
    assert.equal(closedWithUnsentVote(myVote(), 'form', 0), false)
    assert.equal(closedWithUnsentVote(null, 'form', 0), false)
  })

  it('says nothing when the delegate voted before the voting closed', () => {
    const voted = myVote({ own: { in_favour: 2, submitted_at: '2026-10-29T13:59:00Z' } })
    assert.equal(closedWithUnsentVote(voted, 'form', 2), false)
  })
})
