// Factories for the positions of an Agora (Comité Directeur, Juridical Commission, …) and the
// candidatures for them. See base.ts for the rules, and statutory-events.ts for how the
// statutory factories are split.
import { iso } from './base.ts';
import type { StatutoryImage } from './statutory-events.ts';

// A position members can apply for (models/Position.js), as the service stores it. `can_apply`
// is a virtual field: whether the server's "now" is in the application period.
export interface Position {
    id: number;
    event_id: number;
    name: string;
    body_id: number | null;
    places: number;
    status: 'open' | 'closed';
    starts: string;
    ends: string;
    // A day (the column is a DATEONLY).
    start_term: string;
    // Free text: a day, or something like "Agora Spring 2028".
    end_term: string;
    requirements: string | null;
    deleted: boolean;
    can_apply: boolean;
    created_at: string;
    updated_at: string;
}

export interface PositionOptions {
    // The instant the server computed `can_apply` at; the factories' "now" by default.
    now?: number;
}

// An open position whose application period contains now.
export const position = (overrides: Partial<Position> = {}, { now }: PositionOptions = {}): Position => {
    const at = now ?? Date.parse(iso(0));
    const starts = overrides.starts ?? iso(-30, at);
    const ends = overrides.ends ?? iso(27, at);
    return {
        id: 5,
        event_id: 1,
        name: 'Comité Directeur',
        body_id: 3,
        places: 7,
        status: 'open',
        starts,
        ends,
        start_term: '2027-08-01',
        end_term: '2028-07-31',
        requirements: 'Be a member for **2 years**.',
        deleted: false,
        can_apply: at >= Date.parse(starts) && at <= Date.parse(ends),
        created_at: iso(-31, at),
        updated_at: iso(-31, at),
        ...overrides
    };
};

// A candidature (models/Candidate.js) as GET …/positions/:position_id/candidates/:id answers it,
// with its picture. Jan of AEGEE-Utrecht, pending.
export interface Candidate {
    id: number;
    user_id: number;
    position_id: number;
    body_id: number;
    body_name: string;
    first_name: string;
    last_name: string;
    email: string | null;
    date_of_birth: string;
    member_since: string;
    nationality: string;
    languages: string[];
    studies: string;
    attended_agorae: string;
    attended_epm: string;
    attended_conferences: string;
    european_experience: string;
    local_experience: string;
    external_experience: string;
    related_experience: string;
    motivation: string;
    program: string;
    agreed_to_privacy_policy: boolean;
    status: 'pending' | 'approved' | 'rejected';
    image_id: number | null;
    image: StatutoryImage | null;
    created_at: string;
    updated_at: string;
}

export const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
    id: 11,
    user_id: 7,
    position_id: 5,
    body_id: 3,
    body_name: 'AEGEE-Utrecht',
    first_name: 'Jan',
    last_name: 'Jansen',
    email: null,
    date_of_birth: '1999-05-14',
    member_since: '2019-10-01',
    nationality: 'Dutch',
    languages: ['English', 'Dutch'],
    studies: 'Economics',
    attended_agorae: 'Agora Spring 2025, Agora Autumn 2025',
    attended_epm: 'EPM 2025',
    attended_conferences: 'A Summer University in 2024',
    european_experience: 'Speaker of a working group',
    local_experience: 'President of AEGEE-Utrecht',
    external_experience: 'Student council',
    related_experience: 'Treasurer of my antenna',
    motivation: 'I want to **help** the network.',
    program: 'More training for boards.',
    agreed_to_privacy_policy: true,
    status: 'pending',
    image_id: null,
    image: null,
    created_at: iso(-3),
    updated_at: iso(-3),
    ...overrides
});

// A candidature in GET …/positions/all, the list of the Juridical Commission: the whole of it,
// with the candidate's notification address from core.
export interface ListedCandidate extends Candidate {
    notification_email: string;
}

export const listedCandidate = (overrides: Partial<ListedCandidate> = {}): ListedCandidate => ({
    ...candidate(overrides),
    notification_email: 'jan.jansen@example.org',
    ...overrides
});

// An approved candidature in GET …/positions/approved, the list every member sees: everything
// but the email addresses.
export type ApprovedCandidate = Omit<Candidate, 'email'>;

export const approvedCandidate = (overrides: Partial<ApprovedCandidate> = {}): ApprovedCandidate => {
    const full: Partial<Candidate> = candidate({ status: 'approved', ...overrides });
    delete full.email;
    return full as ApprovedCandidate;
};

// A pending candidature in GET …/positions/approved: only who applied and when
// (constants.js, ALLOWED_PENDING_CANDIDATE_FIELDS). Rejected ones are left out.
export interface PendingCandidateSummary {
    id: number;
    status: 'pending';
    first_name: string;
    last_name: string;
    body_name: string;
    created_at: string;
}

export const pendingCandidateSummary = (overrides: Partial<PendingCandidateSummary> = {}): PendingCandidateSummary => ({
    id: 12,
    status: 'pending',
    first_name: 'Piet',
    last_name: 'Pieters',
    body_name: 'AEGEE-Delft',
    created_at: iso(-2),
    ...overrides
});

// A position in the lists of GET …/positions/all and …/positions/approved, with its
// candidatures (whole ones in `all`, approved ones and pending summaries in `approved`).
export interface PositionWithCandidates extends Position {
    candidates: (ListedCandidate | ApprovedCandidate | PendingCandidateSummary)[];
}

export const positionWithCandidates = (overrides: Partial<PositionWithCandidates> = {}, options: PositionOptions = {}): PositionWithCandidates => {
    const { candidates, ...rest } = overrides;
    return { ...position(rest, options), candidates: candidates ?? [] };
};

// One of the logged-in member's own candidatures, as GET …/positions/candidates/mine lists them:
// the candidature with its position and picture. Only the candidatures for the positions of the
// event in the URL (statutory #2405). Alex Member's (user 2) for position 5.
export interface MyCandidature extends Candidate {
    position: Position;
}

export const myCandidature = (overrides: Partial<MyCandidature> = {}): MyCandidature => {
    const { position: ownPosition, ...rest } = overrides;
    const own = candidate({
        id: 21,
        user_id: 2,
        body_id: 1,
        body_name: 'AEGEE-Antenna',
        first_name: 'Alex',
        last_name: 'Member',
        ...rest
    });
    return { ...own, position: ownPosition ?? position({ id: own.position_id }) };
};

// What GET …/fields/candidates answers: the columns of the candidates export, by key
// (constants.js, CANDIDATE_FIELDS; the EPMs key is `attended_epm` since statutory #2405).
export const candidateFields = (): Record<string, string> => ({
    id: 'ID',
    user_id: 'User ID',
    body_id: 'Body ID',
    created_at: 'Applied on',
    updated_at: 'Updated at',
    first_name: 'First name',
    last_name: 'Last name',
    notification_email: 'Email',
    date_of_birth: 'Date of birth',
    nationality: 'Nationality',
    'position.name': 'Position',
    body_name: 'Body name',
    languages: 'Languages',
    studies: 'Studies',
    member_since: 'Member since',
    european_experience: 'European experience',
    local_experience: 'Local experience',
    attended_agorae: 'Number of Agorae visited',
    attended_epm: 'Number of EPMs visited',
    attended_conferences: 'Attended European Events',
    external_experience: 'External experience',
    motivation: 'Motivation',
    program: 'Program',
    related_experience: 'Related experience',
    agreed_to_privacy_policy: 'Agreed to privacy policy?',
    status: 'Status'
});
