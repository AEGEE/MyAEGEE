defmodule OmsmailerWeb.PageController do
  use OmsmailerWeb, :controller

  import Bamboo.Email


  def index(conn, _params) do
    render conn, "success.json"
  end

  def send_mail(conn, %{"template" => template, "parameters" => parameters, "to" => to, "subject" => subject}) do
    try do
      content = Phoenix.View.render_to_string(OmsmailerWeb.PageView, template, parameters: parameters)

      new_email(
        to: to,
        from: Application.get_env(:omsmailer, :from_address),
        subject: subject,
        html_body: content
      )
      |> Omsmailer.Mailer.deliver_now

      render conn, "success.json"
    rescue
      e in KeyError -> conn |> put_status(:unprocessable_entity) |> render("missing_key.json", key: e.key)  # Missing key in template, caused by Map.fetch!
      e -> throw e 
    end
  end
end
