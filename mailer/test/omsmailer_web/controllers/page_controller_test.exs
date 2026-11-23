defmodule OmsmailerWeb.PageControllerTest do
  use OmsmailerWeb.ConnCase
  use Bamboo.Test

  @confirm_email_params %{name: "test", surname: "user", token: "abcdef123456789"}


  # A get just returns success:true, kind of a status check
  test "GET /", %{conn: conn} do
    conn = get conn, "/"
    assert json_response(conn, 200)
  end

  # test "GET /healthcheck", %{conn: conn} do
  #   conn = get conn, "/healthcheck"
  #   assert json_response(conn, 200)
  # end

  # Tests test template
  test "POST / default template", %{conn: conn} do
    conn = post conn, "/", %{template: "index.html", parameters: %{heading: "pirates!"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Signup link works
  test "POST / confirm_email", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Test headers
  test "POST / confirm_email requires parameters", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: %{}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end
  test "POST / confirm_email requires to address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end
  test "POST / confirm_email requires subject", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "mailer@aegee.org", to: "test@aegee.org", subject: ""}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end

  test "POST / rejects a list with an empty recipient and sends nothing", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "mailer@aegee.org", to: ["test@aegee.org", nil], subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end
  test "POST / rejects more template bodies than recipients", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: [%{email_body: "one"}, %{email_body: "two"}, %{email_body: "three"}], from: "mailer@aegee.org", to: ["first@aegee.org", "second@aegee.org"], subject: "pirates"}
    assert json_response(conn, 422)["error"] =~ "Mismatch in amounts of mails"
    assert_no_emails_delivered()
  end
  test "POST / rejects an empty from address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end

  test "POST / with invalid template renders 404", %{conn: conn} do
    conn = post conn, "/", %{template: "really_long_nonexistent_template.html", parameters: %{}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 404)
    assert_no_emails_delivered()
  end

  test "POST / confirm_email allows for custom from address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, to: "test@aegee.org", subject: "pirates", from: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(from: {nil, "someweird@aegee.org"})
  end

  test "POST / confirm_email allows for cc address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates", cc: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(cc: [nil: "someweird@aegee.org"])
  end

  test "POST / confirm_email allows for bcc address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates", bcc: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(bcc: [nil: "someweird@aegee.org"])
  end

  test "POST / confirm_email allows for reply_to address", %{conn: conn} do
    conn = post conn, "/", %{template: "confirm_email.html", parameters: @confirm_email_params, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates", reply_to: "someweird@aegee.org"}
    assert json_response(conn, 200)
    assert_email_delivered_with(headers: %{"Reply-To" => "someweird@aegee.org"})
  end

  # Custom works
  test "POST / custom", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: %{email_body: "<b>custom html code here</b>"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Password reset works
  test "POST / password reset", %{conn: conn} do
    conn = post conn, "/", %{template: "password_reset.html", parameters: %{token: "astdefern1234"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Mail change works, with the parameters core sends
  test "POST / mail change", %{conn: conn} do
    conn = post conn, "/", %{template: "mail_change.html", parameters: %{token: "astdefern1234", name: "Name", surname: "Surname"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Mail change, asked by somebody else: the current address has to confirm
  test "POST / mail_change_old_confirm", %{conn: conn} do
    conn = post conn, "/", %{template: "mail_change_old_confirm.html", parameters: %{name: "Franz", surname: "Ferdinant", new_email: "new.address@example.org", requester_name: "Board Member", requester_email: "board.member@example.org", requester_body: "AEGEE-Somewhere", token: "astdefern1234"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates", html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_old_confirm.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "requester_name" => "Board Member", "requester_email" => "board.member@example.org", "requester_body" => "AEGEE-Somewhere", "token" => "astdefern1234"}))
  end

  test "POST / mail_change_old_confirm requires the token", %{conn: conn} do
    conn = post conn, "/", %{template: "mail_change_old_confirm.html", parameters: %{name: "Franz", surname: "Ferdinant", new_email: "new.address@example.org", requester_name: "Board Member", requester_email: "board.member@example.org", requester_body: "AEGEE-Somewhere"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 422)
    assert_no_emails_delivered()
  end

  test "mail_change_old_confirm shows the member, the requester, the new address and the token" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_old_confirm.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "requester_name" => "Board Member", "requester_email" => "board.member@example.org", "requester_body" => "AEGEE-Somewhere", "token" => "astdefern1234"})
    assert String.contains?(res, "<title>MyAEGEE: Confirm the change of your email</title>")
    assert String.contains?(res, "Hello Franz Ferdinant")
    assert String.contains?(res, "Board Member (board.member@example.org), who manages the members of AEGEE-Somewhere, asked to change the login email of your MyAEGEE account to new.address@example.org.")
    assert String.contains?(res, "href=\"https://my.aegee.eu/mail-change?token=astdefern1234\"")
    assert String.contains?(res, "<i>astdefern1234</i>")
    assert String.contains?(res, "The new address has to confirm the change as well.")
    assert String.contains?(res, "Only confirm if you asked for this and the new address is yours.")
    assert String.contains?(res, "If you did not expect this mail, do not confirm and contact the Helpdesk: <a href=\"http://aegee.org/helpdesk\">")
    refute String.contains?(res, "just ignore this email")
  end

  test "mail_change_old_confirm escapes html in the parameters" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_old_confirm.html", parameters: %{"name" => "<i>Franz</i>", "surname" => "<u>Ferdinant</u>", "new_email" => "<script>new</script>@example.org", "requester_name" => "<b>x</b>", "requester_email" => "<em>mail</em>@example.org", "requester_body" => "<s>AEGEE</s>", "token" => "\"><b>token</b>"})
    assert String.contains?(res, "&lt;i&gt;Franz&lt;/i&gt; &lt;u&gt;Ferdinant&lt;/u&gt;")
    assert String.contains?(res, "&lt;script&gt;new&lt;/script&gt;@example.org")
    assert String.contains?(res, "&lt;b&gt;x&lt;/b&gt; (&lt;em&gt;mail&lt;/em&gt;@example.org), who manages the members of &lt;s&gt;AEGEE&lt;/s&gt;, asked to change")
    assert String.contains?(res, "token=&quot;&gt;&lt;b&gt;token&lt;/b&gt;\"")
    refute String.contains?(res, "<i>Franz</i>")
    refute String.contains?(res, "<u>Ferdinant</u>")
    refute String.contains?(res, "<script>")
    refute String.contains?(res, "<b>x</b>")
    refute String.contains?(res, "<em>mail</em>")
    refute String.contains?(res, "<s>AEGEE</s>")
    refute String.contains?(res, "<b>token</b>")
  end

  test "mail_change_old_confirm renders with only the token" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_old_confirm.html", parameters: %{"token" => "astdefern1234"})
    assert String.contains?(res, "https://my.aegee.eu/mail-change?token=astdefern1234")
    assert String.contains?(res, "asked to change the login email of your MyAEGEE account")
  end

  # Mail change took effect: the old address gets a notice
  test "POST / mail_change_notice", %{conn: conn} do
    conn = post conn, "/", %{template: "mail_change_notice.html", parameters: %{name: "Franz", surname: "Ferdinant", new_email: "new.address@example.org", changed_by: "Board Member"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates", html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "changed_by" => "Board Member"}))
  end

  test "POST / mail_change_notice works without parameters", %{conn: conn} do
    conn = post conn, "/", %{template: "mail_change_notice.html", parameters: %{}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  test "mail_change_notice shows the member, the new address and who asked for the change" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "changed_by" => "Board Member"})
    assert String.contains?(res, "<title>MyAEGEE: Your email was changed</title>")
    assert String.contains?(res, "Hello Franz Ferdinant")
    assert String.contains?(res, "The login email of your MyAEGEE account was changed to new.address@example.org. The change was requested by Board Member.")
    assert String.contains?(res, "From now on you log in with the new address.")
    assert String.contains?(res, "contact the Helpdesk as soon as possible: <a href=\"http://aegee.org/helpdesk\">")
    refute String.contains?(res, "mail-change")
    refute String.contains?(res, "token")
  end

  test "mail_change_notice names the requester with their login email" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "changed_by" => "Board Member", "changed_by_email" => "board.member@example.org"})
    assert String.contains?(res, "The change was requested by Board Member (board.member@example.org).")
  end

  test "mail_change_notice shows no email when the member changed the address themselves" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "changed_by" => "yourself", "changed_by_email" => nil})
    assert String.contains?(res, "The change was requested by yourself.")
  end

  test "mail_change_notice escapes the requester's email" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"changed_by" => "x", "changed_by_email" => "<b>mail</b>@example.org"})
    assert String.contains?(res, "requested by x (&lt;b&gt;mail&lt;/b&gt;@example.org).")
    refute String.contains?(res, "<b>mail</b>")
  end

  test "mail_change_notice says so when the member changed the address themselves" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"name" => "Franz", "surname" => "Ferdinant", "new_email" => "new.address@example.org", "changed_by" => "yourself"})
    assert String.contains?(res, "The change was requested by yourself.")
  end

  test "mail_change_notice escapes html in the parameters" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{"name" => "<i>Franz</i>", "surname" => "<u>Ferdinant</u>", "new_email" => "<script>new</script>@example.org", "changed_by" => "<b>x</b>"})
    assert String.contains?(res, "&lt;i&gt;Franz&lt;/i&gt; &lt;u&gt;Ferdinant&lt;/u&gt;")
    assert String.contains?(res, "&lt;script&gt;new&lt;/script&gt;@example.org")
    assert String.contains?(res, "requested by &lt;b&gt;x&lt;/b&gt;.")
    refute String.contains?(res, "<i>Franz</i>")
    refute String.contains?(res, "<u>Ferdinant</u>")
    refute String.contains?(res, "<script>")
    refute String.contains?(res, "<b>x</b>")
  end

  test "mail_change_notice renders without parameters" do
    res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "mail_change_notice.html", parameters: %{})
    assert String.contains?(res, "The login email of your MyAEGEE account was changed")
  end

  test "POST / allows for several recipients", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: %{email_body: "huhu"}, from: "mailer@aegee.org", to: ["test1@aegee.org", "test2@aegee.org", "test3@aegee.org"], subject: "pirates"}
    assert json_response(conn, 200)
    # I have no clue why the nil: thing is necessary...
    assert_email_delivered_with(to: [nil: "test1@aegee.org"])
    assert_email_delivered_with(to: [nil: "test2@aegee.org"])
    assert_email_delivered_with(to: [nil: "test3@aegee.org"])
  end

  test "POST / allows for several recipients with custom template parameters", %{conn: conn} do
    conn = post conn, "/", %{template: "custom.html", parameters: [%{email_body: "huhu1"}, %{email_body: "huhu2"}, %{email_body: "huhu3"}], from: "mailer@aegee.org", to: ["test1@aegee.org", "test2@aegee.org", "test3@aegee.org"], subject: "pirates"}
    assert json_response(conn, 200)
    # I have no clue why the nil: thing is necessary...
    # I also have no clue why the :ok thing is necessary
    assert_email_delivered_with(to: [nil: "test1@aegee.org"], html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "custom.html", parameters: %{"email_body" => "huhu1"}))
    assert_email_delivered_with(to: [nil: "test2@aegee.org"], html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "custom.html", parameters: %{"email_body" => "huhu2"}))
    assert_email_delivered_with(to: [nil: "test3@aegee.org"], html_body: Phoenix.View.render_to_string(OmsmailerWeb.PageView, "custom.html", parameters: %{"email_body" => "huhu3"}))
  end

  test "POST / autocompletes template file", %{conn: conn} do
    conn = post conn, "/", %{template: "custom", parameters: %{email_body: "huhu"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # New member works
  test "POST / new_member", %{conn: conn} do
    conn = post conn, "/", %{template: "new_member.html", parameters: %{name: "Franz", surname: "Ferdinant"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Workspace new member works
  test "POST / workspace_new_member", %{conn: conn} do
    conn = post conn, "/", %{template: "workspace_new_member.html", parameters: %{member_firstname: "Franz", member_lastname: "Ferdinant", user_id: 1, member_email: "f.ferdinant@aegee.test"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Workspace deleted member works
  test "POST / workspace_deleted_member", %{conn: conn} do
    conn = post conn, "/", %{template: "workspace_deleted_member.html", parameters: %{member_firstname: "Franz", member_lastname: "Ferdinant", user_id: 1, member_workspace_email: "f.ferdinant@aegee.test"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Membership expired
  test "POST / membership expired", %{conn: conn} do
    conn = post conn, "/", %{template: "membership_expired.html", parameters: %{body: "AEGEE-Dresden", last_payment: "2018-11-23T08:51:04.038159"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Statutory applied
  test "POST / statutory applied should work with questions and answers", %{conn: conn} do
    question = %{"description" => "Phone number:", "required" => false, "type" => "string"}
    conn = post conn, "/", %{template: "statutory_applied.html", parameters: %{event: %{name: "test", questions: [question] }, application: %{answers: ["test"] } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Statutory edited
  test "POST / statutory edited should work with questions and answers", %{conn: conn} do
    question = %{"description" => "Phone number:", "required" => false, "type" => "string"}
    conn = post conn, "/", %{template: "statutory_edited.html", parameters: %{event: %{name: "test", questions: [question] }, application: %{answers: ["test"] } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Board statutory applied
  test "POST / statutory board applied should work with questions and answers", %{conn: conn} do
    question = %{"description" => "Phone number:", "required" => false, "type" => "string"}
    event = %{"name" =>  "test", "questions" => [question] }
    application = %{answers: ["test"] }

    conn = post conn, "/", %{template: "statutory_board_applied.html", parameters: %{ event: event, application: application }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Board statutory edited
  test "POST / statutory board edited should work with questions and answers", %{conn: conn} do
    question = %{"description" => "Phone number:", "required" => false, "type" => "string"}
    event = %{"name" =>  "test", "questions" => [question] }
    application = %{answers: ["test"] }

    conn = post conn, "/", %{template: "statutory_board_edited.html", parameters: %{ event: event, application: application }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Member joined
  test "POST / member joined", %{conn: conn} do
    conn = post conn, "/", %{template: "member_joined.html", parameters: %{body_name: "AEGEE-Dresden", body_id: 1, member_firstname: "Test", member_lastname: "Member"}, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Events status changed
  test "POST / event status changed should work", %{conn: conn} do
    conn = post conn, "/", %{template: "events_status_changed.html", parameters: %{
      event: %{name: "test", status: "draft" },
      old_status: "published"
    }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}

    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Events European status changed
  test "POST / event European status changed should work", %{conn: conn} do
    conn = post conn, "/", %{template: "events_european_status_changed.html", parameters: %{
      event: %{name: "test"}
    }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}

    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Events applied
  test "POST / events applied should work with questions and answers", %{conn: conn} do
    question = %{"description" => "Phone number:", "required" => false, "type" => "string"}
    conn = post conn, "/", %{template: "events_applied.html", parameters: %{event: %{name: "test", questions: [question] }, application: %{answers: ["test"] } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Events edited
  test "POST / events edited should work with questions and answers", %{conn: conn} do
    question = %{"description" => "Phone number:", "required" => false, "type" => "string"}
    conn = post conn, "/", %{template: "events_edited.html", parameters: %{event: %{name: "test", questions: [question] }, application: %{answers: ["test"] } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Events created
  test "POST / events event created should work", %{conn: conn} do
    conn = post conn, "/", %{template: "events_event_created.html", parameters: %{event: %{name: "test", url: "test" } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Events edited
  test "POST / events event updated should work", %{conn: conn} do
    conn = post conn, "/", %{template: "events_event_updated.html", parameters: %{event: %{name: "test", url: "test" } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Event submitted
  test "POST / event submitted should work", %{conn: conn} do
    conn = post conn, "/", %{template: "events_submitted.html", parameters: %{event: %{name: "test", url: "test" } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Candidature submitted
  test "POST / candidature submitted should work", %{conn: conn} do
    conn = post conn, "/", %{template: "candidate_applied.html", parameters: %{position: %{name: "test", event_id: "1"}, candidate: %{first_name: "test", last_name: "test"} }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Summer University event status changed
  test "POST / summeruniversity event status changed should work", %{conn: conn} do
    conn = post conn, "/", %{template: "summeruniversity_status_changed.html", parameters: %{
      event: %{name: "test", status: "first draft" },
      old_status: "first approval"
    }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}

    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Summer University event created
  test "POST / summeruniversity event created should work", %{conn: conn} do
    conn = post conn, "/", %{template: "summeruniversity_event_created.html", parameters: %{event: %{name: "test", url: "test" } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Summer University event edited
  test "POST / summeruniversity event updated should work", %{conn: conn} do
    conn = post conn, "/", %{template: "summeruniversity_event_updated.html", parameters: %{event: %{name: "test", url: "test" } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end

  # Summer University event submitted
  test "POST / summeruniversity event submitted should work", %{conn: conn} do
    conn = post conn, "/", %{template: "summeruniversity_submitted.html", parameters: %{event: %{name: "test", url: "test" } }, from: "mailer@aegee.org", to: "test@aegee.org", subject: "pirates"}
    assert json_response(conn, 200)
    assert_email_delivered_with(subject: "pirates")
  end
end
