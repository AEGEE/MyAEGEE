defmodule OmsmailerWeb.PageView do
  use OmsmailerWeb, :view

    def render("success.json", %{}) do
      %{success: true}
    end

end
