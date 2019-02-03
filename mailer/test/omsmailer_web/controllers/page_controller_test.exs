defmodule OmsmailerWeb.PageControllerTest do
  use OmsmailerWeb.ConnCase
  use Bamboo.Test

  @confirm_email_params %{name: "test", surname: "user", token: "abcdef123456789"}


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
  test "POST / confirm_email", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end
  
  # Test headers
  test "POST / confirm_email requires parameters", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: %{}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end 
  test "POST / confirm_email requires to address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end 
  test "POST / confirm_email requires subject", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: ""}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end

  test "POST / with invalid template renders 404", %{conn: conn} do
    conn = post conn, "/", %{template: "really_long_nonexistent_template.html", parameters: %{}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 404)
    assert_no_emails_delivered()
  end

  test "POST / conferm_email per default puts the from address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(from: {nil, Application.get_env(:omsmailer, :from_address)})
  end

  test "POST / confirm_email allows for custom from address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates", from: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(from: {nil, "someweird@aegee.org"})
  end

  test "POST / confirm_email allows for cc address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates", cc: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(cc: [nil: "someweird@aegee.org"])
  end

  test "POST / confirm_email allows for bcc address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates", bcc: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(bcc: [nil: "someweird@aegee.org"])
  end

  test "POST / confirm_email allows for reply_to address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates", reply_to: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(headers: %{"Reply-To" => "someweird@aegee.org"})
  end

  # Custom works
  test "POST / custom", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: %{body: "<b>custom html code here</b>"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Password reset works
  test "POST / password reset", %{conn: conn} do
    conn = post conn, "/", %{template: "password_reset.html", parameters: %{token: "astdefern1234"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  test "POST / allows for several recipients", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: %{body: "huhu"}, to: ["test1@aegee.org", "test2@aegee.org", "test3@aegee.org"], subject: "pirates"}
    assert json_response(conn, 200)
    # I have no clue why the nil: thing is necessary...
    assert_email_delivered_with(to: [nil: "test1@aegee.org"])
    assert_email_delivered_with(to: [nil: "test2@aegee.org"])
    assert_email_delivered_with(to: [nil: "test3@aegee.org"])
  end

  test "POST / allows for several recipients with custom template parameters", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: [%{body: "huhu1"}, %{body: "huhu2"}, %{body: "huhu3"}], to: ["test1@aegee.org", "test2@aegee.org", "test3@aegee.org"], subject: "pirates"}
    assert json_response(conn, 200)
    # I have no clue why the nil: thing is necessary...
    # I also have no clue why the :ok thing is necessary
    assert_email_delivered_with(to: [nil: "test1@aegee.org"], html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "custom.html", parameters: %{"body" => "huhu1"}))
    assert_email_delivered_with(to: [nil: "test2@aegee.org"], html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "custom.html", parameters: %{"body" => "huhu2"}))
    assert_email_delivered_with(to: [nil: "test3@aegee.org"], html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "custom.html", parameters: %{"body" => "huhu3"}))
  end

  test "POST / autocompletes template file", %{conn: conn} do
    conn = post conn, "/", %{template: "custom", parameters: %{body: "huhu"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Welcome works
  test "POST / welcome", %{conn: conn} do
    conn = post conn, "/", %{template: "welcome.html", parameters: %{name: "Franz", surname: "Ferdinant"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end    

  # Membership expired
  test "POST / membership expired", %{conn: conn} do
    conn = post conn, "/", %{template: "membership_expired.html", parameters: %{body: "AEGEE-Dresden", last_payment: "2018-11-23T08:51:04.038159"}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Statutory applied
  test "POST / statutory applied", %{conn: conn} do
    conn = post conn, "/", %{template: "statutory_applied.html", parameters: %{event: %{name: "test" }, application: %{}}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Statutory edited
  test "POST / statutory edited", %{conn: conn} do
    conn = post conn, "/", %{template: "statutory_edited.html", parameters: %{event: %{name: "test" }, application: %{}}, to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end
end
