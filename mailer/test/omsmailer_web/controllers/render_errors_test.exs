defmodule OmsmailerWeb.RenderErrorsTest do
  # A mail whose parameters the template can't render is answered with 422 and the
  # JSON error body, like a missing key, and nothing is sent.
  use OmsmailerWeb.ConnCase
  use Bamboo.Test

  defp post_mail(conn, template, parameters) do
    body = %{template: template, parameters: parameters, to: "test@aegee.org", subject: "pirates"}

    conn
    |> put_req_header("content-type", "application/json")
    |> post("/", Jason.encode!(body))
  end

  @board %{"elected_date" => "2026-04-01", "start_date" => "2026-05-01", "end_date" => "2027-04-30", "message" => "Hello"}
  @positions [%{"function" => "President", "name" => "Ada Lovelace"}]

  test "a missing value in the subject line of the template answers 422", %{conn: conn} do
    conn = post_mail(conn, "network_new_board.html", %{board: @board, positions: @positions})

    assert %{"success" => false, "error" => error} = json_response(conn, 422)
    assert error =~ "Could not render network_new_board.html"
    assert_no_emails_delivered()
  end

  test "a missing list the template loops over answers 422", %{conn: conn} do
    conn = post_mail(conn, "network_new_board.html", %{board: @board, body_name: "AEGEE-Delft"})

    assert %{"success" => false, "error" => error} = json_response(conn, 422)
    assert error =~ "Could not render network_new_board.html"
    assert_no_emails_delivered()
  end

  test "a missing list of questions answers 422", %{conn: conn} do
    conn = post_mail(conn, "events_applied.html", %{event: %{name: "Event"}, application: %{first_name: "Ada"}})

    assert %{"success" => false, "error" => error} = json_response(conn, 422)
    assert error =~ "Could not render events_applied.html"
    assert_no_emails_delivered()
  end

  test "an object where the template prints a text answers 422", %{conn: conn} do
    conn = post_mail(conn, "confirm_email.html", %{name: %{first: "Ada"}, surname: "Lovelace", token: "abc"})

    assert %{"success" => false, "error" => error} = json_response(conn, 422)
    assert error =~ "Could not render confirm_email.html"
    assert_no_emails_delivered()
  end

  test "the error names neither the parameter values nor the recipients", %{conn: conn} do
    conn = post_mail(conn, "confirm_email.html", %{name: %{passport: "X1234567"}, surname: "Lovelace", token: "abc"})

    error = json_response(conn, 422)["error"]
    refute error =~ "X1234567"
    refute error =~ "test@aegee.org"
  end

  test "one list entry that can't be rendered answers 422 and sends none of the mails", %{conn: conn} do
    body = %{
      template: "network_new_board.html",
      parameters: [%{board: @board, body_name: "AEGEE-Delft", positions: @positions}, %{board: @board, positions: @positions}],
      to: ["first@aegee.org", "second@aegee.org"],
      subject: "pirates"
    }

    conn =
      conn
      |> put_req_header("content-type", "application/json")
      |> post("/", Jason.encode!(body))

    assert json_response(conn, 422)["error"] =~ "Could not render network_new_board.html"
    assert_no_emails_delivered()
  end
end
