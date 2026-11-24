defmodule OmsmailerWeb.EndpointTest do
  # The HTTP API around the templates: health check, unknown templates, recipients and
  # headers, and what happens when a mail can't be handed to the mail server.
  use OmsmailerWeb.ConnCase
  use Bamboo.Test

  @valid %{template: "custom.html", parameters: %{email_body: "<p>Hello</p>"}, to: "member@example.org", subject: "Subject"}

  defp post_json(conn, body) do
    conn
    |> put_req_header("content-type", "application/json")
    |> post("/", Jason.encode!(body))
  end

  test "GET /healthcheck names the service and its version", %{conn: conn} do
    package = "package.json" |> File.read!() |> Jason.decode!()

    assert json_response(get(conn, "/healthcheck"), 200) == %{
             "success" => true,
             "data" => %{"name" => "mailer", "description" => package["description"], "version" => package["version"]}
           }
  end

  test "an unknown template answers 404 with the JSON error body", %{conn: conn} do
    conn = post_json(conn, %{@valid | template: "unknown_template.html"})

    assert %{"success" => false, "error" => "Template unknown_template.html not found" <> _} = json_response(conn, 404)
    assert_no_emails_delivered()
  end

  test "a template name can't reach outside the page templates", %{conn: conn} do
    conn = post_json(conn, %{@valid | template: "../snippets/css"})

    assert json_response(conn, 404)["success"] == false
    assert_no_emails_delivered()
  end

  test "a template name works with and without .html", %{conn: conn} do
    assert json_response(post_json(conn, %{@valid | template: "custom"}), 200)
    assert json_response(post_json(build_conn(), @valid), 200)
  end

  test "without from, the mail comes from the configured address", %{conn: conn} do
    assert json_response(post_json(conn, @valid), 200)
    assert_delivered_email_matches(%{from: {nil, "mailer@aegee.eu"}})
  end

  test "an explicit null from also uses the configured address", %{conn: conn} do
    assert json_response(post_json(conn, Map.put(@valid, :from, nil)), 200)
    assert_delivered_email_matches(%{from: {nil, "mailer@aegee.eu"}})
  end

  test "each recipient gets a mail of their own with the same cc, bcc and reply-to", %{conn: conn} do
    body = Map.merge(@valid, %{to: ["first@example.org", "second@example.org"], cc: ["cc1@example.org", "cc2@example.org"], bcc: "bcc@example.org", reply_to: "reply@example.org"})
    assert json_response(post_json(conn, body), 200)

    for recipient <- ["first@example.org", "second@example.org"] do
      assert_delivered_email_matches(%{
        to: [{nil, ^recipient}],
        cc: [{nil, "cc1@example.org"}, {nil, "cc2@example.org"}],
        bcc: [{nil, "bcc@example.org"}],
        headers: %{"Reply-To" => "reply@example.org"}
      })
    end
  end

  test "empty cc, bcc and reply-to are left out", %{conn: conn} do
    assert json_response(post_json(conn, Map.merge(@valid, %{cc: [], bcc: "", reply_to: ""})), 200)
    assert_delivered_email_matches(%{cc: [], bcc: [], headers: headers})
    assert headers == %{}
  end

  test "a list of recipients with an empty address answers 422 and sends nothing", %{conn: conn} do
    conn = post_json(conn, %{@valid | to: ["first@example.org", ""]})

    assert json_response(conn, 422)["error"] == "Sender and recipient addresses must not be empty"
    assert_no_emails_delivered()
  end

  test "one body per recipient, in order", %{conn: conn} do
    body = %{@valid | to: ["first@example.org", "second@example.org"], parameters: [%{email_body: "<p>one</p>"}, %{email_body: "<p>two</p>"}]}
    assert json_response(post_json(conn, body), 200)

    assert_delivered_email_matches(%{to: [{nil, "first@example.org"}], html_body: first})
    assert first =~ "<p>one</p>"
    assert_delivered_email_matches(%{to: [{nil, "second@example.org"}], html_body: second})
    assert second =~ "<p>two</p>"
  end

  test "fewer bodies than recipients answers 422 and sends nothing", %{conn: conn} do
    body = %{@valid | to: ["first@example.org", "second@example.org", "third@example.org"], parameters: [%{email_body: "one"}, %{email_body: "two"}]}

    assert json_response(post_json(conn, body), 422)["error"] =~ "Mismatch in amounts of mails"
    assert_no_emails_delivered()
  end
end
