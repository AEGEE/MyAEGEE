defmodule Omsmailer.ConfigTest do
  # The delivery and endpoint configuration the mailer runs with.
  use ExUnit.Case

  test "mails go to the mail transfer agent on port 25 without TLS, with retries" do
    config = Application.get_env(:omsmailer, Omsmailer.Mailer)

    # The tests swap the adapter only.
    assert config[:adapter] == Bamboo.TestAdapter
    assert config[:server] == "mail-transfer-agent"
    assert config[:port] == 25
    assert config[:tls] == :never
    assert config[:ssl] == false
    assert config[:retries] == 5
    assert config[:hostname] == "my.aegee.eu"
    assert config[:allowed_tls_versions] == [:"tlsv1.2", :"tlsv1.3"]
  end

  test "production sends with SMTP and takes its port from the environment" do
    # config.exs imports the file of Mix.env.
    previous = Mix.env()
    Mix.env(:production)
    config = try do
      Config.Reader.read!("config/config.exs", env: :production)
    after
      Mix.env(previous)
    end

    assert config[:omsmailer][Omsmailer.Mailer][:adapter] == Bamboo.SMTPAdapter
    assert config[:omsmailer][OmsmailerWeb.Endpoint][:load_from_system_env] == true
  end

  describe "the endpoint's port" do
    setup do
      previous = System.get_env("PORT")
      on_exit(fn -> if previous, do: System.put_env("PORT", previous), else: System.delete_env("PORT") end)
    end

    test "comes from PORT when configured to load it from the environment" do
      System.put_env("PORT", "4123")

      assert {:ok, config} = OmsmailerWeb.Endpoint.init(:supervisor, load_from_system_env: true)
      assert config[:http] == [:inet6, port: "4123"]
    end

    test "is required when configured to load it from the environment" do
      System.delete_env("PORT")

      assert_raise RuntimeError, ~r/PORT/, fn -> OmsmailerWeb.Endpoint.init(:supervisor, load_from_system_env: true) end
    end

    test "is left as configured otherwise" do
      assert OmsmailerWeb.Endpoint.init(:supervisor, http: [port: 4001]) == {:ok, [http: [port: 4001]]}
    end
  end

  test "a code change updates the endpoint configuration" do
    assert Omsmailer.Application.config_change([], [], []) == :ok
  end
end
