defmodule OmsmailerWeb.RequestLoggerPlugTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureLog

  alias OmsmailerWeb.RequestLoggerPlug

  defp log_request(method, params) do
    conn =
      Plug.Test.conn(method, "/")
      |> Map.put(:params, params)
      |> RequestLoggerPlug.call(:warning)

    capture_log(fn -> Plug.Conn.send_resp(conn, 200, "ok") end)
  end

  defp logged_mail(log) do
    [_, mail] = Regex.run(~r/, mail: (\{.*\})/, log)
    Poison.decode!(mail)
  end

  test "logs the template, the subject and the parameter names, not the parameter values" do
    log = log_request("POST", %{
      "template" => "statutory_applied.html",
      "subject" => "Your application",
      "from" => "sender@example.org",
      "parameters" => %{
        "passport_number" => "PASSPORT-MARKER-7f3a",
        "date_of_birth" => "1990-01-01",
        "user" => %{"first_name" => "NAME-MARKER-7f3a", "notification_email" => "member@example.org"},
        "items" => [%{"code" => "DISCOUNT-MARKER-7f3a"}]
      }
    })

    assert log =~ "POST / 200"
    assert logged_mail(log) == %{
      "template" => "statutory_applied.html",
      "subject" => "Your application",
      "parameters" => ["date_of_birth", "items", "passport_number", "user"]
    }

    for value <- ~w(PASSPORT-MARKER-7f3a 1990-01-01 NAME-MARKER-7f3a member@example.org DISCOUNT-MARKER-7f3a sender@example.org) do
      refute log =~ value
    end
  end

  test "masks the recipients" do
    log = log_request("POST", %{
      "template" => "custom.html",
      "subject" => "pirates",
      "to" => ["recipient@example.org"],
      "cc" => "copy@example.org",
      "bcc" => ["blind@example.org"],
      "reply_to" => "reply@example.org",
      "parameters" => %{"body" => "hello"}
    })

    mail = logged_mail(log)

    for key <- ~w(to cc bcc reply_to) do
      assert mail[key] == "[REDACTED]"
    end

    for value <- ~w(recipient@example.org copy@example.org blind@example.org reply@example.org hello) do
      refute log =~ value
    end
  end

  test "logs no parameter names when the parameters are not a map" do
    upload = %Plug.Upload{filename: "file.txt", content_type: "text/plain", path: "/tmp/upload"}
    log = log_request("POST", %{"template" => "custom.html", "parameters" => upload})

    assert logged_mail(log) == %{"template" => "custom.html", "parameters" => []}
    refute log =~ "file.txt"
  end

  test "logs only the method, path, status and duration of other requests" do
    log = log_request("GET", %{"to" => "recipient@example.org"})

    assert log =~ ~r/GET \/ 200 \d+(µs|ms)/
    refute log =~ "mail:"
    refute log =~ "recipient@example.org"
  end
end
