#!/usr/bin/python
#Python 2.7: ok, 3.3: unknown

inputFile = open('CSV-antennae.csv','r')
lines = [line.strip() for line in inputFile]

for line in lines:
	
	stuff= line.split(",")
	bodyname = stuff[0].replace('"', '').strip()
	unicodestring= bodyname.decode("utf-8")#TODO the encoding has to be handled better: Bucuresti, Baki, and so on lose characters
	bodynameascii= unicodestring.encode("ascii","ignore") #TODO
	bodycode = stuff[1].replace('"', '').strip()
	bodystatus = stuff[2].replace('"', '').strip()

	blob="""
	dn: bodycode=%s,ou=antennae,o=aegee,c=eu
	objectclass: aegeeBodyFab
	bodycode: %s
	bodynameascii: %s
	mail: %s@aegee.org
	netcom: ana.potocnik
	bodystatus: %s
	o: something
	""" % (bodycode, bodycode, bodynameascii, bodynameascii.lower(), bodystatus)

	with open('antennae.ldif','a') as f: f.write(blob) 

