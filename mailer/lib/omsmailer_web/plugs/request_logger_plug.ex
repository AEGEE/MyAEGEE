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
        params = if conn.method in ["PUT", "POST"] do
          [", request params: ", Poison.encode!(redact_params(conn.params), pretty: true)]
        else
          []
        end

        [
            conn.method, ?\s,
            conn.request_path, ?\s,
            status, ?\s,
            formatted_diff(diff),
        ] ++ params
      end)

      conn
    end)
  end

  @redacted_keys ~w(to cc bcc)

  # Replaces recipients and token/password-like values, at any depth, with "[REDACTED]"
  defp redact_params(%_{} = params), do: params
  defp redact_params(params) when is_map(params) do
    Map.new(params, fn {key, value} ->
      if redacted_key?(to_string(key)) do
        {key, "[REDACTED]"}
      else
        {key, redact_params(value)}
      end
    end)
  end
  defp redact_params(params) when is_list(params), do: Enum.map(params, &redact_params/1)
  defp redact_params(params), do: params

  defp redacted_key?(key) do
    key = String.downcase(key)
    key in @redacted_keys or String.contains?(key, ["token", "password"])
  end

  defp formatted_diff(diff) when diff > 1000, do: [diff |> div(1000) |> Integer.to_string(), "ms"]
  defp formatted_diff(diff), do: [Integer.to_string(diff), "µs"]
end