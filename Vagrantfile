Vagrant.configure("2") do |config|
  #Machine name for Vagrant, and machine type
  config.vm.define "appserver"
  config.vm.box = "bento/ubuntu-18.04"

  #Machine name for virtualbox, and RAM size
  config.vm.provider :virtualbox do |vb|
    vb.customize [
      "modifyvm", :id,
      "--name", "appserver-docker-AEGEE",
      "--memory", "2048",
    ]
  end

  # Avoids wasting time on virtualbox guest additions mismatch
  config.vbguest.auto_update = false

  ## Network configurations ##
  config.vm.hostname = "appserver.test"
  config.vm.network :private_network, ip: "192.168.168.168"
  ## Port forwarding
  #NOTE: there could be a different script that sets the resolv.conf and then
  # calls vagrant up
  #If you want to SSH from anywhere on the network (sshd) uncomment this
  #config.vm.network :forwarded_port, guest: 22, host: 2222, host_ip: "127.0.0.1", id: "ssh", auto_correct: true
  #In case somebody does not use "appserver" but "localhost" uncomment this
  #config.vm.network :forwarded_port, guest: 80, host: 8888, id: "main", auto_correct: true

  ## Provisioning scripts ##
  #make it work also when windows messes up the line ending
  config.vm.provision "shell", inline: "apt-get install dos2unix -qq -y; cd /vagrant && dos2unix *.sh; dos2unix scripts-vagrant_provision/*.sh"
  config.vm.provision "shell", privileged: false, path: "scripts-vagrant_provision/prerequisites.sh"

  #install docker and docker-composer the easy way
  config.vm.provision "shell", path: "scripts-vagrant_provision/install_docker.sh"
  config.vm.provision "shell", path: "scripts-vagrant_provision/install_docker_compose.sh"
  config.vm.provision "shell", path: "scripts-vagrant_provision/install_other_utils.sh"

  #nice-to-have prompt and completion
  config.vm.provision "shell", inline: "dos2unix /vagrant/scripts-vagrant_provision/bashrc; cat /vagrant/scripts-vagrant_provision/bashrc > /home/vagrant/.bashrc"

  #provision docker orchestration (set to always run)
  config.vm.provision "shell", path: "scripts-vagrant_provision/orchestrate_docker.sh", run: "always"

  config.vm.post_up_message = "[FINALLY!] Setup is complete, open your browser to http://my.appserver.test (did you configure /etc/hosts?)"

  ## Deprovisioning scripts ##
  config.trigger.before :destroy do |trigger|
    trigger.warn = "Removing .init to avoid Docker network mismatch"
    trigger.run_remote = { inline: "rm /vagrant/.init 2>/dev/null || echo 'file already gone'" }
  end

end
