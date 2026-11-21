// /events, /events/participating and /events/organizing (views/events/List.vue in the Vue app).
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { Loading } from '../components/Loading';
import { api, errorMessage, SERVICES } from '../lib/api';
import { formatDate, isSameDay } from '../lib/format';
import { AppLink } from '../lib/links';
import { renderMarkdown } from '../lib/markdown';
import { href } from '../lib/routes';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { EVENT_TYPE_NAMES, eventKey, type EventSummary, type EventType } from '../lib/types';
import styles from '../styles/events.module.css';

export type Scope = 'all' | 'participating' | 'organizing';

const LIMIT = 30;
const URLS: Record<Scope, string> = {
    all: SERVICES.events,
    participating: `${SERVICES.events}/mine/participating`,
    organizing: `${SERVICES.events}/mine/organizing`
};

const today = (): string => formatDate(new Date());

function Fee({ event }: { event: EventSummary }) {
    return (
        <>
            {event.fee ? <span>€{event.fee}</span> : <i>Free</i>}
            {event.optional_fee ? <span> (+ €{event.optional_fee})</span> : null}
        </>
    );
}

function OnlineTag({ event }: { event: EventSummary }) {
    if (event.method !== 'online') return null;
    return <span className="tag info">{event.has_applications ? 'Online' : 'Online, no applications'}</span>;
}

function ApplicationTag({ event, now }: { event: EventSummary; now: number }) {
    if (!event.has_applications) return null;
    if (now < new Date(event.application_starts).getTime()) return <span className="tag warning">Apply after {formatDate(event.application_starts)}</span>;
    if (event.application_status === 'open') return <span className="tag success">Apply before {formatDate(event.application_ends)}</span>;
    if (now > new Date(event.application_ends).getTime()) return <span className="tag">Applications are closed</span>;
    return null;
}

function OrganizingBodies({ event }: { event: EventSummary }) {
    return (
        <ul className={styles.bodies}>
            {event.organizing_bodies.map((body) => (
                <li key={body.body_id}><AppLink to={href('oms.bodies.view', { id: body.body_id })}>{body.body_name}</AppLink></li>
            ))}
        </ul>
    );
}

function EventImage({ event }: { event: EventSummary }) {
    // Decorative: the event's name is right next to it.
    return <img className={styles.image} alt="" src={event.image ? `/media/events/headimages/${event.image}` : '/images/logo.png'} />;
}

function EventCard({ event, now }: { event: EventSummary; now: number }) {
    const titleId = useId();
    const key = eventKey(event);
    return (
        <article className={styles.card} aria-labelledby={titleId}>
            <EventImage event={event} />
            <h2 className={styles.cardTitle} id={titleId}>{event.name} <OnlineTag event={event} /></h2>
            <p className={styles.tags}>
                <span className={styles.typeTag} data-type={event.type}>{EVENT_TYPE_NAMES[event.type]}</span>
                <ApplicationTag event={event} now={now} />
            </p>
            <dl className={styles.facts}>
                <dt>Dates</dt>
                <dd>{formatDate(event.starts)}{isSameDay(event.starts, event.ends) ? null : ` - ${formatDate(event.ends)}`}</dd>
                <dt>Fee</dt>
                <dd><Fee event={event} /></dd>
                <dt>Organising bodies</dt>
                <dd><OrganizingBodies event={event} /></dd>
            </dl>
            <p className={styles.actions}>
                <AppLink className="button" to={href('oms.events.view', { id: key })}>Go to event page</AppLink>
                {event.status === 'published' && event.application_status === 'open' && event.has_applications ? (
                    <AppLink className="button primary" to={href('oms.events.apply', { id: key, application_id: 'me' })}>Apply!</AppLink>
                ) : null}
            </p>
        </article>
    );
}

