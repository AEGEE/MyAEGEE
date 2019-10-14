Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-18.04"
  config.vm.hostname = "appserver.test"
  config.vm.network :private_network, ip: "192.168.168.168"

  config.vm.provider :virtualbox do |vb|
    vb.customize [
      "modifyvm", :id,
      "--name", "appserver-docker-AEGEE",
      "--memory", "3076",
    ]
  end

  config.vm.define "appserver"

  #Port forwarding
  # NOTE: there could be a different script that sets the resolv.conf and then
  # calls vagrant up
  #SSH from anywhere on the network (sshd)
  config.vm.network :forwarded_port, guest: 22, host: 2222, host_ip: "0.0.0.0", id: "ssh", auto_correct: true
  #In case somebody does not use "appserver" but "localhost"
  config.vm.network :forwarded_port, guest: 80, host: 8888, id: "main"


  #make it work also for windows
  config.vm.provision "shell", inline: "apt-get install dos2unix -qq -y; cd /vagrant && dos2unix *.sh; dos2unix vagrant-post-script/*.sh"

  #nice-to-have prompt and completion
  config.vm.provision "shell", inline: "cat /vagrant/vagrant-post-script/bashrc > /home/vagrant/.bashrc"

  #install docker and docker-composer the easy way
  config.vm.provision "shell", path: "vagrant-post-script/install_docker.sh"
  config.vm.provision "shell", path: "vagrant-post-script/install_docker_composer.sh"

  #provision docker orchestration (set to always run)
  config.vm.provision "shell", path: "vagrant-post-script/orchestrate_docker.sh", run: "always"

  config.vm.post_up_message = "[FINALLY!] Setup is complete, open your browser to http://my.appserver.test (did you configure /etc/hosts?)"

end
