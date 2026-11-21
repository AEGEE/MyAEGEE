defmodule OmsmailerWeb.RequestLoggerPlugTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

  alias OmsmailerWeb.RequestLoggerPlug

  defp log_request(params) do
    conn =
      Plug.Test.conn("POST", "/")
      |> Map.put(:params, params)
      |> RequestLoggerPlug.call(:warning)

    capture_log(fn -> Plug.Conn.send_resp(conn, 200, "ok") end)
  end

  test "redacts recipients and token/password-like params, also when nested" do
    log = log_request(%{
      "template" => "custom.html",
      "subject" => "pirates",
      "to" => ["recipient@aegee.org"],
      "cc" => "copy@aegee.org",
      "bcc" => ["blind@aegee.org"],
      "parameters" => %{
        "token" => "confirm-token",
        "user" => %{"Password" => "hunter2", "access_token" => "nested-token"},
        "items" => [%{"refresh_token" => "listed-token"}],
        "body" => "hello"
      }
    })

    for key <- ~w(to cc bcc token Password access_token refresh_token) do
      assert log =~ ~s("#{key}": "[REDACTED]")
    end

    for secret <- ~w(recipient@aegee.org copy@aegee.org blind@aegee.org confirm-token hunter2 nested-token listed-token) do
      refute log =~ secret
    end

    assert log =~ "custom.html"
    assert log =~ "pirates"
    assert log =~ "hello"
  end
end
