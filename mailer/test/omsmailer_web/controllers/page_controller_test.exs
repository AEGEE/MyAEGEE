defmodule OmsmailerWeb.PageControllerTest do
  use OmsmailerWeb.ConnCase
  use Bamboo.Test


  # A get just returns success:true, kind of a status check
  test "GET /", %{conn: conn} do
    conn = get conn, "/"
    assert json_response(conn, 200)
  end

  # Tests test template
  test "POST / default template", %{conn: conn} do
    conn = post conn, "/", %{template: "index.html", parameters: %{heading: "pirates!"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Signup link works
  test "POST / signup", %{conn: conn} do
    conn = post conn, "/", %{template: "signup.html", parameters: %{name: "test", surname: "user", token: "abcdef123456789"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  test "POST / signup requires 3 parameters", %{conn: conn} do
    conn = post conn, "/", %{template: "signup.html", parameters: %{}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end
end
