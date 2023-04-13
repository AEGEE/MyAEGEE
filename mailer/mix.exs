defmodule Omsmailer.Mixfile do
  use Mix.Project

  def project do
    [
      app: :omsmailer,
      version: "0.0.1",
      elixir: "~> 1.10",
      elixirc_paths: elixirc_paths(Mix.env),
      compilers: Mix.compilers,
      start_permanent: Mix.env == :production,
      #aliases: aliases(),
      deps: deps(),
      test_coverage: [tool: ExCoveralls],
      preferred_cli_env: [coveralls: :test, "coveralls.detail": :test, "coveralls.post": :test, "coveralls.html": :test]
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {Omsmailer.Application, []},
      extra_applications: [:logger, :runtime_tools, :bamboo, :bamboo_smtp]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_),     do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:phoenix, "~> 1.6"},
      {:phoenix_pubsub, "~> 2.0"},
      {:phoenix_html, "~> 2.14"},
      {:phoenix_view, "~> 2.0"},
      {:gettext, "~> 0.11"},
      {:bamboo, "~> 1.1"},
      {:bamboo_smtp, "~> 1.6.0"},
      {:jason, "~> 1.0"},
      {:plug_cowboy, "~> 2.2"},
      {:cowboy, "~> 2.7"},
      {:excoveralls, "~> 0.10", only: :test}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to create, migrate and run the seeds file at once:
  #
  #     $ mix ecto.setup
  #
  # See the documentation for `Mix` for more info on aliases.

end
