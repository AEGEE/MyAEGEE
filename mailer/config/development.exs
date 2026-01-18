use Mix.Config

config :omsmailer, OmsmailerWeb.Endpoint,
  load_from_system_env: true

config :logger, level: :debug

config :omsmailer, OmsmailerWeb.Endpoint,
  secret_key_base: "test"
