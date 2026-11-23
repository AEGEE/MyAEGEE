// Factories for what core answers about one body and its members, beyond the shared ones in
// core.ts. See base.ts for the rules.
import { body, circle, type Body, type Circle } from './core.ts';

// A body as `GET core /bodies/:id` answers it: with the circles bound to it and its shadow
// circle (the circle whose members get the permissions of the body's members). The lists
// (`GET core /bodies`) have neither.
export interface BodyDetail extends Body {
    postal_address: string | null;
    gsuite_id: string | null;
    google_group: string | null;
    circles: Circle[];
    shadow_circle: Circle | null;
}

export const bodyDetail = (overrides: Partial<BodyDetail> = {}): BodyDetail => {
    const { circles, shadow_circle: shadowCircle, postal_address: postalAddress, gsuite_id: gsuiteId, google_group: googleGroup, ...own } = overrides;
    const base = body(own);
    return {
        ...base,
        postal_address: postalAddress ?? null,
        gsuite_id: gsuiteId ?? null,
        google_group: googleGroup ?? null,
        circles: circles ?? [circle({ body_id: base.id, name: `Members of ${base.name}`, description: 'Everyone in the body' })],
        shadow_circle: shadowCircle ?? null
    };
};
