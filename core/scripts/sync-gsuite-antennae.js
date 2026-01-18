/* eslint-disable no-console */

// PART 1: get all gsuite under /antennae, and for each one make a query to core

const request = require('request-promise-native');

const {
    User
} = require('../models');

const gsuiteObj = [
    // {
    //   "primaryEmail": aegee-place@aegee.eu, // from gsuite
    //   "recoveryEmail": aegee.place@gmail.com, // from gsuite
    //   "allocated": false, // whether we have found this person on myaegee
    // } ;
];

(async () => {
    try {
        const antennae = JSON.parse(await request({ method: 'GET', url: 'http://gsuite-wrapper:8084/account?max=500&q=orgUnitPath=/antennae' }));

        let unrecovery = 0;

        antennae.data.users.forEach((item) => {
            gsuiteObj.push(
                {
                    primaryEmail: item.primaryEmail,
                    recoveryEmail: item.recoveryEmail || item.emails[0].address,
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
    async function findMyAEGEEantenna(obj) {
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

    gsuiteObj.forEach(findMyAEGEEantenna);

    // HERE is the part where we do the MANUAL PATCH
    console.log('');
    console.log('');
    gsuiteObj.filter((obj) => obj.allocated === false).forEach((obj) => console.log(`${obj.primaryEmail}'s secondary email on my aegee is not ${obj.recoveryEmail}`));
    console.log('');
    console.log('Total number of unallocated objects:');
    console.log(gsuiteObj.filter((obj) => obj.allocated === false).length);
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
