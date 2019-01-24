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

  # Renders either a list of templates or a single template
  defp render_template(template, [cur_params | parameters]) do
    with {:ok, content} <- render_template(template, cur_params),
         {:ok, remaining_list} <- render_template(template, parameters) do
      {:ok, [content] ++ remaining_list}
    end
  end
  defp render_template(_template, []) do
    {:ok, []}
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

  # Delivers either a list of mails or a single mail
  defp deliver_all_mails([cur_mail | mails]) do
    deliver_all_mails(cur_mail)
    deliver_all_mails(mails)
  end
  defp deliver_all_mails([]), do: []
  defp deliver_all_mails(mail) do
    Omsmailer.Mailer.deliver_later(mail)
  end

  # Creates mails and sets recipient and subjectheaders
  # First define a cathing function to catch nil address and to
  defp create_mails(to, _subject) when is_nil(to) or (is_binary(to) and byte_size(to) == 0) or (is_list(to) and length(to) == 0), do: {:error, :unprocessable_entity, "Missing to address"}
  defp create_mails(_to, subject) when is_nil(subject) or byte_size(subject) == 0, do: {:error, :unprocessable_entity, "Missing subject"}
  defp create_mails(to, subject), do: {:ok, create_mails_(to, subject)}
  defp create_mails_([first_recipient | recipients], subject), do: [create_mails_(first_recipient, subject)] ++ create_mails_(recipients, subject)
  defp create_mails_([], _subject), do: []
  defp create_mails_(recipient, subject) do
    new_email(
      to: recipient,
      subject: subject,
      from: Application.get_env(:omsmailer, :from_address))
  end

  # Sets the body on one or several mails with one or several bodies
  # In case of both content and mail lists, these lists need to have the same length
  defp set_body([_cur_mail | mails], [_cur_content | contents]) when length(mails) != length(contents), do: {:error, "Mismatch in amounts of mails and amounts of template bodies"}
  # Set one pair of body/mail
  defp set_body([cur_mail | mails], [cur_content | contents]) do
    with {:ok, cur_result} <- set_body(cur_mail, cur_content),
         {:ok, remaining_results} <- set_body(mails, contents) do
      {:ok, [cur_result] ++ remaining_results}
    end
  end
  defp set_body([], []), do: {:ok, []}
  # Sets several mails with the same body
  defp set_body([cur_mail | mails], content) do 
    with {:ok, cur_result} <- set_body(cur_mail, content),
         {:ok, remaining_results} <- set_body(mails, content) do
      {:ok, [cur_result] ++ remaining_results}     
    end
  end
  defp set_body([], _content), do: {:ok, []}
  # Sets a single mail with a single content
  defp set_body(mail, content), do: {:ok, html_body(mail, content)}



  def send_mail(conn, %{"template" => template, "parameters" => parameters, "to" => to, "subject" => subject} = body_params) do
    with {:ok, content} <- render_template(template, parameters),
         {:ok, mails} <- create_mails(to, subject),
         {:ok, mails} <- set_body(mails, content) do

      deliver_all_mails(mails)
      render conn, "success.json"
    end
  end

  
end
