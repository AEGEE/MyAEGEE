defmodule OmsmailerWeb.PageController do
  use OmsmailerWeb, :controller

  import Bamboo.Email

  action_fallback OmsmailerWeb.FallbackController


  def index(conn, _params) do
    render conn, "success.json"
  end

  defp autocomplete_template(template) do
    if String.ends_with?(template, ".html") do
      template
    else
      template <> ".html"
    end
  end

  defp render_template(template, parameters) do
    template = autocomplete_template(template)
    try do
      content = Phoenix.View.render_to_string(OmsmailerWeb.PageView, template, parameters: parameters)
      {:ok, content}
    rescue
      e in KeyError -> {:error, :unprocessable_entity, "Missing key " <> Kernel.inspect(e.key)}  # Missing key in template, caused by Map.fetch!
      e in Phoenix.Template.UndefinedError -> {:error, :not_found, "Template " <> template <> " not found, available are: " <> Kernel.inspect(e.available)}
      e -> throw e 
    end
  end

  def send_mail(conn, %{"template" => template, "parameters" => parameters, "to" => to, "subject" => subject}) when is_binary(template) and is_map(parameters) and is_binary(to) and is_binary(subject) do
    with {:ok, content} <- render_template(template, parameters) do
      new_email(
        to: to,
        from: Application.get_env(:omsmailer, :from_address),
        subject: subject,
        html_body: content
      )
      |> Omsmailer.Mailer.deliver_now

      render conn, "success.json"
    end
  end

  def send_mail(conn, %{"template" => template, "parameters" => parameters, "to" => to, "subject" => subject}) when is_binary(template) and is_map(parameters) and is_list(to) and is_binary(subject) do
    with {:ok, content} <- render_template(template, parameters) do

      Enum.map(to, fn(to) -> 
        new_email(
          to: to,
          from: Application.get_env(:omsmailer, :from_address),
          subject: subject,
          html_body: content
        )
        |> Omsmailer.Mailer.deliver_later
      end)

      render conn, "success.json"
    end
  end

  def send_mail(conn, %{"template" => template, "parameters" => parameters, "to" => to, "subject" => subject}) when is_binary(template) and is_list(parameters) and is_list(to) and is_binary(subject) do
    contents = Enum.map(parameters, fn(x) -> render_template(template, x) end)

    with nil <- Enum.find(contents, fn(x) -> elem(x, 0) != :ok end) do
      Enum.zip(to, contents)
      |> Enum.map(fn({to, {:ok, content}}) ->
        new_email(
          to: to,
          from: Application.get_env(:omsmailer, :from_address),
          subject: subject,
          html_body: content
        )
        |> Omsmailer.Mailer.deliver_later
      end)

      render conn, "success.json"
    end
  end
end
