# Cri's version of GSuite-Wrapper

Winging it till it works. Vamonos!


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