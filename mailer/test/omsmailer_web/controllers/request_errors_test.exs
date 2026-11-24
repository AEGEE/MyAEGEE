defmodule OmsmailerWeb.RequestErrorsTest do
  # A request without the fields a mail needs is answered with 422 and the JSON
  # error body, and nothing is sent.
  use OmsmailerWeb.ConnCase
  use Bamboo.Test

  @valid %{template: "custom.html", parameters: %{email_body: "<p>Hello</p>"}, to: "test@aegee.org", subject: "pirates"}

  defp post_json(conn, body) do
    conn
    |> put_req_header("content-type", "application/json")
    |> post("/", Jason.encode!(body))
  end

  test "an empty list of parameters answers 422 instead of sending a blank mail", %{conn: conn} do
    conn = post_json(conn, %{@valid | parameters: []})

    assert %{"success" => false, "error" => error} = json_response(conn, 422)
    assert error =~ "Parameters must not be an empty list"
    assert_no_emails_delivered()
  end

  test "an empty list of parameters for several recipients answers 422", %{conn: conn} do
    conn = post_json(conn, %{@valid | parameters: [], to: ["first@aegee.org", "second@aegee.org"]})

    assert json_response(conn, 422)["error"] =~ "Parameters must not be an empty list"
    assert_no_emails_delivered()
  end

  for field <- [:template, :parameters, :to, :subject] do
    test "a request without #{field} answers 422 and names it", %{conn: conn} do
      conn = post_json(conn, Map.delete(@valid, unquote(field)))

      assert json_response(conn, 422) == %{"success" => false, "error" => "Missing field(s): #{unquote(field)}"}
      assert_no_emails_delivered()
    end
  end

  test "a request without any field names all missing ones", %{conn: conn} do
    conn = post_json(conn, %{})

    assert json_response(conn, 422) == %{"success" => false, "error" => "Missing field(s): template, parameters, to, subject"}
    assert_no_emails_delivered()
  end

  test "a template name that is not a text answers 422", %{conn: conn} do
    for template <- [nil, "", 42] do
      conn = post_json(conn, %{@valid | template: template})

      assert json_response(conn, 422)["error"] == "Template must be a non-empty string"
    end

    assert_no_emails_delivered()
  end

  test "parameters that are not an object or a list of objects answer 422", %{conn: conn} do
    for parameters <- [nil, "text", 42, ["text"], [%{email_body: "one"}, nil]] do
      conn = post_json(conn, %{@valid | parameters: parameters, to: ["first@aegee.org", "second@aegee.org"]})

      assert json_response(conn, 422)["error"] == "Parameters must be an object or a list of objects"
    end

    assert_no_emails_delivered()
  end

  test "a valid request is still sent", %{conn: conn} do
    conn = post_json(conn, @valid)

    assert json_response(conn, 200) == %{"success" => true}
    assert_email_delivered_with(subject: "pirates")
  end

  test "an empty or null address among the cc or bcc addresses answers 422 and sends nothing", %{conn: conn} do
    for field <- [:cc, :bcc], blank <- [nil, ""] do
      conn = post_json(conn, Map.put(@valid, field, ["copy@aegee.org", blank]))

      assert json_response(conn, 422)["error"] == "Sender and recipient addresses must not be empty"
    end

    assert_no_emails_delivered()
  end
end
