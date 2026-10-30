// How long a Local was represented in the plenaries.
//
// General Rules, art. 6(1)(d): to remain an Antenna, a Local must be represented by its delegates
// in at least 80% of plenary time. The rule is about the Local, not about each delegate:
// a moment counts when at least one delegate of the Local is in the hall.
// Contact Antennae have no attendance criterion, so only Antennae are calculated.
//
// Only the plenary time until now counts: a plenary that did not start yet is not judged,
// and a running plenary is judged on the time from its start until now.
// When all plenaries are over, all plenary time counts.

const LOCAL_ATTENDANCE_THRESHOLD = 80;

// The plenary time until now, in seconds.
const elapsedSecondsOfPlenary = (plenary, now) => {
    const plenaryStart = new Date(plenary.starts).getTime();
    const plenaryEnd = Math.min(new Date(plenary.ends).getTime(), new Date(now).getTime());

    return Math.max(plenaryEnd - plenaryStart, 0) / 1000;
};

// The seconds of a plenary until now in which at least one of the visits was running.
// Visits are cut to that time and overlapping visits are merged, so a moment counts once.
// A visit that is not closed yet runs until now.
const mergedSecondsWithinPlenary = (attendances, plenary, now) => {
    const nowTime = new Date(now).getTime();
    const plenaryStart = new Date(plenary.starts).getTime();
    const plenaryEnd = Math.min(new Date(plenary.ends).getTime(), nowTime);

    const ranges = attendances
        .map((attendance) => ({
            start: Math.max(new Date(attendance.starts).getTime(), plenaryStart),
            end: Math.min(attendance.ends ? new Date(attendance.ends).getTime() : nowTime, plenaryEnd)
        }))
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start);

    let milliseconds = 0;
    let coveredUntil = -Infinity;
    for (const range of ranges) {
        const start = Math.max(range.start, coveredUntil);
        if (range.end > start) {
            milliseconds += range.end - start;
            coveredUntil = range.end;
        }
    }

    return milliseconds / 1000;
};

// Per Antenna: the percentage of each started plenary in which the Local was represented,
// and the average over these plenaries. Every plenary has the same weight, whatever its duration.
// Plenaries must be loaded with their attendances.
const calculateLocalAttendance = ({ plenaries, applications, bodies, now }) => {
    const startedPlenaries = plenaries.filter((plenary) => elapsedSecondsOfPlenary(plenary, now) > 0);

    const locals = bodies
        .filter((body) => body.type === 'antenna')
        .map((body) => {
            const delegateIds = new Set(applications
                .filter((application) => application.body_id === body.id && application.participant_type === 'delegate')
                .map((application) => application.id));

            const perPlenary = startedPlenaries.map((plenary) => {
                const visits = plenary.attendances.filter((attendance) => delegateIds.has(attendance.application_id));
                const seconds = mergedSecondsWithinPlenary(visits, plenary, now);

                return {
                    plenary_id: plenary.id,
                    seconds,
                    percent: (seconds / elapsedSecondsOfPlenary(plenary, now)) * 100
                };
            });

            const averagePercent = perPlenary.length > 0
                ? perPlenary.reduce((sum, entry) => sum + entry.percent, 0) / perPlenary.length
                : 0;

            return {
                body_id: body.id,
                code: body.code,
                name: body.name,
                delegates: delegateIds.size,
                plenaries: perPlenary,
                average_percent: averagePercent,
                // Without any started plenary there is nothing to judge yet.
                below_threshold: perPlenary.length > 0 && averagePercent < LOCAL_ATTENDANCE_THRESHOLD
            };
        });

    return { threshold: LOCAL_ATTENDANCE_THRESHOLD, locals };
};

module.exports = {
    LOCAL_ATTENDANCE_THRESHOLD,
    mergedSecondsWithinPlenary,
    calculateLocalAttendance
};
