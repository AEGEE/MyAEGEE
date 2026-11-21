// /events/:id (views/events/Single.vue in the Vue app). Not in the proof of concept: changing
// the picture (PictureModal.vue) and the map of the locations, which is a list here.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ConfirmDialog, type ConfirmRequest } from '../components/ConfirmDialog';
import { Loading } from '../components/Loading';
import { api, ApiError, errorMessage, SERVICES } from '../lib/api';
import { capitalize, formatDateTime } from '../lib/format';
import { AppLink } from '../lib/links';
import { renderMarkdown } from '../lib/markdown';
import { href } from '../lib/routes';
import { safeUrl } from '../lib/safe-url';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { EVENT_TYPE_NAMES, eventKey, type Event, type EventPermissions } from '../lib/types';
import styles from '../styles/events.module.css';

interface EventResponse {
    event: Event;
    permissions: EventPermissions;
}

export const fetchEvent = async (id: string): Promise<EventResponse> => {
    const response = await api.get<Event>(`${SERVICES.events}/single/${encodeURIComponent(id)}`);
    return { event: response.data, permissions: (response as unknown as { permissions: EventPermissions }).permissions };
};

const LOCAL_TIME = 'The date and time are in your local timezone';

function Fact({ label, children, localTime = false }: { label: string; children: ReactNode; localTime?: boolean }) {
    return (
        <tr>
            <th scope="row">{label}{localTime ? <span className="visually-hidden"> ({LOCAL_TIME})</span> : null}</th>
            <td>{children}</td>
        </tr>
    );
}

function ExternalLink({ value }: { value: string | null | undefined }) {
    if (!value) return null;
    const url = safeUrl(value);
    // Unsafe links stay visible as text, but can't be opened.
    return url ? <a href={url} target="_blank" rel="noopener noreferrer">{value}</a> : <span>{value}</span>;
}

