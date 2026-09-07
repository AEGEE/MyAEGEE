// Quorum representation follows the scheduled publication time, regardless of
// permissions or an early application-status reveal.
module.exports = (applications, event, now = Date.now()) => {
    const acceptedOnly = now >= new Date(event.participants_list_publish_deadline).getTime();
    const represented = applications.filter((application) => !application.cancelled
        && (!acceptedOnly || application.status === 'accepted'));

    return {
        accepted_only: acceptedOnly,
        body_ids: [...new Set(represented.map((application) => application.body_id))]
    };
};
