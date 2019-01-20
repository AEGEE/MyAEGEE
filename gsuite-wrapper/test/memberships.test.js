const chai = require('chai');
const should = chai.should();
const { request } = require('./test-helper.js');
const {runGsuiteOperation, gsuiteOperations} = require('./google-suite.js');


function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}

describe.only('Memberships', function(){
  
  const primaryEmail = "automated_test_group@aegee.eu";
  const groupName = "The automated test group";
  const group_subjectID = "totallyuuid-group";

  const groupData = {
    "primaryEmail": primaryEmail,
    "groupName": groupName,
    "subjectID": subjectID
  };

  const name = "Automated";
  const surname = "APITest";
  const generatedUsername = name.toLowerCase()+"."+surname.toLowerCase()+"@aegee.eu";
  const email = "alternatemail817263@mailinator.com";
  const antenna = "AEGEE-Tallahassee";
  const password = "AEGEE-Europe";
  const SHA1Password = crypto.createHash('sha1').update(JSON.stringify(password)).digest('hex');
  const user_subjectID = "totallyuuid-account"

  const accountData = {
    "primaryEmail": generatedUsername,
    "name": {
      "givenName": name,
      "familyName": surname
    },
    "password": SHA1Password,
    "hashFunction": "SHA-1",
    "emails": [
    {
      "address": email,
      "type": "home",
      "customType": "",
      "primary": true
    }
    ],
    "organizations": [
    {
        "department": antenna
    }
    ],
    "orgUnitPath": "/individuals",
    "includeInGlobalAddressList": true
  }

  const data = {
    "operation": "add",
    "groupPK": group_subjectID
  }

  before("add group and user", async () => {
    let result = await runGsuiteOperation(gsuiteOperations.addGroup, groupData);
    console.log(result);
    result = await runGsuiteOperation(gsuiteOperations.addAccount, accountData);
    console.log(result);
  });

  describe('PUT /account/:username/group', function(){  
    
    it('Should make a membership if valid', async () => {
      
      const payload = data;

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(201);
      body.success.should.equal(true);
      
    });
    
    
  });
});
