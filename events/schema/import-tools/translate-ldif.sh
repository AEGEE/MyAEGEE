#!/bin/sh

cd /tmp
mkdir ldif_output
cp /var/opt/aegee/aegee.schema .
echo "
include /etc/ldap/schema/core.schema
include /etc/ldap/schema/cosine.schema
include /etc/ldap/schema/dyngroup.schema
include /etc/ldap/schema/inetorgperson.schema
include /etc/ldap/schema/nis.schema
include /etc/ldap/schema/openldap.schema
include /tmp/aegee.schema
" > schema_convert.conf

/usr/sbin/slaptest -f schema_convert.conf -F ldif_output

cp /tmp/ldif_output/cn=config/cn=schema/cn*aegee.ldif /tmp/aegee-fix.ldif

#lines that edit /tmp/ldif_output/cn=config/cn=schema/cn=\{11\}aegee.ldif
#change:
#dn: cn=misc,cn=schema,cn=config
#...
#cn: misc
#And remove the following lines from the bottom of the file:
#structuralObjectClass: olcSchemaConfig
#entryUUID: 10dae0ea-0760-102d-80d3-f9366b7f7757
#creatorsName: cn=config
#createTimestamp: 20080826021140Z
#entryCSN: 20080826021140.791425Z#000000#000#000000
#modifiersName: cn=config
#modifyTimestamp: 20080826021140Z

#removing: sed is slow, use /usr/bin/head -n -7 /tmp/aegee.ldif

/bin/sed 's/{[0-9]*}aegee/aegee/' /tmp/aegee-fix.ldif > /tmp/aegee-sed.ldif

#this should be in the file already but for some reason it is not!
/bin/sed 's/dn\: cn\=aegee/dn\: cn\=aegee, cn\=schema, cn\=config/' /tmp/aegee-sed.ldif > /tmp/aegee-sch.ldif

/usr/bin/head -n -7 /tmp/aegee-sch.ldif > /tmp/aegee.ldif

sudo mv /tmp/aegee.ldif /var/opt/aegee/aegee.ldif

#THIS WORKS (note the sudo)
#sudo ldapadd -Y EXTERNAL -H ldapi:/// -f /tmp/aegee.ldif
#commented as part of the other script

#THIS DOES NOT WORK
#ldapadd -x -D "cn=admin,o=aegee,c=eu" -f /tmp/aegee.ldif -w admin

