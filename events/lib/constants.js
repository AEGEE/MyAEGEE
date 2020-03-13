module.exports = {
    APPLICATION_FIELD_NAMES: {
        user_id: 'User ID',
        body_id: 'Body ID',
        body_name: 'Body name',
        first_name: 'First name',
        last_name: 'Last name',
        email: 'Email',
        status: 'Status',
        board_comment: 'Board comment',
        created_at: 'Created at',
        updated_at: 'Updated at'
    },
    EVENT_PUBLIC_FIELDS: [
        'id',
        'name',
        'url',
        'image',
        'description',
        'application_starts',
        'application_ends',
        'starts',
        'ends',
        'fee',
        'organizing_bodies',
        'locations',
        'type',
        'questions',
        'max_participants',
        'application_status',
        'status'
    ],
    EVENT_TYPES: ['training', 'nwm', 'conference', 'cultural'],
    CURRENT_USER_PREFIX: 'me'
};
