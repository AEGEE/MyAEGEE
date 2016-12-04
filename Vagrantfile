Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.hostname = "myprecise.box"
  config.vm.network :private_network, ip: "192.168.192.168"

  config.vm.provider :virtualbox do |vb|
    vb.customize [
      "modifyvm", :id,
      "--memory", "1024",
      "--name", "badass-docker-AEGEE",
    ]
  end

  config.vm.define "badass"

  #Port forwarding
  #SSH from anywhere on the network (sshd)
  config.vm.network :forwarded_port, guest: 22, host: 2222, host_ip: "0.0.0.0", id: "ssh", auto_correct: true
  #forward 8083 for API of events module (needed by events frontend), error if port busy
  config.vm.network :forwarded_port, guest: 8083, host: 8083, id: "events-API", auto_correct: false
  
  #sync of folders
  config.vm.synced_folder "./oms-core",              "/home/vagrant/oms-docker/oms-core"
  config.vm.synced_folder "./oms-events",              "/home/vagrant/oms-docker/oms-events"
  config.vm.synced_folder "./oms-events-frontend",              "/home/vagrant/oms-docker/oms-events-frontend"
  config.vm.synced_folder "./docker",              "/home/vagrant/oms-docker/docker"

  config.vm.provision "docker" do |d|
    d.pull_images "laradock/php-fpm:7.0--1.2"
    d.pull_images "laradock/workspace:1.2"
    d.pull_images "tianon/true"
    d.pull_images "postgres:latest"
    d.pull_images "fenglc/pgadmin4"
    d.pull_images "node:7"
    d.pull_images "nginx:alpine"
    d.pull_images "mongo:latest"
    #d.build_image "/vagrant/app"
  end

  #install docker composer the easy way
  config.vm.provision "shell", path: "vagrant-post-script/install_docker_composer.sh"
  #provision docker orchestration
  config.vm.provision "shell", path: "vagrant-post-script/orchestrate_docker.sh"

end
