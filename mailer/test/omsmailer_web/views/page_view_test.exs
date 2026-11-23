defmodule OmsmailerWeb.PageViewTest do
  use OmsmailerWeb.ConnCase, async: true

    test "inserting template snippets worked" do
      res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "password_reset.html", parameters: %{"token" => "abc"})
      assert String.contains?(res, "<style type=\"text/css\">")
    end

    test "the new board mail lists every position with the name of its holder" do
      res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "network_new_board.html", parameters: %{
        "body_name" => "AEGEE-Delft",
        "board" => %{"elected_date" => "2026-04-01", "start_date" => "2026-05-01", "end_date" => "2027-04-30", "message" => "Hello"},
        "positions" => [
          %{"function" => "President", "name" => "Ada Lovelace"},
          %{"function" => "Secretary", "name" => "Grace Hopper"},
          %{"function" => "Public relations", "name" => "Alan Turing"}
        ]
      })

      assert res =~ ~r{<strong>President </strong>\s*Ada Lovelace}
      assert res =~ ~r{<strong>Secretary </strong>\s*Grace Hopper}
      assert res =~ ~r{<strong>Public relations </strong>\s*Alan Turing}
    end
end
