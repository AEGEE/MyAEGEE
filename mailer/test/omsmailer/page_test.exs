defmodule Omsmailer.PageTest do
  use ExUnit.Case, async: true

  alias Omsmailer.Page

  test "set_body returns a 3-tuple error when mail and body counts differ" do
    {:ok, mails} = Page.create_mails("mailer@aegee.org", ["first@aegee.org", "second@aegee.org"], "pirates")

    assert Page.set_body(mails, ["one", "two", "three"]) ==
             {:error, :unprocessable_entity, "Mismatch in amounts of mails and amounts of template bodies"}
  end
end
