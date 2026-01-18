defmodule OmsmailerWeb.FallbackController do
  use Phoenix.Controller

  def call(conn, {:error, status, message}) do
    conn
    |> put_status(status)
    |> put_view(OmsmailerWeb.ErrorView)
    |> render("error.json", message: message)
  end
end