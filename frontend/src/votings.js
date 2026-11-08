// What the voting screens show, computed from the votings API of the statutory service
// (statutory/lib/votings.js). The service and its database decide everything;
// these functions only put their numbers into words for the delegate and the JC.

export const KIND_NAMES = {
  proposal: 'Proposal',
  rollcall: 'Roll call'
}

export const MAJORITY_NAMES = {
  simple: 'Simple majority',
  absolute: 'Absolute majority',
  two_thirds: 'Two-thirds majority'
}

export const CHOICES = [
  { field: 'in_favour', label: 'In favour' },
  { field: 'against', label: 'Against' },
  { field: 'abstention', label: 'Abstention' }
]

export const plural = (amount, word) => `${amount} ${word}${amount === 1 ? '' : 's'}`

export const totalVotes = (counts) => counts.in_favour + counts.against + counts.abstention

// The status of a voting as a tag: it opens and closes by itself on time,
// and after closing the JC publishes the result.
export function statusTag (voting) {
  if (voting.status === 'scheduled') return { label: 'Scheduled', type: 'is-info' }
  if (voting.status === 'open') return { label: 'Open', type: 'is-success' }
  if (voting.published) return { label: 'Published', type: 'is-primary' }
  return { label: 'Closed', type: 'is-dark' }
}

// The result as a tag, only when the API gives it (to the JC after closing, to others after publishing).
export function resultTag (voting) {
  if (voting.result === 'accepted') return { label: 'Accepted', type: 'is-success is-light' }
  if (voting.result === 'rejected') return { label: 'Rejected', type: 'is-danger is-light' }
  return null
}

// The rule of a majority and the calculation behind the result,
// as statutory/lib/voting_rules.js counts it (isAccepted).
export function explainMajority (majority, tally) {
  const { in_favour: inFavour, against, abstention } = tally

  switch (majority) {
  case 'simple':
    return {
      rule: 'In favour must be more than against.',
      calculation: `${inFavour} in favour, ${against} against`
    }
  case 'absolute':
    return {
      rule: 'In favour must be more than against and abstention together.',
      calculation: `${inFavour} in favour, ${against + abstention} against and abstention`
    }
  case 'two_thirds':
    return {
      rule: 'In favour must be more than twice against and abstention together.',
      calculation: `${inFavour} in favour, needed more than 2 × ${against + abstention} = ${2 * (against + abstention)}`
    }
  default:
    return { rule: '', calculation: '' }
  }
}

// How many votes the delegate can cast now, and why. The statutory service divides the votes
// of a body over its delegates as equally as possible: every delegate surely has the minimum,
// and the votes left over ("extra votes") go to the first delegates who use them, one each.
// Voting is not required; who votes uses 1 vote or more, up to votes_available.
// myVote is the answer of GET /events/:id/votings/:voting_id/my-vote.
export function describeAllowance (myVote, bodyName) {
  const { votes_total: votesTotal, delegates_count: delegatesCount, votes_cast: votesCast } = myVote.body
  const available = myVote.votes_available
  const minVotes = Math.floor(votesTotal / delegatesCount)
  const extraVotes = votesTotal % delegatesCount
  const extraFree = extraVotes > 0 && available > minVotes
  const bodyLeft = votesTotal - votesCast

  let range = `You can cast 1 to ${available} votes`
  if (available === 1) range = 'You can cast 1 vote'
  if (available === 2) range = 'You can cast 1 or 2 votes'

  const explanation = []
  if (delegatesCount === 1) {
    explanation.push(`${bodyName} has ${plural(votesTotal, 'vote')} and you are its only delegate, so you have all of them.`)
  } else {
    explanation.push(`${bodyName} has ${plural(votesTotal, 'vote')} and ${delegatesCount} delegates. Every delegate has ${plural(minVotes, 'vote')}.`)

    if (extraVotes === 1) {
      explanation.push('The 1 extra vote goes to the first delegate who uses it.')
    } else if (extraVotes > 1) {
      explanation.push(`The ${extraVotes} extra votes go to the first ${extraVotes} delegates who use them, one each.`)
    }

    if (extraVotes > 0) {
      explanation.push(extraFree
        ? `${extraVotes === 1 ? 'The 1 extra vote' : 'An extra vote'} of your body is still free.`
        : 'The extra votes of your body are used by other delegates.')
    }
  }

  if (bodyLeft < minVotes) {
    explanation.push(`Other delegates of your body used ${plural(votesCast, 'vote')}, so ${plural(bodyLeft, 'vote')} ${bodyLeft === 1 ? 'is' : 'are'} left.`)
  }

  return {
    available,
    range,
    guaranteedDots: Math.min(minVotes, available),
    extraFree,
    explanation
  }
}

// Why the delegate can not vote at all, or null when the delegate can still vote.
// A body without votes in the Agora still has delegates, but they get 0 votes.
export function noVotesLeftNotice (myVote, bodyName) {
  if (myVote.votes_available > 0) return null

  if (myVote.body.votes_total === 0) {
    return {
      title: 'Your body has no votes in this Agora',
      line: `${bodyName} has no votes in this Agora, so you can not vote in this voting.`
    }
  }
  return {
    title: 'Your body has no votes left',
    line: `Other delegates of ${bodyName} used all ${plural(myVote.body.votes_total, 'vote')} of your body.`
  }
}

