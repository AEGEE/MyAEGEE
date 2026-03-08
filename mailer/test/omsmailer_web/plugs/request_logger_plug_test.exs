defmodule OmsmailerWeb.RequestLoggerPlugTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

  alias OmsmailerWeb.RequestLoggerPlug
  alias Plug.Conn
  alias Plug.Test

  test "redacts sensitive request params from POST logs" do
    conn =
      Test.conn("POST", "/", %{})
      |> Map.put(:params, %{
        "template" => "custom.html",
        "to" => ["recipient@aegee.org"],
        "cc" => ["copy@aegee.org"],
        "bcc" => ["blind@aegee.org"],
        "from" => "mailer@aegee.org",
        "token" => "secret-token",
        "parameters" => %{
          "access_token" => "nested-secret",
          "body" => "hello"
        }
      })
      |> RequestLoggerPlug.call(:warn)

    log = capture_log([level: :warn], fn -> Conn.send_resp(conn, 200, "ok") end)

    assert log =~ "\"to\": \"[REDACTED]\""
    assert log =~ "\"cc\": \"[REDACTED]\""
    assert log =~ "\"bcc\": \"[REDACTED]\""
    assert log =~ "\"from\": \"[REDACTED]\""
    assert log =~ "\"token\": \"[REDACTED]\""
    assert log =~ "\"access_token\": \"[REDACTED]\""
    refute log =~ "recipient@aegee.org"
    refute log =~ "copy@aegee.org"
    refute log =~ "blind@aegee.org"
    refute log =~ "mailer@aegee.org"
    refute log =~ "secret-token"
    refute log =~ "nested-secret"
  end
end
