// Factories for what the network service answers. See base.ts for the rules.
import { date, id, iso } from './base.ts';

export interface BoardMember {
    user_id: number;
    // The position, as typed in: 'PR responsible'.
    function: string;
}

// A board of a body (`GET network /boards`, `GET network /bodies/:id/boards`). The president,
// secretary and treasurer are user ids; the dates have no time.
export interface Board {
    id: number;
    body_id: number;
    name: string | null;
    elected_date: string;
    start_date: string;
    end_date: string | null;
    president: number;
    secretary: number;
    treasurer: number;
    other_members: BoardMember[] | null;
    message: string | null;
    image_id: number | null;
    new_board_email_sent_at: string | null;
    created_at: string;
    updated_at: string;
}

// By default the current board: elected two months ago, in office for a year since last month.
export const board = (overrides: Partial<Board> = {}): Board => ({
    id: id(),
    body_id: 1,
    name: null,
    elected_date: date(-60),
    start_date: date(-30),
    end_date: date(335),
    president: 1,
    secretary: 2,
    treasurer: 3,
    other_members: [],
    message: null,
    image_id: null,
    new_board_email_sent_at: iso(-30),
    created_at: iso(-60),
    updated_at: iso(-30),
    ...overrides
});
