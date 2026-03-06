defmodule Omsmailer.PageTest do
  use ExUnit.Case, async: true

  alias Omsmailer.Page

  test "render_template autocompletes html filenames" do
    assert {:ok, content} = Page.render_template("custom", %{"body" => "hello"})
    assert content =~ "hello"
  end

  test "render_template returns a helpful error for missing keys" do
    assert {:error, :unprocessable_entity, message} =
             Page.render_template("confirm_email", %{"name" => "Test"})

    assert message =~ "Missing key"
  end

  test "render_template renders a list of parameter maps" do
    assert {:ok, contents} =
             Page.render_template("custom", [
               %{"body" => "first"},
               %{"body" => "second"}
             ])

    assert length(contents) == 2
    assert Enum.at(contents, 0) =~ "first"
    assert Enum.at(contents, 1) =~ "second"
  end

  test "create_mails rejects missing recipients and subjects" do
    assert {:error, :unprocessable_entity, "Missing to address"} =
             Page.create_mails("mailer@aegee.org", [], "subject")

    assert {:error, :unprocessable_entity, "Missing subject"} =
             Page.create_mails("mailer@aegee.org", "test@aegee.org", "")
  end

  test "create_mails creates one mail per recipient" do
    assert {:ok, mails} =
             Page.create_mails("mailer@aegee.org", ["one@aegee.org", "two@aegee.org"], "Ahoy")

    assert Enum.map(mails, & &1.to) == [[nil: "one@aegee.org"], [nil: "two@aegee.org"]]
    assert Enum.all?(mails, &(&1.subject == "Ahoy"))
  end

  test "set_body rejects mismatched mail and content counts" do
    assert {:ok, mails} =
             Page.create_mails("mailer@aegee.org", ["one@aegee.org", "two@aegee.org"], "Ahoy")

    assert {:error, "Mismatch in amounts of mails and amounts of template bodies"} =
             Page.set_body(mails, ["only one body"])
  end

  test "set_body applies the same body to every mail" do
    assert {:ok, mails} =
             Page.create_mails("mailer@aegee.org", ["one@aegee.org", "two@aegee.org"], "Ahoy")

    assert {:ok, mails_with_body} = Page.set_body(mails, "<b>Hello</b>")

    assert Enum.all?(mails_with_body, &(&1.html_body == "<b>Hello</b>"))
  end

  test "set_additional_headers applies reply-to, cc, and bcc" do
    assert {:ok, mail} =
             Page.create_mails("mailer@aegee.org", "one@aegee.org", "Ahoy")

    assert {:ok, mail} =
             Page.set_additional_headers(mail, %{
               "reply_to" => "reply@aegee.org",
               "cc" => "cc@aegee.org",
               "bcc" => "bcc@aegee.org"
             })

    assert mail.headers["Reply-To"] == "reply@aegee.org"
    assert mail.cc == [nil: "cc@aegee.org"]
    assert mail.bcc == [nil: "bcc@aegee.org"]
  end
end
