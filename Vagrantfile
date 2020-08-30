Vagrant.configure("2") do |config|
  config.vm.define "prod", primary: true do |prod|
    prod.vm.box = "bento/ubuntu-18.04"
    prod.vm.hostname = "appserver.test"
    prod.vm.network :private_network, ip: "192.168.168.168"

    prod.vm.provider :virtualbox do |vb|
      vb.customize [
        "modifyvm", :id,
        "--name", "appserver-docker-AEGEE",
        "--memory", "2048",
      ]
    end

    prod.vm.define "appserver"

    #Port forwarding
    # NOTE: there could be a different script that sets the resolv.conf and then
    # calls vagrant up
    #SSH from anywhere on the network (sshd)
    prod.vm.network :forwarded_port, guest: 22, host: 2222, host_ip: "127.0.0.1", id: "ssh", auto_correct: true
    #In case somebody does not use "appserver" but "localhost"
    prod.vm.network :forwarded_port, guest: 80, host: 8888, id: "main"


    #make it work also for windows
    prod.vm.provision "shell", inline: "apt-get install dos2unix -qq -y; cd /vagrant && dos2unix *.sh; dos2unix vagrant-post-script/*.sh"

    #nice-to-have prompt and completion
    prod.vm.provision "shell", inline: "dos2unix /vagrant/vagrant-post-script/bashrc; cat /vagrant/vagrant-post-script/bashrc > /home/vagrant/.bashrc"

    #install docker and docker-composer the easy way
    prod.vm.provision "shell", path: "vagrant-post-script/install_docker.sh"
    prod.vm.provision "shell", path: "vagrant-post-script/install_docker_composer.sh"

    #provision docker orchestration (set to always run)
    prod.vm.provision "shell", path: "vagrant-post-script/orchestrate_docker.sh", run: "always"

    prod.vm.post_up_message = "[FINALLY!] Setup is complete, open your browser to http://my.appserver.test (did you configure /etc/hosts?)"

  end

  config.vm.define "futprod" do |futprod|
    futprod.vm.box = "bento/ubuntu-18.04"
    futprod.vm.hostname = "fappserver.test"
    futprod.vm.network :private_network, ip: "192.168.169.168"

    futprod.vm.provider :virtualbox do |vb|
      vb.customize [
        "modifyvm", :id,
        "--name", "fappserver-docker-AEGEE",
        "--memory", "2048",
      ]
    end

    futprod.vm.define "fappserver"

    #make it work also for windows
    futprod.vm.provision "shell", inline: "apt-get install dos2unix -qq -y; cd /vagrant && dos2unix *.sh; dos2unix vagrant-post-script/*.sh"

    #nice-to-have prompt and completion
    futprod.vm.provision "shell", inline: "dos2unix /vagrant/vagrant-post-script/bashrc; cat /vagrant/vagrant-post-script/bashrc > /home/vagrant/.bashrc"

    #install docker and docker-composer the easy way
    futprod.vm.provision "shell", path: "vagrant-post-script/install_docker.sh"
    futprod.vm.provision "shell", path: "vagrant-post-script/install_docker_composer.sh"

    #provision docker orchestration (set to always run)
    futprod.vm.provision "shell", path: "vagrant-post-script/orchestrate_docker.sh", run: "always"

    futprod.vm.post_up_message = "[FINALLY!] Setup is complete, open your browser to http://my.fappserver.test (did you configure /etc/hosts?)"

  end

end
