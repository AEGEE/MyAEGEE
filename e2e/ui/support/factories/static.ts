// Factories for the static pages: the status page (healthchecks, GitHub releases, Docker Hub
// tags), the wiki pages (Confluence) and the resources page (core's resources). See base.ts
// for the rules.
import { id, iso } from './base.ts';

// Exports of this file that don't build an entity of a service, so they need no contract check
// (scripts/check-factory-contracts.ts): GitHub, Docker Hub and Confluence are other sites, and
// the suite has no copy of them to compare with.
export const NOT_ENTITIES = ['githubRelease', 'dockerTags', 'confluencePage'];

// What a service answers on GET /healthcheck, inside `ok()`: its package's name and version.
export interface Healthcheck {
    name: string;
    description: string;
    version: string;
}

export const healthcheck = (overrides: Partial<Healthcheck> = {}): Healthcheck => ({
    name: 'core',
    description: 'The core of MyAEGEE: members, bodies and permissions',
    version: '1.4.2',
    ...overrides
});

// One release of `GET https://api.github.com/repos/AEGEE/MyAEGEE/releases`, the fields the
// status page reads. Tags are `<service>@<version>`.
export interface GithubRelease {
    tag_name: string;
    name: string;
    draft: boolean;
    prerelease: boolean;
    published_at: string;
}

export const githubRelease = (tag: string, overrides: Partial<GithubRelease> = {}): GithubRelease => ({
    tag_name: tag,
    name: tag,
    draft: false,
    prerelease: false,
    published_at: iso(-3),
    ...overrides
});

// `GET /v2/repositories/aegee/<image>/tags` of Docker Hub (through the gateway's proxy), newest first.
export interface DockerTags {
    count: number;
    results: { name: string; last_updated: string }[];
}

export const dockerTags = (names: string[]): DockerTags => ({
    count: names.length,
    results: names.map((name, index) => ({ name, last_updated: iso(-index) }))
});

// A page of the Confluence REST API (`/wiki/rest/api/content/<id>?expand=body.export_view…`),
// the fields the page reads.
export interface ConfluencePage {
    id: string;
    type: 'page';
    title: string;
    body: { export_view: { value: string; representation: 'export_view' } };
}

export const confluencePage = (overrides: { id?: string; title?: string; html?: string } = {}): ConfluencePage => ({
    id: overrides.id ?? String(id()),
    type: 'page',
    title: overrides.title ?? 'Knowledge Management System',
    body: { export_view: { value: overrides.html ?? '<p>Welcome to the <strong>KMS</strong>.</p>', representation: 'export_view' } }
});

export type ResourceTheme = 'blue' | 'blue-dark' | 'purple' | 'red' | 'grey' | 'yellow' | 'green';

// A link of the resources page (`links` of a section of `GET core /resources`). A URL that
// starts with `/` is a page of MyAEGEE.
export interface ResourceLink {
    id: number;
    category_id: number;
    title: string;
    description: string;
    url: string;
    position: number;
    created_at: string;
    updated_at: string;
}

export const resourceLink = (overrides: Partial<ResourceLink> = {}): ResourceLink => {
    const linkId = overrides.id ?? id();
    return {
        id: linkId,
        category_id: 1,
        title: `Resource ${linkId}`,
        description: 'Where to find it, and what it is for.',
        url: 'https://www.aegee.org/',
        position: 0,
        created_at: iso(-60),
        updated_at: iso(-5),
        ...overrides
    };
};

// A section of the resources page (`GET core /resources`), with its links in order.
export interface ResourceCategory {
    id: number;
    name: string;
    theme: ResourceTheme;
    position: number;
    links: ResourceLink[];
    created_at: string;
    updated_at: string;
}

export const resourceCategory = (overrides: Partial<ResourceCategory> = {}): ResourceCategory => {
    const categoryId = overrides.id ?? id();
    return {
        id: categoryId,
        name: `Section ${categoryId}`,
        theme: 'blue',
        position: 0,
        links: [resourceLink({ category_id: categoryId })],
        created_at: iso(-60),
        updated_at: iso(-5),
        ...overrides
    };
};
