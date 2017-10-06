Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/xenial64"
  config.vm.hostname = "appserver.dev"
  config.vm.network :private_network, ip: "192.168.192.168"

  config.vm.provider :virtualbox do |vb|
    vb.customize [
      "modifyvm", :id,
      "--memory", "1024",
      "--name", "appserver-docker-AEGEE-wow",
    ]
  end

  config.vm.define "appserver"

  #Port forwarding
  #SSH from anywhere on the network (sshd)
  config.vm.network :forwarded_port, guest: 22, host: 2222, host_ip: "0.0.0.0", id: "ssh", auto_correct: true
  
  
  #sync of folders (only for dev purpose)
  #config.vm.synced_folder "./oms-core",              "/home/vagrant/oms-docker/oms-core"
  #config.vm.synced_folder "./oms-events",              "/home/vagrant/oms-docker/oms-events"
  #config.vm.synced_folder "./oms-events-frontend",              "/home/vagrant/oms-docker/oms-events-frontend"

  #install docker and docker-composer the easy way
  config.vm.provision "shell", path: "vagrant-post-script/install_docker.sh"
  config.vm.provision "shell", path: "vagrant-post-script/install_docker_composer.sh"
  
  #config.vm.provision "docker" do |d|
    #d.pull_images "laradock/php-fpm:7.0--1.2"
    #d.pull_images "laradock/workspace:1.2"
    #d.pull_images "tianon/true"
    #d.pull_images "postgres:latest"
    #d.pull_images "fenglc/pgadmin4"
    #d.pull_images "node:7"
    #d.pull_images "nginx:alpine"
    #d.pull_images "mongo:latest"
    #d.build_image "/vagrant/app"
  #end
  
  ##TODO: change folders name (/home/vagrant becomes /home/ubuntu) and find other way to check if it was cloned recursive (but also: is it needed? do we need to clone the repo for dev?)
  #config.vm.provision "shell", path: "vagrant-post-script/check_cloned_recursively.sh"
  #provision docker orchestration (set to always run)
  #config.vm.provision "shell", path: "vagrant-post-script/orchestrate_docker.sh", run: "always"

  config.vm.post_up_message = "Setup is complete, now open your browser to http://blc.dev (did you configure /etc/hosts?)"
  
end
