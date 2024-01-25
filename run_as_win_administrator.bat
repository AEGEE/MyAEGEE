:: This batch file is helping the windows user to get set up.
:: after each step described in the terminal, press enter and do what it says next
@echo off
echo "This batch file is helping the windows user (you) to get set up."
echo "after each step described in the terminal, press enter and do what it says next"
echo ""
echo "copy and paste the following line in notepad that was opened for you"
echo "192.168.168.168 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test pgadmin.appserver.test"
notepad "C:\Windows\system32\drivers\etc\hosts"
echo ""
echo ""
vagrant plugin install vagrant-vbguest
echo "Delete the Vagrantfile, and rename Vagrantfile.windows to Vagrantfile"
pause
echo "now run 'vagrant up' in the folder you downloaded"
echo ""
echo "(that's the last step of the script!)"
pause
