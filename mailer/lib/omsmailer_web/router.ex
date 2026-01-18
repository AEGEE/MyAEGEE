defmodule OmsmailerWeb.Router do
  use OmsmailerWeb, :router

  pipeline :api do
    plug OmsmailerWeb.RequestLoggerPlug
    plug :accepts, ["json"]
  end

  scope "/", OmsmailerWeb do
    pipe_through :api # Use the default browser stack

    get "/", PageController, :index
    get "/healthcheck", PageController, :healthcheck
    post "/", PageController, :send_mail
  end

  # Other scopes may use custom stacks.
  # scope "/api", OmsmailerWeb do
  #   pipe_through :api
  # end
end
