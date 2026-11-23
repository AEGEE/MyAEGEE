defmodule OmsmailerWeb.RequestLoggerPlug do
  require Logger
  alias Plug.Conn
  @behaviour Plug

  def init(opts) do
    Keyword.get(opts, :log, :info)
  end

  def call(conn, level) do
    start = System.monotonic_time()

    Conn.register_before_send(conn, fn conn ->
      Logger.log(level, fn ->
        stop = System.monotonic_time()
        diff = System.convert_time_unit(stop - start, :native, :microsecond)
        status = Integer.to_string(conn.status)
        mail = if conn.method in ["PUT", "POST"] do
          [", mail: ", Poison.encode!(mail_summary(conn.params))]
        else
          []
        end

        [
            conn.method, ?\s,
            conn.request_path, ?\s,
            status, ?\s,
            formatted_diff(diff),
        ] ++ mail
      end)

      conn
    end)
  end

  @recipient_keys ~w(to cc bcc reply_to)

  # Templates whose subject and text the sender writes, such as a mass mail.
  # The services compose the subjects of all other templates from fixed text
  # and the name of an event, body or integration.
  @custom_templates ~w(custom.html)

  # Logs the template, the subject and the names of the template parameters.
  # Parameter values hold personal data and stay out of the log; recipients
  # are only shown as "[REDACTED]", and a subject the sender wrote as "[CUSTOM]".
  defp mail_summary(params) when is_map(params) and not is_struct(params) do
    summary =
      params
      |> Map.take(["template", "subject"])
      |> Map.put("parameters", parameter_names(params["parameters"]))
      |> mask_custom_subject()

    Enum.reduce(@recipient_keys, summary, fn key, summary ->
      if Map.has_key?(params, key), do: Map.put(summary, key, "[REDACTED]"), else: summary
    end)
  end
  defp mail_summary(_params), do: %{}

  defp mask_custom_subject(%{"template" => template, "subject" => _} = summary) when template in @custom_templates do
    Map.put(summary, "subject", "[CUSTOM]")
  end
  defp mask_custom_subject(summary), do: summary

  defp parameter_names(parameters) when is_map(parameters) and not is_struct(parameters) do
    parameters |> Map.keys() |> Enum.map(&to_string/1) |> Enum.sort()
  end
  defp parameter_names(_parameters), do: []

  defp formatted_diff(diff) when diff > 1000, do: [diff |> div(1000) |> Integer.to_string(), "ms"]
  defp formatted_diff(diff), do: [Integer.to_string(diff), "µs"]
end