function EventRow({ event }: { event: EventSummary }) {
    const titleId = useId();
    const key = eventKey(event);
    return (
        <article className={styles.row} aria-labelledby={titleId}>
            <EventImage event={event} />
            <div>
                <h2 className={styles.cardTitle} id={titleId}>
                    <AppLink to={href('oms.events.view', { id: key })}>{event.name}</AppLink> <OnlineTag event={event} />
                </h2>
                {/* Sanitised in renderMarkdown(). */}
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(event.description) }} />
                <ul>
                    <li><strong>Type:</strong> {EVENT_TYPE_NAMES[event.type]}</li>
                    <li><strong>From:</strong> {formatDate(event.starts)}</li>
                    <li><strong>To:</strong> {formatDate(event.ends)}</li>
                    {event.has_applications ? (
                        <li><strong>Application period:</strong> {formatDate(event.application_starts)} - {formatDate(event.application_ends)}</li>
                    ) : null}
                    <li><strong>Organising bodies:</strong> <OrganizingBodies event={event} /></li>
                </ul>
                <p className={styles.actions}>
                    <AppLink className="button" to={href('oms.events.view', { id: key })}>Go to event page</AppLink>
                    {event.has_applications ? (
                        <AppLink className="button" to={href('oms.events.apply', { id: key, application_id: 'me' })}>My application</AppLink>
                    ) : null}
                </p>
            </div>
        </article>
    );
}

export function EventsList({ scope }: { scope: Scope }) {
    const session = useSession();
    const toast = useToast();
    const searchId = useId();
    const [search, setSearch] = useState('');
    const [types, setTypes] = useState<EventType[]>([]);
    const [displayPast, setDisplayPast] = useState(false);
    const [listView, setListView] = useState(false);
    const [now] = useState(() => Date.now());

    const query = useInfiniteQuery({
        queryKey: ['events', scope, { search, types, displayPast }],
        initialPageParam: 0,
        queryFn: async ({ pageParam, signal }) => (await api.get<EventSummary[]>(URLS[scope], {
            signal,
            query: {
                limit: LIMIT,
                offset: pageParam,
                type: types,
                starts: displayPast ? undefined : today(),
                search: search || undefined
            }
        })).data,
        // Only the full list pages; "my events" come in one go.
        getNextPageParam: (lastPage, pages) => (scope === 'all' && lastPage.length === LIMIT ? pages.length * LIMIT : undefined),
        retry: false
    });

    const { error } = query;
    useEffect(() => {
        if (error) toast.error(errorMessage('Could not fetch events list', error));
    }, [error, toast]);

    const events = query.data?.pages.flat() ?? [];
    const loading = query.isFetching;

    return (
        <section aria-labelledby="events-title">
            <h1 id="events-title">Events list</h1>

            <div className="field">
                <label className="label" htmlFor={searchId}>Search by name or description</label>
                <div className={styles.searchRow}>
                    <input id={searchId} className="input" type="text" value={search} placeholder="Search by name or description" onChange={(e) => setSearch(e.target.value)} />
                    <button type="button" className="button" onClick={() => setDisplayPast(!displayPast)}>
                        {displayPast ? 'Display only future events' : 'Display past events'}
                    </button>
                </div>
            </div>

            <fieldset className={`field ${styles.types}`}>
                <legend className="label">Event types</legend>
                {(Object.keys(EVENT_TYPE_NAMES) as EventType[]).map((type) => (
                    <label key={type} className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={types.includes(type)}
                            onChange={(e) => setTypes(e.target.checked ? [...types, type] : types.filter((t) => t !== type))}
                        />
                        {EVENT_TYPE_NAMES[type]}
                    </label>
                ))}
            </fieldset>

            <div className="field">
                <label className="checkbox-label">
                    <input type="checkbox" role="switch" checked={listView} onChange={(e) => setListView(e.target.checked)} />
                    Display classic list view
                </label>
            </div>

            {session.user && session.can('create:event') ? (
                <p className="field"><AppLink className="button primary" to={href('oms.events.create')}>Create event</AppLink></p>
            ) : null}

            <div className={listView ? styles.list : styles.grid} aria-busy={loading}>
                {events.map((event) => (listView ? <EventRow key={event.id} event={event} /> : <EventCard key={event.id} event={event} now={now} />))}
            </div>

            {loading && events.length === 0 ? <Loading label="Loading events…" /> : null}
            {!loading && events.length === 0 ? <p className={styles.empty}>No events found.</p> : null}

            {query.hasNextPage ? (
                <button type="button" className="button primary full" disabled={loading} onClick={() => query.fetchNextPage()}>
                    {query.isFetchingNextPage ? 'Loading more events…' : 'Load more events'}
                </button>
            ) : null}
        </section>
    );
}
