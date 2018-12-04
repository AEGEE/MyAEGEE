# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.
use Mix.Config

defmodule Helper do
  def read_secret_from_file(nil, fallback), do: fallback
  def read_secret_from_file(file, fallback) do
    case File.read(file) do
      {:ok, content} -> String.trim(content)
      {:error, _} -> fallback
    end
  end
end

# General application configuration
config :omsmailer,
  ecto_repos: [Omsmailer.Repo],
  from_address: "oms-mailer@aegee.org"


# Configures the endpoint
config :omsmailer, OmsmailerWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "I+MeRxrUZ0l32z+/5fQdAOW5SwXPFe05X1ucfslYI8rPXatFVczJFawXql7s9PBA",
  render_errors: [view: OmsmailerWeb.ErrorView, accepts: ~w(html json)],
  pubsub: [name: Omsmailer.PubSub,
           adapter: Phoenix.PubSub.PG2]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:user_id]

config :omsmailer, Omsmailer.Mailer,
  adapter: Bamboo.SMTPAdapter,
  server: "oms-mail-transfer-agent",
  hostname: "my.aegee.eu",
  port: 25,
  #username: Helper.read_secret_from_file(System.get_env("MAIL_USER"), "oms"), # or {:system, "SMTP_USERNAME"}
  #password: Helper.read_secret_from_file(System.get_env("MAIL_PASSWORD"), "oms"), # or {:system, "SMTP_PASSWORD"}
  tls: :never, # can be `:always` or `:never`
  allowed_tls_versions: [:tlsv1, :"tlsv1.1", :"tlsv1.2"], # or {":system", ALLOWED_TLS_VERSIONS"} w/ comma seprated values (e.g. "tlsv1.1,tlsv1.2")
  ssl: false, # can be `true`
  retries: 5,
  no_mx_lookups: false # can be `true`
  #auth: :always # can be `always`. If your smtp relay requires authentication set it to `always`.


# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env}.exs"
