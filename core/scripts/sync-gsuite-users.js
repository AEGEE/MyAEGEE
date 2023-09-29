/* eslint-disable no-console */

// PART 1: get all gsuite under /individuals, and for each one make a query to core

const request = require('request-promise-native');

const {
    User
} = require('../models');

const gsuiteObj = [
    // {
    //   "primaryEmail": name.surname@aegee.eu, // from gsuite
    //   "recoveryEmail": name.surname@gmail.com, // from gsuite
    //   "g_surname": item.name.familyName, // surname coming from gsuite
    //   "m_possible_users": [], // heuristic of people with the same surname in myaegee
    //   "allocated": false, // whether we have found this person on myaegee
    // } ;
];

// GAM tells me there are 800-900 users, so we need two invocations.

(async () => {
    try {
        const part1 = JSON.parse(await request({ method: 'GET', url: 'http://gsuite-wrapper:8084/account?max=500' }));

        const part2 = JSON.parse(await request({ method: 'GET', url: 'http://gsuite-wrapper:8084/account?max=500&pageToken=' + part1.data.nextPageToken }));

        let unrecovery = 0;

        part1.data.users.concat(part2.data.users).forEach((item) => {
            gsuiteObj.push(
                {
                    primaryEmail: item.primaryEmail,
                    recoveryEmail: item.recoveryEmail || item.emails[0].address,
                    g_surname: item.name.familyName,
                    m_possible_users: [],
                    allocated: false
                }
            );

            unrecovery += item.recoveryEmail ? 0 : 1;
        });

        // double check
        let unsecondary = 0;
        gsuiteObj.filter((obj) => obj.recoveryEmail === '').forEach((obj) => { unsecondary += 1; console.log(obj.primaryEmail + ' has no secondary email!'); });
        console.log('There are ' + unrecovery + ' users without a proper recovery email, only secondary; and without secondary are ' + unsecondary);
    } catch (e) {
        console.log(e);
    }
})().then(async () => {
    async function findMyAEGEEuser(obj) {
        const users = await User.findAll({
            where: { email: obj.recoveryEmail.toLowerCase() }
        });

        // PART 2: if there is a match, add their gsuite address in the core's field and mark it done
        if (users.length === 1) {
            try {
                await User.update(
                    {
                        gsuite_id: obj.primaryEmail
                    },
                    {
                        where: { email: obj.recoveryEmail.toLowerCase() },
                        returning: true,
                        plain: true
                    }
                );

                obj.allocated = true;
            } catch (e) {
                console.log(e);
            }
        }
    }

    gsuiteObj.forEach(findMyAEGEEuser);

    // HERE is the part where we do the MANUAL PATCH
    console.log('');
    console.log('');
    gsuiteObj.filter((obj) => obj.allocated === false).forEach((obj) => console.log(`${obj.primaryEmail}'s secondary email on my aegee is not ${obj.recoveryEmail}`));
    console.log('');
    console.log('Total number of unallocated objects:');
    console.log(gsuiteObj.filter((obj) => obj.allocated === false).length);

    // HELPER For our manual patch: heuristic by surname
    async function findMyAEGEEuserBySurname(obj) {
        let users = await User.findAll({
            where: { last_name: obj.g_surname } // FIXME use "like"
        });

        console.log(users);

        // try match via surname
        if (users.length > 0) {
            obj.m_possible_users = users;
            obj.allocated = true;
        } else { // for our hungarian people or the others...
            users = await User.findAll({
                where: { first_name: obj.g_surname } // FIXME use "like"
            });
            console.log(users);

            // try match via surname
            if (users.length > 0) {
                obj.m_possible_users = users;
                obj.allocated = true;
            }
        }
    }

    gsuiteObj.filter((obj) => obj.allocated === false).forEach(findMyAEGEEuserBySurname);
    console.log('');
    console.log('');
    console.log('heuristic: surname checking');

    console.log('easy guess (only one possibility):');
    gsuiteObj.filter((obj) => obj.m_possible_users.length === 1).forEach((obj) => { console.log(`${obj.primaryEmail} could be the following: ${obj.m_possible_users}`); console.log(obj.m_possible_users[0]); });
    console.log('easy guess total: ', gsuiteObj.filter((obj) => obj.m_possible_users.length === 1).length);

    console.log('harder guess');
    gsuiteObj.filter((obj) => obj.m_possible_users.length > 1).forEach((obj) => { console.log(`${obj.primaryEmail} could be the following: ${obj.m_possible_users}`); console.log(obj.m_possible_users[0]); });
    console.log('harder guess total: ', gsuiteObj.filter((obj) => obj.m_possible_users.length > 1).length);

    console.log('');
    console.log('');
}).catch((err) => {
    console.log(`christ sake: ${err}`);
    process.exit(1);
});

// TODO last but not least: create a final check that says "this gsuite user does not have an equivalent in myaegee"
// the above is a nice to have. Basically the dream script is as below

/*
script that foreach user in gsuite
  1 removes the user's any permission/group
  2 queries myaegee for the data to be provisioned:
    a personal data
    b antenna
    c bodies
    note: gsuite provides the gsuite ID, core
    only replies with the GSUITE-related info e.g. the
    GSUITE id of a group, not the id of a circle!
    things need to be mapped
  3 adds department/cost centre as antenna/body
  4 adds groups as bodies
*/
