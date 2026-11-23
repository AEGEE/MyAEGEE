// Only members of bodies of these types may claim discount codes (types as in core's Body model).
exports.CLAIM_BODY_TYPES = ['antenna', 'contact antenna', 'contact'];

// The fields a manager sets when creating or editing; ids and timestamps are the database's.
exports.INTEGRATION_FIELDS = ['name', 'code', 'quota_period', 'quota_amount', 'description'];
exports.CATEGORY_FIELDS = ['name', 'discounts'];
