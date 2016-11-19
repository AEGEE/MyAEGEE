Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.hostname = "myprecise.box"
  config.vm.network :private_network, ip: "192.168.8.42"

  config.vm.provider :virtualbox do |vb|
    vb.customize [
      "modifyvm", :id,
#      "--cpuexecutioncap", "50",
      "--memory", "1024",
    ]
    vb.name = "docker-AEGEE"
  end
  #AEGEE stuff
  #SSH from anywhere on the network (sshd)
  config.vm.network :forwarded_port, guest: 22, host: 2222, host_ip: "0.0.0.0", id: "ssh", auto_correct: true
  #end AEGEE stuff

  config.vm.provision "shell", path: "install_docker.sh"

end
