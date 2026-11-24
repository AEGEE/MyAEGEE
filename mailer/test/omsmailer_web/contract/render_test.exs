defmodule OmsmailerWeb.Contract.RenderTest do
  # Renders every example of the mail contract through POST /: as given, with only the
  # required keys, and with every nullable value null. Then checks that a mail without a
  # value its template can't render without is refused with 422.
  use OmsmailerWeb.ConnCase
  use Bamboo.Test

  alias Omsmailer.{Contract, TemplatePaths}

  @manifest Contract.manifest()

  defp post_mail(conn, template, parameters) do
    body = %{template: template <> ".html", parameters: parameters, to: "member@example.org", subject: "Subject"}

    conn
    |> put_req_header("content-type", "application/json")
    |> post("/", Jason.encode!(body))
  end

  defp escaped(value) when is_binary(value), do: value |> Phoenix.HTML.html_escape() |> Phoenix.HTML.safe_to_string()
  defp escaped(value), do: to_string(value)

  for {template, example, variant, parameters} <- Contract.cases(@manifest) do
    @template template
    @parameters parameters
    @variant variant

    test "#{template}: #{example} (#{variant})", %{conn: conn} do
      conn = post_mail(conn, @template, @parameters)
      assert json_response(conn, 200) == %{"success" => true}

      assert_delivered_email_matches(%{html_body: html_body})
      # A custom mail is the sender's HTML only.
      if @template != "custom", do: assert(html_body =~ ~r{<title>MyAEGEE: [^<]*</title>})

      if @variant == "full" do
        # What the template reads, and everything the contract requires: a required value
        # that the template doesn't show is a template bug or a schema error.
        schema = @manifest["templates"][@template]["parameters"]
        paths = MapSet.union(TemplatePaths.read(@template).read, Contract.required_paths(schema, @manifest))

        for path <- paths,
            value <- Contract.values_at(@parameters, path),
            is_binary(value) or is_number(value) do
          expected = if @template == "custom", do: to_string(value), else: escaped(value)
          assert String.contains?(html_body, expected), "#{path}: #{inspect(value)} is not in the mail"
        end
      end
    end
  end

  for {template, entry} <- Enum.sort(@manifest["templates"]),
      path <- TemplatePaths.read(template).needed |> Enum.sort() do
    @template template
    @path path
    @parameters hd(entry["examples"])["parameters"]

    test "#{template} without #{path} is refused with 422", %{conn: conn} do
      conn = post_mail(conn, @template, Contract.drop_path(@parameters, @path))

      assert %{"success" => false, "error" => _} = json_response(conn, 422)
      assert_no_emails_delivered()
    end
  end

  test "an HTML tag in a printed value arrives escaped, except in the body of a custom mail", %{conn: conn} do
    conn = post_mail(conn, "confirm_email", %{"name" => "<b>Ada</b>", "surname" => "Lovelace", "token" => "abc"})
    assert json_response(conn, 200)
    assert_delivered_email_matches(%{html_body: html_body})
    assert html_body =~ "&lt;b&gt;Ada&lt;/b&gt;"
    refute html_body =~ "<b>Ada</b>"

    conn = post_mail(build_conn(), "custom", %{"email_body" => "<p>Hello <b>Ada</b></p>"})
    assert json_response(conn, 200)
    assert_delivered_email_matches(%{html_body: custom_body})
    assert custom_body =~ "<p>Hello <b>Ada</b></p>"
  end
end
