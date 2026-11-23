defmodule Omsmailer.TemplatePaths do
  @moduledoc """
  Finds the parameter paths a page template reads, from its source and the snippets it
  renders. The templates use few patterns, so this reads the EEx tags with regular
  expressions; `template_paths_test.exs` pins the result for some templates.

  - `@parameters["a"]["b"]` reads `a.b`; a missing value renders as nothing, unless it is
    part of the subject line (`"…" <> @parameters[…]`), where it can't be rendered without.
  - `Map.fetch!(@parameters, "k")` reads `k`, and can't be rendered without it.
  - `for x <- @parameters["l"]` (or `{x, i}`) reads the list `l`, which it can't be
    rendered without, and `x["k"]` inside reads `l.[].k`.
  - `render(OmsmailerWeb.SnippetsView, "s.html", parameters: @parameters)` reads what
    `snippets/s.html.eex` reads.
  """

  @templates Path.expand("../../lib/omsmailer_web/templates", __DIR__)

  def page_templates do
    Path.join([@templates, "page", "*.html.eex"])
    |> Path.wildcard()
    |> Enum.map(&Path.basename(&1, ".html.eex"))
    |> Enum.sort()
  end

  @doc "`%{read: MapSet, needed: MapSet}`: every path read, and those it can't render without."
  def read(template), do: read_file(Path.join([@templates, "page", template <> ".html.eex"]))

  defp read_file(file) do
    source = File.read!(file)
    tags = Regex.scan(~r/<%=?(.*?)%>/s, source, capture: :all_but_first) |> Enum.map(&hd/1)

    {result, _bindings} =
      Enum.reduce(tags, {%{read: MapSet.new(), needed: MapSet.new()}, %{}}, fn tag, {acc, bindings} ->
        read_tag(tag, acc, bindings)
      end)

    result
  end

  defp read_tag(tag, acc, bindings) do
    {acc, bindings} =
      case Regex.run(~r/for\s+(?:\{\s*(\w+)\s*,\s*\w+\s*\}|(\w+))\s*<-\s*@parameters((?:\["\w+"\])+)/, tag) do
        [_, tuple_var, plain_var, chain] ->
          list = path(chain)
          var = if tuple_var != "", do: tuple_var, else: plain_var
          {add(acc, list, true), Map.put(bindings, var, list <> ".[]")}

        nil ->
          {acc, bindings}
      end

    acc =
      Regex.scan(~r/(<>\s*)?@parameters((?:\["\w+"\])+)/, tag)
      |> Enum.reduce(acc, fn [_, concat, chain], acc -> add(acc, path(chain), concat != "") end)

    acc =
      Regex.scan(~r/Map\.fetch!\(@parameters,\s*"(\w+)"\)/, tag)
      |> Enum.reduce(acc, fn [_, key], acc -> add(acc, key, true) end)

    acc =
      Enum.reduce(bindings, acc, fn {var, base}, acc ->
        Regex.scan(~r/(?<![\w@])#{var}((?:\["\w+"\])+)/, tag)
        |> Enum.reduce(acc, fn [_, chain], acc -> add(acc, base <> "." <> path(chain), false) end)
      end)

    acc =
      Regex.scan(~r/render\(OmsmailerWeb\.SnippetsView,\s*"([\w.]+)",\s*parameters:\s*@parameters/, tag)
      |> Enum.reduce(acc, fn [_, snippet], acc ->
        inner = read_file(Path.join([@templates, "snippets", snippet <> ".eex"]))
        %{read: MapSet.union(acc.read, inner.read), needed: MapSet.union(acc.needed, inner.needed)}
      end)

    {acc, bindings}
  end

  defp path(chain) do
    Regex.scan(~r/\["(\w+)"\]/, chain, capture: :all_but_first) |> Enum.map(&hd/1) |> Enum.join(".")
  end

  defp add(acc, path, needed) do
    acc = %{acc | read: MapSet.put(acc.read, path)}
    if needed, do: %{acc | needed: MapSet.put(acc.needed, path)}, else: acc
  end
end
