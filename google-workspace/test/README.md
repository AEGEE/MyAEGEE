# Testing


Due to Google's propagation delay with an instance creation (e.g. of an account) I suggest testing individual CRUD operations instead of running them all together. 
This means avoid doing this: 
``` js
// WRONG TEST! 
npx mocha test/accounts.test.js 
```
and do this instead:
```js
// BETTER TESTING
npx mocha test/accounts.test.js --grep "Should add an account"
// wait...
npx mocha test/accounts.test.js --grep "Should get an account"
// wait...
npx mocha test/accounts.test.js --grep "Should delete an account"

```
## Google tests
In the directory `/test`, which is where you found this README, the tests are intended for the functions that communicate directly with Google APIs. To check what functions the server exposes, see the `/test/server` subfolder and the section below.

### Expected outcome

- creating a google account with `@aegee.eu` given user data. For more details check `lib/util/userPayload.js`. An account is created as 'suspended'. 
```js
{
  success: true,
  code: 201,
  data: {
    kind: 'admin#directory#user',
    id: '1111111111111111',
    etag: '"rrrrr-rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"',
    primaryEmail: 'test.istesting@aegee.eu',                // Check if the created email is the intended one. 
    name: { givenName: 'Test', familyName: 'isTesting' },
    isAdmin: false,
    isDelegatedAdmin: false,
    creationTime: '2026-04-23T13:35:41.000Z',
    hashFunction: 'SHA-1',
    suspended: true,
    suspensionReason: 'ADMIN',
    emails: [ [Object] ],
    organizations: [ [Object] ],
    customerId: 'idididid',
    orgUnitPath: '/gsuiteWrapperTest',
    isMailboxSetup: false,
    includeInGlobalAddressList: true,
    recoveryEmail: 'recovery@example.com'
  }
}
```

- suspending and activating an account.

```js
{
  success: true,
  code: 200,
  data: {
    kind: 'admin#directory#user',
    id: '111111111111111111111',
    etag: '"iiiii-rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"',
    primaryEmail: 'test.istesting@aegee.eu',
    name: {
      givenName: 'Test',
      familyName: 'isTesting',
      fullName: 'Test isTesting'
    },
    isAdmin: false,
    isDelegatedAdmin: false,
    lastLoginTime: '1970-01-01T00:00:00.000Z',
    creationTime: '2026-04-23T13:35:41.000Z',
    agreedToTerms: false,
    suspended: false,                   // Check here if the user has been suspended/activated.
    archived: false,
    changePasswordAtNextLogin: false,
    ipWhitelisted: false,
    emails: [ [Object], [Object] ],
    organizations: [ [Object] ],
    customerId: 'uuuuuuuuu',
    orgUnitPath: '/gsuiteWrapperTest',
    isMailboxSetup: true,
    includeInGlobalAddressList: true,
    thumbnailPhotoUrl: '//lh3.googleusercontent.com/a/ACg8ocLaZP7yZzqDGMDeHGjaJDI8IGavpLuIKcyDEC256Sapk66hOQ=mo',
    thumbnailPhotoEtag: '"DcQ1N-bWFowTUUTzr_P6Kb_8lgiFBgpcxrHgSbp-VdA/bKnzhqpAcjN-Dzr9msASIHWp5N8"',
    recoveryEmail: 'recovery@example.com'
  }
}
```



## Server Tests
When printing the whole `res` for debugging, be aware that the content is very long. We are mainly focusing on `res.statusCode` and `res.body`. See below for more details on the body.

### Expected outcomes
- creating an `@aegee.eu` account through the server, the `res.body` looks like this:
```js
statusCode: 201,
body: {
  success: true,
  message: 'test.istesting@aegee.eu account has been created',
  data: {
    kind: 'admin#directory#user',
    id: '111111111111111111111',
    etag: '"ddddd-iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii"',
    primaryEmail: 'test.istesting@aegee.eu',                // Check if the created email is the intended one. 
    name: { givenName: 'Test', familyName: 'isTesting' },
    isAdmin: false,
    isDelegatedAdmin: false,
    creationTime: '2026-04-23T15:05:40.000Z',
    hashFunction: 'SHA-1',
    suspended: true,
    suspensionReason: 'ADMIN',
    emails: [ [Object] ],
    organizations: [ [Object] ],
    customerId: 'iiiiiiiii',
    orgUnitPath: '/gsuiteWrapperTest',
    isMailboxSetup: false,
    includeInGlobalAddressList: true,
    recoveryEmail: 'recovery@example.com'
  }
}
```


- suspending and activating an account through the server, the `res.body` looks like this:
```js
statusCode: 200,
body: {
  success: true,
  message: 'test.istesting@aegee.eu account has been suspended',
  data: {
    kind: 'admin#directory#user',
    id: '111111111111111111111',
    etag: '"iiiii-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"',
    primaryEmail: 'test.istesting@aegee.eu',
    name: {
      givenName: 'Test',
      familyName: 'isTesting',
      fullName: 'Test isTesting',
    },
    isAdmin: false,
    isDelegatedAdmin: false,
    lastLoginTime: '1970-01-01T00:00:00.000Z',
    creationTime: '2026-04-16T12:41:24.000Z',
    agreedToTerms: false,
    suspended: true,            // Check here if the user has been suspended/activated. 
    suspensionReason: 'ADMIN',
    archived: false,
    changePasswordAtNextLogin: false,
    ipWhitelisted: false,
    emails: [ [Object], [Object] ],
    organizations: [ [Object] ],
    customerId: 'ididid',
    orgUnitPath: '/gsuiteWrapperTest',
    isMailboxSetup: true,
    includeInGlobalAddressList: true,
    thumbnailPhotoUrl: '//lh3.googleusercontent.com/a/ACg8ocJ8LDuQ4yhtPNt5sRXjPl09lKDvIE9WKB7APJ_M4eFA9UA6kw=mo',
    thumbnailPhotoEtag: '"DcQ1N-bWFowTUUTzr_P6Kb_8lgiFBgpcxrHgSbp-VdA/w771HrFXH8OSfcp4eQ66w3qqvsk"',
    recoveryEmail: 'recovery@example.com'
  }
}
```
