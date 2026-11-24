defmodule Omsmailer.Contract do
  @moduledoc """
  Reads the mail contract (`contract/mail-templates.json`) for the tests: the templates,
  their examples and the paths their parameter schemas declare. The same rules as
  `contract/check-mail.cjs`: list items are `<path>.[]`, `$ref` points into `$defs`.
  """

  @path Path.expand("../../contract/mail-templates.json", __DIR__)
  @external_resource @path

  def path, do: @path

  def manifest, do: @path |> File.read!() |> Jason.decode!()

  def templates(manifest \\ manifest()), do: manifest["templates"]

  @doc "Every example of every template as `{template, example name, variant, parameters}`."
  def cases(manifest \\ manifest()) do
    for {template, entry} <- Enum.sort(templates(manifest)),
        example <- entry["examples"],
        {variant, parameters} <- variants(example["parameters"], entry["parameters"], manifest) do
      {template, example["name"], variant, parameters}
    end
  end

  @doc "The example as given, with only its required keys, and with every nullable value set to nil."
  def variants(parameters, schema, manifest) do
    [
      {"full", parameters},
      {"minimal", prune(parameters, schema, manifest)},
      {"nulls", nulls(parameters, schema, manifest)}
    ]
  end

  def resolve(%{"$ref" => "#/$defs/" <> name}, manifest), do: resolve(Map.fetch!(manifest["$defs"], name), manifest)
  def resolve(schema, _manifest), do: schema

  def prune(value, schema, manifest) do
    schema = resolve(schema, manifest)

    cond do
      is_list(value) and Map.has_key?(schema, "items") ->
        Enum.map(value, &prune(&1, schema["items"], manifest))

      is_map(value) ->
        properties = schema["properties"] || %{}

        for key <- schema["required"] || [], Map.has_key?(value, key), into: %{} do
          case properties[key] do
            nil -> {key, value[key]}
            child -> {key, prune(value[key], child, manifest)}
          end
        end

      true ->
        value
    end
  end

  def nulls(value, schema, manifest) do
    schema = resolve(schema, manifest)

    cond do
      "null" in List.wrap(schema["type"]) ->
        nil

      is_list(value) and Map.has_key?(schema, "items") ->
        Enum.map(value, &nulls(&1, schema["items"], manifest))

      is_map(value) ->
        Enum.reduce(schema["properties"] || %{}, value, fn {key, child}, acc ->
          if Map.has_key?(acc, key), do: Map.put(acc, key, nulls(acc[key], child, manifest)), else: acc
        end)

      true ->
        value
    end
  end

  @doc "Every dotted path the schema declares."
  def declared_paths(schema, manifest, prefix \\ nil) do
    schema = resolve(schema, manifest)

    properties =
      Enum.reduce(schema["properties"] || %{}, MapSet.new(), fn {key, child}, acc ->
        path = join(prefix, key)
        acc |> MapSet.put(path) |> MapSet.union(declared_paths(child, manifest, path))
      end)

    case schema["items"] do
      nil -> properties
      items -> properties |> MapSet.put(join(prefix, "[]")) |> MapSet.union(declared_paths(items, manifest, join(prefix, "[]")))
    end
  end

  @doc "Every dotted path that is required, with every object above it."
  def required_paths(schema, manifest, prefix \\ nil) do
    schema = resolve(schema, manifest)
    properties = schema["properties"] || %{}

    required =
      Enum.reduce(schema["required"] || [], MapSet.new(), fn key, acc ->
        path = join(prefix, key)
        below = if properties[key], do: required_paths(properties[key], manifest, path), else: MapSet.new()
        acc |> MapSet.put(path) |> MapSet.union(below)
      end)

    case schema["items"] do
      nil -> required
      items -> required |> MapSet.put(join(prefix, "[]")) |> MapSet.union(required_paths(items, manifest, join(prefix, "[]")))
    end
  end

  @doc "The values at a dotted path; list items (`[]`) and lists at the end are expanded."
  def values_at(value, path) do
    path
    |> String.split(".")
    |> Enum.reduce([value], fn
      "[]", values -> Enum.flat_map(values, &List.wrap/1)
      key, values -> for v <- values, is_map(v), do: v[key]
    end)
    |> Enum.flat_map(fn
      list when is_list(list) -> list
      other -> [other]
    end)
  end

  @doc "The parameters without the value at a dotted path (no list items)."
  def drop_path(parameters, path) do
    case String.split(path, ".") do
      [key] -> Map.delete(parameters, key)
      [key | rest] when is_map_key(parameters, key) and is_map(:erlang.map_get(key, parameters)) ->
        Map.put(parameters, key, drop_path(parameters[key], Enum.join(rest, ".")))
      _ -> parameters
    end
  end

  defp join(nil, key), do: key
  defp join(prefix, key), do: prefix <> "." <> key
end
