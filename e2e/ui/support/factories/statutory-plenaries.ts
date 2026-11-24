// Factories for the plenaries of an Agora with their attendances, and for the question lines
// of a statutory event with their questions. See base.ts for the rules, and
// statutory-events.ts for how the statutory factories are split.
import { iso } from './base.ts';
import { statutoryApplication, type StatutoryApplication } from './statutory-applications.ts';

const HOUR = 60 * 60 * 1000;

// A plenary of an Agora (models/Plenary.js), as GET /events/:id/plenaries lists it and
// POST/PUT answer it. `duration` is a virtual field: the seconds between start and end.
export interface StatutoryPlenary {
    id: number;
    event_id: number;
    name: string;
    starts: string;
    ends: string;
    duration: number;
    created_at: string;
    updated_at: string;
}

// By default a plenary of four hours, tomorrow. The duration follows from the dates.
export const statutoryPlenary = (overrides: Partial<StatutoryPlenary> = {}): StatutoryPlenary => {
    const starts = overrides.starts ?? iso(1);
    const ends = overrides.ends ?? new Date(Date.parse(starts) + 4 * HOUR).toISOString();
    return {
        id: 2,
        event_id: 1,
        name: 'Plenary 1',
        starts,
        ends,
        duration: (Date.parse(ends) - Date.parse(starts)) / 1000,
        created_at: iso(-5),
        updated_at: iso(-5),
        ...overrides
    };
};

// What statutory tells about the applicant of an attendance (constants.ALLOWED_PLENARY_ATTENDANCE_FIELDS).
const ATTENDEE_FIELDS = ['id', 'statutory_id', 'first_name', 'last_name', 'participant_type', 'participant_order', 'body_id', 'body_name'] as const;
export type PlenaryAttendee = Pick<StatutoryApplication, typeof ATTENDEE_FIELDS[number]>;

const attendee = (overrides: Partial<StatutoryApplication>): PlenaryAttendee => {
    const full = statutoryApplication({ participant_type: 'delegate', participant_order: 1, status: 'accepted', ...overrides });
    return Object.fromEntries(ATTENDEE_FIELDS.map((field) => [field, full[field]])) as PlenaryAttendee;
};

// The time an applicant was in a plenary (models/Attendance.js), with the applicant, as the
// plenary lists it and as POST …/attendance/mark answers it. `ends` is null while the applicant
// is still there. `application` takes overrides of the applicant.
export interface PlenaryAttendance {
    id: number;
    plenary_id: number;
    application_id: number;
    starts: string;
    ends: string | null;
    created_at: string;
    updated_at: string;
    application: PlenaryAttendee;
}

export const plenaryAttendance = (overrides: Omit<Partial<PlenaryAttendance>, 'application'> & { application?: Partial<StatutoryApplication> } = {}): PlenaryAttendance => {
    const { application: applicant, ...rest } = overrides;
    const application = attendee({ id: rest.application_id ?? 12, ...applicant });
    const starts = rest.starts ?? iso(0);
    return {
        id: 30,
        plenary_id: 2,
        application_id: application.id,
        starts,
        ends: null,
        created_at: starts,
        updated_at: rest.ends ?? starts,
        ...rest,
        application
    };
};

// One plenary with who attended it, as GET /events/:id/plenaries/:plenary_id answers it (the
// newest attendance first).
export interface StatutoryPlenaryWithAttendances extends StatutoryPlenary {
    attendances: PlenaryAttendance[];
}

export const statutoryPlenaryWithAttendances = (overrides: Partial<StatutoryPlenaryWithAttendances> = {}): StatutoryPlenaryWithAttendances => {
    const { attendances, ...rest } = overrides;
    const plenary = statutoryPlenary(rest);
    return { ...plenary, attendances: attendances ?? [plenaryAttendance({ plenary_id: plenary.id })] };
};

// What statutory tells about the author of a question (constants.ALLOWED_QUESTION_LINE_APPLICATION_FIELDS).
const AUTHOR_FIELDS = ['id', 'statutory_id', 'user_id', 'first_name', 'last_name', 'participant_type', 'participant_order', 'body_id', 'body_name'] as const;
export type QuestionAuthor = Pick<StatutoryApplication, typeof AUTHOR_FIELDS[number]>;

// A question in a question line (models/Question.js) with its author's application, as the
// list of question lines has it. `application` takes overrides of the author's application; by
// default it is someone else's than the logged-in member's (user 7).
export interface StatutoryQuestionLineQuestion {
    id: number;
    question_line_id: number;
    application_id: number;
    text: string;
    created_at: string;
    updated_at: string;
    application: QuestionAuthor;
}

export const statutoryQuestionLineQuestion = (overrides: Omit<Partial<StatutoryQuestionLineQuestion>, 'application'> & { application?: Partial<StatutoryApplication> } = {}): StatutoryQuestionLineQuestion => {
    const { application: author, ...rest } = overrides;
    const full = statutoryApplication({
        id: rest.application_id ?? 14,
        user_id: 7,
        statutory_id: '001-0003',
        first_name: 'Jan',
        last_name: 'Jansen',
        body_id: 3,
        body_name: 'AEGEE-Utrecht',
        participant_type: 'delegate',
        participant_order: 1,
        status: 'accepted',
        confirmed: true,
        ...author
    });
    const application = Object.fromEntries(AUTHOR_FIELDS.map((field) => [field, full[field]])) as QuestionAuthor;
    return {
        id: 8,
        question_line_id: 4,
        application_id: application.id,
        text: 'A',
        created_at: iso(-1),
        updated_at: iso(-1),
        ...rest,
        application
    };
};

// A question line of a statutory event (models/QuestionLine.js) with its questions, as GET
// /events/:id/question-lines lists it. Creating and editing answer the line without questions.
export interface StatutoryQuestionLine {
    id: number;
    event_id: number;
    name: string;
    status: 'open' | 'closed';
    created_at: string;
    updated_at: string;
    questions: StatutoryQuestionLineQuestion[];
}

export const statutoryQuestionLine = (overrides: Partial<StatutoryQuestionLine> = {}): StatutoryQuestionLine => {
    const lineId = overrides.id ?? 4;
    return {
        id: lineId,
        event_id: 1,
        name: 'CD candidates',
        status: 'open',
        created_at: iso(-2),
        updated_at: iso(-2),
        questions: [statutoryQuestionLineQuestion({ question_line_id: lineId })],
        ...overrides
    };
};
