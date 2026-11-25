// Answers for the pages of the area `core` in the smoke and accessibility runs (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok, okList } from '../factories/base.ts';
import { body, member, type Member } from '../factories/core.ts';
import { bodyDetail } from '../factories/core-bodies.ts';
import { bodyCampaign, campaignDetail } from '../factories/core-campaigns.ts';
import { circleDetail, permissionDetail } from '../factories/core-circles.ts';

export const smoke = (api: ApiMock): void => {
    // POST /my_permissions answers "in which circles may I do X" with a list of circles.
    api.json('POST core /my_permissions', ok([]));
    // As core sends it: with the circles bound to the body.
    api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1 })));
    api.json('GET core /members/:id', ok(member({ id: 1 })));
    api.json('GET core /members/unconfirmed', okList([]));
    api.json('GET core /circles/:id', ok(circleDetail({ id: 1 })));
    api.json('GET core /permissions/:id', ok(permissionDetail('global:view:member', { id: 1 })));
    api.json('GET core /campaigns/:id', ok(campaignDetail({ id: 1, autojoin_body_id: 1 })));
    api.json('GET core /bodies/:id/campaigns/:campaign_id', ok(bodyCampaign({ id: 1, autojoin_body: body({ id: 1 }) })));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Route name -> what to change about the logged-in member before the page loads.
export const profiles: Record<string, (me: Member) => void> = {
    // Only a member whose profile is incomplete gets this page; everybody else, and every
    // superadmin, is sent on to the dashboard (UpdateProfile.vue, validate-user.js), and nothing
    // of the page would be checked.
    'oms.profile.update': (me) => {
        me.superadmin = false;
        me.privacy_consent = null;
    }
};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
