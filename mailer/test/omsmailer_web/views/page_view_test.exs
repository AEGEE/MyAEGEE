defmodule OmsmailerWeb.PageViewTest do
  use OmsmailerWeb.ConnCase, async: true

    test "inserting template snippets worked" do
      res = Phoenix.View.render_to_string(OmsmailerWeb.PageView, "password_reset.html", parameters: %{"token" => "abc"})
      assert String.contains?(res, "<style type=\"text/css\">")
    end
end
