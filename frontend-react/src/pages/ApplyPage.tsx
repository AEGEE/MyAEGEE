// /events/:id/applications/:application_id (views/events/Apply.vue in the Vue app): the
// application form built from the event's questions, or the application read-only once the
// application period is over.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Loading } from '../components/Loading';
import { api, ApiError, errorMessage, SERVICES } from '../lib/api';
import { beautify, formatDateTime } from '../lib/format';
import { AppLink } from '../lib/links';
import { href } from '../lib/routes';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import type { Application, Body, Event, Question } from '../lib/types';
import { eventKey } from '../lib/types';
import { fetchEvent } from './EventPage';

const PRIVACY_TEXT = 'I agree with my personal data to be processed by AEGEE-Europe for the purposes of the participant selection and event organisation. AEGEE-Europe will disclose this data to organising local for the time period of the event organisation.';

// The primary body first, then the others by name (frontend/src/methods/sort-bodies.js).
const sortBodies = (bodies: Body[], primaryId: number | null): Body[] => [...bodies].sort((a, b) => {
    if (primaryId != null) {
        if (a.id === primaryId) return -1;
        if (b.id === primaryId) return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
});

const defaultAnswer = (question: Question): unknown => {
    switch (question.type) {
    case 'number': return 0;
    case 'checkbox': return false;
    case 'select': return question.values?.[0] ?? '';
    default: return '';
    }
};

const fetchApplication = async (eventId: string, applicationId: string): Promise<Application | null> => {
    try {
        return (await api.get<Application>(`${SERVICES.events}/single/${encodeURIComponent(eventId)}/applications/${encodeURIComponent(applicationId)}`)).data;
    } catch (error) {
        // No application yet.
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
    }
};

function Answer({ question, index, value, onChange }: { question: Question; index: number; value: unknown; onChange: (value: unknown) => void }) {
    const id = `question-${index}`;
    const label = (
        <label className="label" htmlFor={id}>
            {question.description} {question.required ? <span className="required" aria-hidden="true">*</span> : null}
        </label>
    );
    switch (question.type) {
    case 'text':
        return <div className="field">{label}<textarea id={id} className="textarea" required={question.required} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></div>;
    case 'number':
        return <div className="field">{label}<input id={id} className="input" type="number" value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} /></div>;
    case 'checkbox':
        return (
            <div className="field">
                <label className="checkbox-label" htmlFor={id}>
                    <input id={id} type="checkbox" required={question.required} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
                    {question.description} {question.required ? <span className="required" aria-hidden="true">*</span> : null}
                </label>
            </div>
        );
    case 'select':
        return (
            <div className="field">
                {label}
                <select id={id} className="select" required value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                    {(question.values ?? []).map((option) => <option key={option}>{option}</option>)}
                </select>
            </div>
        );
    default:
        return <div className="field">{label}<input id={id} className="input" type="text" required={question.required} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></div>;
    }
}

