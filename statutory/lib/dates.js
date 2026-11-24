const moment = require('moment');

// A date as a client writes it: a day (2031-07-01) or a full timestamp with its time zone
// (2031-07-01T10:00:00.000Z), in the years 1 to 9999, and a day that exists. Anything else
// that JavaScript would read as some date ("1", "2031", a number) is not a date here.
const WRITTEN_DATE = /^(?!0000)\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/;
// The moment is in the year 1 or later in UTC as well, as the database stores it.
exports.isWrittenAsDate = (value) => typeof value === 'string'
    && WRITTEN_DATE.test(value)
    && moment(value.slice(0, 10), 'YYYY-MM-DD', true).isValid()
    && moment.parseZone(value).isValid()
    && moment.parseZone(value).utc().year() >= 1;

// The earliest moment the database stores: the start of the year 1 in UTC. The first day of
// the year 1 starts earlier in the time zones east of UTC.
const EARLIEST = new Date('0001-01-01T00:00:00.000Z');
exports.notBeforeTheYear1 = (date) => (date < EARLIEST ? EARLIEST : date);

// A day as it is written, YYYY-MM-DD, in the years 1 to 9999.
exports.isWrittenAsDay = (value) => typeof value === 'string'
    && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)
    && moment(value, 'YYYY-MM-DD', true).isValid();