export function EventPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const session = useSession();
    const queryClient = useQueryClient();
    const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

    const query = useQuery({ queryKey: ['event', id], queryFn: () => fetchEvent(id), retry: false });

    const { error } = query;
    useEffect(() => {
        if (!error) return;
        toast.error(error instanceof ApiError && error.status === 404 ? 'Event is not found' : errorMessage('Some error happened', error));
        navigate(href('oms.events.list.all'));
    }, [error, navigate, toast]);

    const changeStatus = useMutation({
        mutationFn: (status: Event['status']) => api.put(`${SERVICES.events}/single/${query.data?.event.id}/status`, { status }),
        onSuccess: (_, status) => {
            toast.info(`Event status is now ${status}`);
            // Refetched for the new permissions too.
            return queryClient.invalidateQueries({ queryKey: ['event', id] });
        },
        onError: (err) => toast.error(errorMessage('Could not change event status', err))
    });

    const changeEuropeanEvent = useMutation({
        mutationFn: (value: boolean) => api.put(`${SERVICES.events}/single/${query.data?.event.id}/status/european_event`, { is_european_event: value }),
        onSuccess: (_, value) => {
            toast.info(`European Event status is now ${value}`);
            return queryClient.invalidateQueries({ queryKey: ['event', id] });
        },
        onError: (err) => toast.error(errorMessage('Could not change European Event status', err))
    });

    const deleteEvent = useMutation({
        mutationFn: () => api.delete(`${SERVICES.events}/single/${query.data?.event.id}`),
        onSuccess: () => {
            toast.info('Event is deleted.');
            navigate(href('oms.events.list.all'));
        },
        onError: (err) => toast.error(errorMessage('Could not delete event', err))
    });

    if (!query.data) return <Loading label="Loading the event…" />;

    const { event, permissions: can } = query.data;
    const key = eventKey(event);
    const online = event.method === 'online';
    const ban = session.user?.event_application_ban;
    const banned = ban && new Date(ban.ban_until) > new Date();

    const askChangeStatus = (status: Event['status']) => {
        if (event.status === 'draft') {
            const missingBudget = !event.budget && !online;
            if (missingBudget) toast.error('Please set the budget for the event in the event settings.');
            if (!event.programme) toast.error('Please set the program for the event in the event settings.');
            if (missingBudget || !event.programme) return;
        }
        setConfirm({
            title: 'Change status',
            message: <p>Are you sure you want to <strong>change this event status to &quot;{status}&quot;</strong>?</p>,
            confirmText: 'Change status',
            onConfirm: () => changeStatus.mutate(status)
        });
    };

    const statusAction = (label: string, status: Event['status'], tone: 'primary' | 'danger') => (
        <button type="button" className={`button full ${tone}`} onClick={() => askChangeStatus(status)}>{label}</button>
    );

    return (
        <div className={styles.layout}>
            <div>
                <img className={styles.headImage} alt="" src={event.image ? `/media/events/headimages/${event.image}` : '/images/logo.png'} />
                <div className={styles.sideActions}>
                    {can.list_applications ? <AppLink className="button full" to={href('oms.events.participants', { id: key })}>View applications</AppLink> : null}
                    {event.status === 'published' && event.has_applications ? (
                        <AppLink className="button full" to={href('oms.events.apply', { id: key, application_id: 'me' })}>Manage my application</AppLink>
                    ) : null}
                    {can.edit_event ? <AppLink className="button full" to={href('oms.events.edit', { id: key })}>Edit event</AppLink> : null}
                    {can.change_status.submitted && event.status === 'draft' ? statusAction('Ask for approval', 'submitted', 'primary') : null}
                    {can.change_status.submitted && event.status === 'published' ? statusAction('Unpublish', 'submitted', 'danger') : null}
                    {can.change_status.published && event.status === 'submitted' ? statusAction('Approve event', 'published', 'primary') : null}
                    {can.change_status.draft && event.status === 'submitted' ? statusAction('Request changes', 'draft', 'danger') : null}
                    {can.change_european_event_status[event.type] ? (
                        <button
                            type="button"
                            className="button full"
                            onClick={() => setConfirm({
                                title: 'Change European Event status',
                                message: <p>Are you sure you want to change this event&apos;s status to <strong>{event.is_european_event ? 'not' : 'a'} European Event</strong>?</p>,
                                confirmText: 'Change European Event status',
                                onConfirm: () => changeEuropeanEvent.mutate(!event.is_european_event)
                            })}
                        >
                            Change European Event status
                        </button>
                    ) : null}
                    {can.delete_event ? (
                        <button
                            type="button"
                            className="button full danger"
                            onClick={() => setConfirm({
                                title: 'Deleting an event',
                                message: <p>Are you sure you want to <strong>delete this event</strong>?</p>,
                                confirmText: 'Delete event',
                                tone: 'danger',
                                onConfirm: () => deleteEvent.mutate()
                            })}
                        >
                            Delete event
                        </button>
                    ) : null}
                </div>
            </div>

            <article aria-labelledby="event-title">
                <h1 id="event-title">{event.name}</h1>

                {online ? <p className="notice info">This is an online event{event.has_applications ? '' : ', you can join without applying'}!</p> : null}
                {banned ? (
                    <p className="notice warning">
                        You are temporarily banned from submitting new event applications until {formatDateTime(ban.ban_until)}. Existing applications can still be managed.
                    </p>
                ) : null}

                <table className="facts">
                    <caption className="visually-hidden">About the event</caption>
                    <tbody>
                        <Fact label="Event name">{event.name}</Fact>
                        {/* Sanitised in renderMarkdown(). */}
                        <Fact label="Description"><div dangerouslySetInnerHTML={{ __html: renderMarkdown(event.description) }} /></Fact>
                        <Fact label="Max. participants">{event.max_participants}</Fact>
                        {event.has_applications ? (
                            <>
                                <Fact label="Application status">{capitalize(event.application_status)}</Fact>
                                <Fact label="Application period starts" localTime>{formatDateTime(event.application_starts)}</Fact>
                                <Fact label="Application period ends" localTime>{formatDateTime(event.application_ends)}</Fact>
                            </>
                        ) : null}
                        <Fact label="Starts" localTime>{formatDateTime(event.starts)}</Fact>
                        <Fact label="Ends" localTime>{formatDateTime(event.ends)}</Fact>
                        <Fact label="Type">{EVENT_TYPE_NAMES[event.type]}</Fact>
                        {!online ? <Fact label="Fee">{event.fee ? `€${event.fee}` : <i>Free</i>}</Fact> : null}
                        {event.optional_fee ? <Fact label="Optional Fee">€{event.optional_fee}</Fact> : null}
                        {event.optional_programme ? <Fact label="Optional programme">{event.optional_programme}</Fact> : null}
                        {event.link_info_travel_country ? (
                            <Fact label="Useful information to travel to this country"><ExternalLink value={event.link_info_travel_country} /></Fact>
                        ) : null}
                        {!online ? <Fact label="Number of meals provided per day">{event.meals_per_day}</Fact> : null}
                        {!online ? <Fact label="Accommodation type">{event.accommodation_type}</Fact> : null}
                        {can.approve_event[event.type] ? <Fact label="Status">{capitalize(event.status)}</Fact> : null}
                        <Fact label="Organising bodies">
                            <ul>
                                {event.organizing_bodies.map((body) => (
                                    <li key={body.body_id}><AppLink to={href('oms.bodies.view', { id: body.body_id })}>{body.body_name}</AppLink></li>
                                ))}
                            </ul>
                        </Fact>
                        {event.locations.length > 0 ? (
                            <Fact label="Locations">
                                <ul>{event.locations.map((location) => <li key={location.name}>{location.name}</li>)}</ul>
                            </Fact>
                        ) : null}
                        {event.budget && !online ? <Fact label="Budget link"><ExternalLink value={event.budget} /></Fact> : null}
                        {event.programme ? <Fact label="Program link"><ExternalLink value={event.programme} /></Fact> : null}
                    </tbody>
                </table>

                {event.vegetarian ? <p className="notice success">This event is fully vegetarian!</p> : null}

                {event.status !== 'published' ? (
                    <div className="notice info">
                        <p><strong>This event is visible to EQAC and organisers only because it&apos;s not approved yet.</strong></p>
                        <p>Once the event will be published, others would be able to access it.</p>
                    </div>
                ) : null}
                {event.status === 'draft' ? (
                    <p className="notice info">This event is in the &quot;draft&quot; status. Once you have filled in all the fields, you can send it to EQAC approval.</p>
                ) : null}
                {event.status === 'submitted' ? <p className="notice info">This event is under approval. Wait a little till EQAC approves it.</p> : null}
            </article>

            <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
        </div>
    );
}
