Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-16.04"
  config.vm.hostname = "appserver.dev"
  config.vm.network :private_network, ip: "192.168.168.168"

  config.vm.provider :virtualbox do |vb|
    vb.customize [
      "modifyvm", :id,
      "--memory", "1024",
      "--name", "appserver-docker-AEGEE",
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
  
  
  #sync of folders (only for dev purpose)
  #config.vm.synced_folder "./oms-global",              "/home/vagrant/oms-docker/oms-global"
  #config.vm.synced_folder "./oms-core",              "/home/vagrant/oms-docker/oms-core"
  #config.vm.synced_folder "./oms-events",              "/home/vagrant/oms-docker/oms-events"
  #config.vm.synced_folder "./oms-events-frontend",              "/home/vagrant/oms-docker/oms-events-frontend"

  #make it work also for windows
  config.vm.provision "shell", inline: "apt-get install dos2unix -qq -y; cd /vagrant && dos2unix *.sh; dos2unix vagrant-post-script/*.sh"

  #nice-to-have prompt and completion
  config.vm.provision "shell", inline: "echo vagrant-post-script/bashrc >> /home/vagrant/.bashrc"
    
  #install docker and docker-composer the easy way
  config.vm.provision "shell", path: "vagrant-post-script/install_docker.sh"
  config.vm.provision "shell", path: "vagrant-post-script/install_docker_composer.sh"
  
  config.vm.provision "docker" do |d|
    d.pull_images "portainer/portainer:1.14.2"
    #d.pull_images "postgres:10.0"
    #d.pull_images "fenglc/pgadmin4:1.6"
    #d.pull_images "phusion/baseimage:0.9.22"
    #d.pull_images "laradock/php-fpm:1.4-71"
    #d.pull_images "nginx:alpine"
    #d.build_image "/vagrant/app"
  end
 
  #for users who just download the repo to 'vagrant up' it
  config.vm.provision "shell", path: "vagrant-post-script/check_cloned_recursively.sh"
  #provision docker orchestration (set to always run)
  config.vm.provision "shell", path: "vagrant-post-script/orchestrate_docker.sh", run: "always"

  config.vm.post_up_message = "[FINALLY!] Setup is complete, wait some minutes for the bootstrap of oms-core and then open your browser to http://appserver (did you configure /etc/hosts?)"
  
end
