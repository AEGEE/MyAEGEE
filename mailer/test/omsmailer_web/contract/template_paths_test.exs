defmodule OmsmailerWeb.Contract.TemplatePathsTest do
  # Every parameter a template reads is declared in the mail contract, and every one the
  # template can't be rendered without is required there.
  use ExUnit.Case, async: true

  alias Omsmailer.{Contract, TemplatePaths}

  @manifest Contract.manifest()

  test "the mailer has a page template for every template of the contract, and no other" do
    assert TemplatePaths.page_templates() == @manifest["templates"] |> Map.keys() |> Enum.sort()
  end

  for template <- TemplatePaths.page_templates() do
    @template template

    test "#{template} reads only declared parameters, and requires those it can't render without" do
      schema = @manifest["templates"][@template]["parameters"]
      paths = TemplatePaths.read(@template)

      assert MapSet.difference(paths.read, Contract.declared_paths(schema, @manifest)) |> MapSet.to_list() == [],
             "read by the template, not declared in the contract"

      assert MapSet.difference(paths.needed, Contract.required_paths(schema, @manifest)) |> MapSet.to_list() == [],
             "the template can't render without these, but the contract doesn't require them"
    end
  end

  describe "the path extractor" do
    test "finds the subject line, Map.fetch! and plain reads" do
      assert TemplatePaths.read("mail_change_notice") == %{
               read: MapSet.new(~w(name surname new_email changed_by)),
               needed: MapSet.new()
             }

      assert TemplatePaths.read("statutory_memberslist_edited") == %{
               read: MapSet.new(~w(event_name body_name membership_fee)),
               needed: MapSet.new(~w(event_name))
             }

      assert TemplatePaths.read("workspace_deleted_member").needed == MapSet.new(~w(user_id))
    end

    test "follows snippets and loops" do
      assert TemplatePaths.read("network_new_board") == %{
               read: MapSet.new(~w(body_name board.elected_date board.start_date board.end_date board.message positions positions.[].function positions.[].name)),
               needed: MapSet.new(~w(body_name positions))
             }

      paths = TemplatePaths.read("events_applied")
      assert MapSet.subset?(MapSet.new(~w(event.questions event.questions.[].description application.answers application.email)), paths.read)
      assert paths.needed == MapSet.new(~w(event.name event.questions))
    end
  end
end
