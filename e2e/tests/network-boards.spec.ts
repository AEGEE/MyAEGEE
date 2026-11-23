// Adding a board crosses three services: network asks core who the user is and whether the
// body and the board members exist, then looks the members' mail addresses up in core with its
// own account (the seeded admin) and sends them the welcome mail through the mailer.
// Network's own tests cover the board rules with core mocked away.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';

const DAY = 24 * 60 * 60 * 1000;
const day = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

interface Board {
    id: number;
    body_id: number;
    president: number;
    new_board_email_sent_at: string | null;
}

test.describe('network boards', () => {
    test('the members of a new board get the welcome mail', async ({ api, otherAntenna }) => {
        const { body, member } = otherAntenna;
        const boardMember = await api.me('board');

        const created = await api.call('admin', 'POST', `/api/network/bodies/${body.id}/boards`, {
            elected_date: day(-30),
            start_date: day(-1),
            president: member.id,
            secretary: boardMember.id,
            treasurer: member.id
        });
        expectStatus(created, 200);

        const boards = await api.call<Envelope<Board[]>>('admin', 'GET', `/api/network/bodies/${body.id}/boards`);
        expectStatus(boards, 200);
        expect(boards.body.data).toHaveLength(1);
        const [board] = boards.body.data;

        try {
            expect(board).toMatchObject({ body_id: body.id, president: member.id });
            // Set only after network logged in to core, got the addresses and sent the mail.
            expect(board.new_board_email_sent_at).not.toBeNull();

            const welcome = (await api.mails()).filter((mail) => mail.template === 'network_board_welcome.html'
                && [mail.to].flat().includes(member.email));
            expect(welcome).toHaveLength(1);
            expect([welcome[0].to].flat().sort()).toEqual([boardMember.email, member.email].sort());
        } finally {
            expectStatus(await api.call('admin', 'DELETE', `/api/network/bodies/${body.id}/boards/${board.id}`), 200);
        }
    });
});
