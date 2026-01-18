defmodule OmsmailerWeb.PageController do
  use OmsmailerWeb, :controller

  alias Omsmailer.Page

  action_fallback OmsmailerWeb.FallbackController


  def index(conn, _params) do
    render conn, "success.json"
  end

  def healthcheck(conn, _params) do
    package_info = File.read!("package.json")
    |> Poison.decode!()

    conn
    |> put_status(200)
    |> json(%{
      success: true,
      data: %{
        name: package_info["name"],
        description: package_info["description"],
        version: package_info["version"]
      }
    })
  end

  def send_mail(conn, %{"template" => template, "parameters" => parameters, "to" => to, "subject" => subject} = body_params) do
    from = body_params["from"] || Application.get_env(:omsmailer, :from_address)

    with {:ok, content} <- Page.render_template(template, parameters),
         {:ok, mails} <- Page.create_mails(from, to, subject),
         {:ok, mails} <- Page.set_additional_headers(mails, body_params),
         {:ok, mails} <- Page.set_body(mails, content) do

      Page.deliver_all_mails(mails)
      render conn, "success.json"
    end
  end

  
end
