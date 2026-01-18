defmodule Omsmailer.Page do
  import Bamboo.Email

  defp autocomplete_template(template) do
    if String.ends_with?(template, ".html") do
      template
    else
      template <> ".html"
    end
  end

  # Renders either a list of templates or a single template
  def render_template(template, [cur_params | parameters]) do
    with {:ok, content} <- render_template(template, cur_params),
         {:ok, remaining_list} <- render_template(template, parameters) do
      {:ok, [content] ++ remaining_list}
    end
  end
  def render_template(_template, []) do
    {:ok, []}
  end
  def render_template(template, parameters) do
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
  def deliver_all_mails([cur_mail | mails]) do
    deliver_all_mails(cur_mail)
    deliver_all_mails(mails)
  end
  def deliver_all_mails([]), do: []
  def deliver_all_mails(mail) do
    Omsmailer.Mailer.deliver_later(mail)
  end

  # Creates mails and sets recipient and subjectheaders
  # First define a cathing function to catch nil address and to
  def create_mails(_from, to, _subject) when is_nil(to) or (is_binary(to) and byte_size(to) == 0) or (is_list(to) and length(to) == 0), do: {:error, :unprocessable_entity, "Missing to address"}
  def create_mails(_from, _to, subject) when is_nil(subject) or byte_size(subject) == 0, do: {:error, :unprocessable_entity, "Missing subject"}
  def create_mails(from, to, subject), do: {:ok, create_mails_(from, to, subject)}
  defp create_mails_(from, [first_recipient | recipients], subject), do: [create_mails_(from, first_recipient, subject)] ++ create_mails_(from, recipients, subject)
  defp create_mails_(_from, [], _subject), do: []
  defp create_mails_(from, recipient, subject) do
    new_email(
      to: recipient,
      subject: subject,
      from: from)
  end

  # Sets the body on one or several mails with one or several bodies
  # In case of both content and mail lists, these lists need to have the same length
  def set_body([_cur_mail | mails], [_cur_content | contents]) when length(mails) != length(contents), do: {:error, "Mismatch in amounts of mails and amounts of template bodies"}
  # Set one pair of body/mail
  def set_body([cur_mail | mails], [cur_content | contents]) do
    with {:ok, cur_result} <- set_body(cur_mail, cur_content),
         {:ok, remaining_results} <- set_body(mails, contents) do
      {:ok, [cur_result] ++ remaining_results}
    end
  end
  def set_body([], []), do: {:ok, []}
  # Sets several mails with the same body
  def set_body([cur_mail | mails], content) do 
    with {:ok, cur_result} <- set_body(cur_mail, content),
         {:ok, remaining_results} <- set_body(mails, content) do
      {:ok, [cur_result] ++ remaining_results}     
    end
  end
  def set_body([], _content), do: {:ok, []}
  # Sets a single mail with a single content
  def set_body(mail, content), do: {:ok, html_body(mail, content)}


  defp set_reply_to_header(mail, reply_to) when is_nil(reply_to) or byte_size(reply_to) == 0, do: mail
  defp set_reply_to_header(mail, reply_to), do: put_header(mail, "Reply-To", reply_to)

  defp set_cc_header(mail, cc_field) when is_nil(cc_field) or (is_binary(cc_field) and byte_size(cc_field) == 0) or (is_list(cc_field) and length(cc_field) == 0), do: mail
  defp set_cc_header(mail, cc_field), do: cc(mail, cc_field)

  defp set_bcc_header(mail, bcc_field) when is_nil(bcc_field) or (is_binary(bcc_field) and byte_size(bcc_field) == 0) or (is_list(bcc_field) and length(bcc_field) == 0), do: mail
  defp set_bcc_header(mail, bcc_field), do: bcc(mail, bcc_field)

  def set_additional_headers([cur_mail | mails], headers) do
    with {:ok, cur_result} <- set_additional_headers(cur_mail, headers),
         {:ok, remaining_results} <- set_additional_headers(mails, headers) do
      {:ok, [cur_result] ++ remaining_results}       
    end
  end
  def set_additional_headers([], _), do: {:ok, []}
  def set_additional_headers(mail, headers) do
    mail = mail
    |> set_reply_to_header(headers["reply_to"])
    |> set_cc_header(headers["cc"])
    |> set_bcc_header(headers["bcc"])

    {:ok, mail}
  end
end