// A short note under the form when the delegate uses fewer votes than possible.
export function unusedVotesNote (used, allowance, bodyName) {
  if (used === 0 || used >= allowance.available) return null

  if (allowance.extraFree && used <= allowance.guaranteedDots) {
    return `You use ${used} of ${allowance.available} possible votes. The extra vote stays free for the other delegates of ${bodyName}.`
  }
  return `You use ${used} of ${allowance.available} possible votes. The votes you do not use are not cast.`
}

const sameCounts = (a, b) => CHOICES.every(({ field }) => a[field] === b[field])

// When the service refuses a vote (HTTP 409), the screen reads the own vote again and explains
// from those fresh numbers what happened and what the delegate can do now.
// sent: the counts the delegate sent; myVote: the fresh answer of GET my-vote.
// Returns { kind, title, lines, kept }: kept are the counts to show again, or null to choose again.
export function explainRefusal (sent, myVote, bodyName) {
  if (myVote.submitted_at) {
    // A retry after a lost answer: the first try did arrive, with the same counts.
    if (sameCounts(sent, myVote)) {
      return { kind: 'recorded', title: '', lines: [], kept: null }
    }
    return {
      kind: 'already_voted',
      title: 'You already voted',
      lines: ['Only the first vote counts. Nothing changed.'],
      kept: null
    }
  }

  if (myVote.voting.status !== 'open') {
    return {
      kind: 'closed',
      title: 'This voting is closed',
      lines: ['Your vote was not counted.'],
      kept: null
    }
  }

  const { votes_total: votesTotal, votes_cast: votesCast } = myVote.body
  const bodyLeft = votesTotal - votesCast
  const available = myVote.votes_available

  if (available === 0) {
    return {
      kind: 'body_vote_limit',
      title: 'Not saved: your body has no votes left',
      lines: [`Other delegates of ${bodyName} used all ${plural(votesTotal, 'vote')}. You can not vote in this voting.`],
      kept: null
    }
  }

  const usedChoices = CHOICES.filter(({ field }) => sent[field] > 0)
  let kept = null
  if (usedChoices.length === 1) {
    kept = { in_favour: 0, against: 0, abstention: 0 }
    kept[usedChoices[0].field] = available
  }
  const next = kept
    ? `Your choice is kept, now with ${plural(available, 'vote')}. Check it and confirm again.`
    : `Choose again with ${available === 1 ? '1 vote' : `up to ${available} votes`} and confirm.`

  if (bodyLeft < totalVotes(sent)) {
    return {
      kind: 'body_vote_limit',
      title: `Not saved: your body has ${plural(bodyLeft, 'vote')} left`,
      lines: [
        `Other delegates of ${bodyName} voted just before you. Together they used ${votesCast} of the ${plural(votesTotal, 'vote')}.`,
        next
      ],
      kept
    }
  }

  return {
    kind: 'extra_vote_limit',
    title: 'Not saved: the extra vote is taken',
    lines: [
      `Another delegate of ${bodyName} just used the extra vote of your body. You can cast ${plural(available, 'vote')}.`,
      next
    ],
    kept
  }
}

// The state of one body in the progress of the JC: everyone voted (or no votes are left),
// some delegates voted, or nobody voted yet.
export function bodyProgressStatus (body) {
  if (body.delegates_voted === body.delegates_count || body.votes_cast >= body.votes_total) {
    return { key: 'complete', label: 'Complete', type: 'is-success is-light' }
  }
  if (body.delegates_voted > 0) {
    return { key: 'partly', label: 'Partly', type: 'is-warning is-light' }
  }
  return { key: 'none', label: 'Not voted', type: '' }
}

// The votings on the page of the delegate. A scheduled voting is only for the JC to prepare;
// the delegate sees a voting from the moment it opens.
export const delegateVotings = (votings) => votings.filter((voting) => voting.status !== 'scheduled')

// The first open voting in which the delegate did not vote yet, or null.
export function openVotingWithoutVote (votings, votedIds) {
  return votings.find((voting) => voting.status === 'open' && !votedIds.includes(voting.id)) || null
}

// What one answer of GET my-vote says about a voting for the delegate: 'done' when the delegate
// voted there or has no votes in it (403), 'open' when the delegate can still vote, and 'unknown'
// when there is no answer (no connection or another error), so the page asks again later.
export function myVoteState (myVote, errorStatus) {
  if (myVote) return myVote.submitted_at ? 'done' : 'open'
  if (errorStatus === 403) return 'done'
  return 'unknown'
}

// The voting to show when the delegate did not choose one: the first open voting
// in which the delegate did not vote yet, else the first open one, else the last closed one.
export function pickVoting (votings, votedIds) {
  const notVoted = openVotingWithoutVote(votings, votedIds)
  if (notVoted) return notVoted.id
  const open = votings.find((voting) => voting.status === 'open')
  if (open) return open.id
  return votings.length > 0 ? votings[votings.length - 1].id : null
}

// The voting the page moves to by itself, or null to stay. The page stays while the delegate
// holds a vote on the screen (checking it, sending it, or reading why it was not counted),
// and on an open voting in which the delegate did not vote yet.
export function autoSwitchTarget (votings, votedIds, current, holding) {
  if (holding) return null

  const pick = pickVoting(votings, votedIds)
  if (pick === null || (current && pick === current.id)) return null
  if (current && current.status === 'open' && !votedIds.includes(current.id)) return null
  return pick
}

// Whether a voting that just closed took a vote of the delegate with it: the delegate was checking
// a vote or had chosen votes, and has no recorded vote. Only then the page says "Your vote was not counted".
export function closedWithUnsentVote (myVote, phase, used) {
  if (myVote && myVote.submitted_at) return false
  return phase !== 'form' || used > 0
}