function ApplicationForm({ event, existing, bodies }: { event: Event; existing: Application | null; bodies: Body[] }) {
    const { id = '', application_id: applicationId = 'me' } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const bodyId = useId();
    const errorsId = useId();
    const [body, setBody] = useState<number | null>(existing?.body_id ?? bodies[0]?.id ?? null);
    const [answers, setAnswers] = useState<unknown[]>(() => event.questions.map((question, index) => (existing ? existing.answers[index] : defaultAnswer(question))));
    const [agreed, setAgreed] = useState(existing?.agreed_to_privacy_policy ?? false);
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const save = useMutation({
        mutationFn: () => {
            const payload = { body_id: body, answers, agreed_to_privacy_policy: agreed };
            const url = `${SERVICES.events}/single/${encodeURIComponent(id)}/applications`;
            return existing ? api.put(`${url}/${encodeURIComponent(applicationId)}`, payload) : api.post(url, payload);
        },
        onSuccess: () => {
            toast.success('Your application was saved, you can still edit it until the application period ends');
            navigate(href('oms.events.view', { id: eventKey(event) }));
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 422) {
                setErrors(error.body?.errors ?? {});
                toast.error('Some of the application data is invalid.');
                return;
            }
            toast.error(errorMessage('Could not save application', error));
        }
    });

    const submit = (formEvent: FormEvent) => {
        formEvent.preventDefault();
        if (!body) {
            toast.error('Please select a body.');
            return;
        }
        save.mutate();
    };

    const reasons = [...(errors.answers ?? []), ...(errors.body_id ?? [])];

    return (
        <form onSubmit={submit} aria-describedby={reasons.length ? errorsId : undefined}>
            {bodies.length > 0 ? (
                <div className="field">
                    <label className="label" htmlFor={bodyId}>Body <span className="required" aria-hidden="true">*</span></label>
                    <select id={bodyId} className="select" value={body ?? ''} onChange={(e) => setBody(Number(e.target.value))}>
                        {bodies.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                </div>
            ) : (
                <div className="notice danger">
                    <p>You are not a member of any body, therefore you cannot apply.</p>
                    <p>To apply to the event, you need to be a member of at least one body.</p>
                    <p>For that, go to Bodies, send a join request to the body you are in and wait for the board to approve it</p>
                </div>
            )}

            {reasons.length || errors.gender || errors.date_of_birth ? (
                <div className="notice danger" id={errorsId} role="alert">
                    <p>Could not apply because of these reasons:</p>
                    <ul>
                        {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                        {errors.gender ? <li>Please set the gender in <a href="/members/me" target="_blank" rel="noopener noreferrer">your profile.</a></li> : null}
                        {errors.date_of_birth ? <li>Please set the date of birth in <a href="/members/me" target="_blank" rel="noopener noreferrer">your profile.</a></li> : null}
                    </ul>
                </div>
            ) : null}

            {event.questions.map((question, index) => (
                <Answer
                    // Questions have no ids; their position is what the answers refer to.
                    key={index}
                    question={question}
                    index={index}
                    value={answers[index]}
                    onChange={(value) => setAnswers(answers.map((answer, i) => (i === index ? value : answer)))}
                />
            ))}

            <div className="field">
                <label className="checkbox-label">
                    <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                    <span>{PRIVACY_TEXT} <span className="required" aria-hidden="true">*</span></span>
                </label>
                {errors.agreed_to_privacy_policy ? <p className="notice danger">{errors.agreed_to_privacy_policy.join(', ')}</p> : null}
            </div>

            <button type="submit" className="button primary" disabled={save.isPending}>Save application!</button>
        </form>
    );
}

function ApplicationView({ event, application, bodies }: { event: Event; application: Application; bodies: Body[] }) {
    const body = bodies.find((option) => option.id === application.body_id);
    return (
        <>
            <p>
                <strong>You applied from this body: </strong>
                <AppLink to={href('oms.bodies.view', { id: application.body_id })} target="_blank" rel="noopener noreferrer">{body ? body.name : `Body ${application.body_id}`}</AppLink>
            </p>
            <table className="facts">
                <thead><tr><th scope="col">Description</th><th scope="col">Your answer</th></tr></thead>
                <tbody>
                    {event.questions.map((question, index) => (
                        <tr key={index}><td><strong>{question.description}</strong></td><td>{beautify(application.answers[index])}</td></tr>
                    ))}
                    <tr><td><strong>{PRIVACY_TEXT}</strong></td><td>{beautify(application.agreed_to_privacy_policy)}</td></tr>
                </tbody>
            </table>
            {event.questions.length === 0 ? <p className="notice info">You didn&apos;t need to fill in the application fields.</p> : null}
            {application.status === 'pending' ? (
                <p className="notice warning">Your application is being processed, please wait for the organisers to evaluate your application. Unfortunately you can not edit it anymore.</p>
            ) : null}
            {application.status === 'accepted' ? <p className="notice success">Congratulations, you have been accepted to the event!</p> : null}
            {application.status === 'rejected' ? <p className="notice info">Sorry, but you were not accepted to the event.</p> : null}
        </>
    );
}

export function ApplyPage() {
    const { id = '', application_id: applicationId = 'me' } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const session = useSession();

    const query = useQuery({
        queryKey: ['application', id, applicationId],
        queryFn: async () => {
            const { event } = await fetchEvent(id);
            return { event, application: await fetchApplication(id, applicationId) };
        },
        retry: false
    });

    const { error } = query;
    useEffect(() => {
        if (!error) return;
        toast.error(error instanceof ApiError && error.status === 404 ? 'Event is not found' : errorMessage('Some error happened', error));
        // The Vue app means to do this too, but goes to a route that doesn't exist.
        navigate(href('oms.events.list.all'));
    }, [error, navigate, toast]);

    const user = session.user;
    const bodies = useMemo(() => (user ? sortBodies(user.bodies, user.primary_body_id) : []), [user]);

    if (!query.data || !user) return <Loading label="Loading the application…" />;

    const { event, application } = query.data;
    if (!event.has_applications) {
        return <p className="notice info">This event does not accept any applications, you can join without applying.</p>;
    }

    const canApply = event.application_status === 'open' && event.status === 'published';
    const ban = user.event_application_ban;
    const banned = Boolean(ban && new Date(ban.ban_until) > new Date());
    const isNew = !application;
    const canSubmit = canApply && (!isNew || !banned);

    let title = `See your application on ${event.name}`;
    if (isNew) title = `Apply to ${event.name}`;
    else if (canApply) title = `Edit your application on ${event.name}`;

    return (
        <section aria-labelledby="apply-title">
            <h1 id="apply-title">{title}</h1>
            {isNew && !canApply ? <p>You cannot apply: the applications are closed or the event is not published yet.</p> : null}
            {isNew && banned && ban ? (
                <p className="notice warning">You are temporarily banned from submitting new event applications until {formatDateTime(ban.ban_until)}.</p>
            ) : null}
            {canSubmit ? <ApplicationForm event={event} existing={application} bodies={bodies} /> : null}
            {!isNew && !canApply && application ? <ApplicationView event={event} application={application} bodies={bodies} /> : null}
        </section>
    );
}
