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
          [", request params: ", Poison.encode!(conn.params, pretty: true)]
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

  defp formatted_diff(diff) when diff > 1000, do: [diff |> div(1000) |> Integer.to_string(), "ms"]
  defp formatted_diff(diff), do: [Integer.to_string(diff), "µs"]
end