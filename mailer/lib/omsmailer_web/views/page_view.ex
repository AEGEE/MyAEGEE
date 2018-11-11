defmodule OmsmailerWeb.PageView do
  use OmsmailerWeb, :view

    def render("success.json", %{}) do
      %{success: true}
    end

    def render("missing_key.json", %{key: key}) do
      %{success: false,
        error: "Missing key " <> Kernel.inspect(key)
      }
    end

end
