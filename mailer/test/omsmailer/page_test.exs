defmodule Omsmailer.PageTest do
  use ExUnit.Case, async: true

  alias Omsmailer.Page

  test "set_body returns a 3-tuple error when mail and body counts differ" do
    {:ok, mails} = Page.create_mails("mailer@aegee.org", ["first@aegee.org", "second@aegee.org"], "pirates")

    assert Page.set_body(mails, ["one", "two", "three"]) ==
             {:error, :unprocessable_entity, "Mismatch in amounts of mails and amounts of template bodies"}
  end

  test "create_mails makes one mail per recipient" do
    assert {:ok, [first, second]} = Page.create_mails("mailer@aegee.org", ["first@aegee.org", "second@aegee.org"], "Subject")
    assert {first.to, second.to} == {"first@aegee.org", "second@aegee.org"}
    assert {:ok, %Bamboo.Email{to: "only@aegee.org", subject: "Subject"}} = Page.create_mails("mailer@aegee.org", "only@aegee.org", "Subject")
  end

  test "create_mails refuses missing recipients and subjects" do
    for to <- [nil, "", []] do
      assert Page.create_mails("mailer@aegee.org", to, "Subject") == {:error, :unprocessable_entity, "Missing to address"}
    end

    for subject <- [nil, ""] do
      assert Page.create_mails("mailer@aegee.org", "a@aegee.org", subject) == {:error, :unprocessable_entity, "Missing subject"}
    end
  end

  test "set_body gives each mail its own body, or all mails the same one" do
    {:ok, mails} = Page.create_mails("mailer@aegee.org", ["first@aegee.org", "second@aegee.org"], "Subject")

    assert {:ok, [%{html_body: "one"}, %{html_body: "two"}]} = Page.set_body(mails, ["one", "two"])
    assert {:ok, [%{html_body: "same"}, %{html_body: "same"}]} = Page.set_body(mails, "same")
  end

  test "deliver_all_mails refuses a sender given as name and empty address" do
    mail = Bamboo.Email.new_email(to: "member@aegee.org", from: {"AEGEE", ""}, subject: "Subject")

    assert Page.deliver_all_mails(mail) == {:error, :unprocessable_entity, "Sender and recipient addresses must not be empty"}
  end

  test "check_request accepts a complete request" do
    assert Page.check_request(%{"template" => "custom", "parameters" => %{}, "to" => "a@aegee.org", "subject" => "Subject"}) == :ok
    assert Page.check_request(%{"template" => "custom", "parameters" => [%{}], "to" => ["a@aegee.org"], "subject" => "Subject"}) == :ok
  end

  test "render_template renders a list of parameter maps one by one" do
    assert {:ok, [one, two]} = Page.render_template("custom", [%{"email_body" => "one"}, %{"email_body" => "two"}])
    assert one =~ "one"
    assert two =~ "two"
    assert Page.render_template("custom", [%{"email_body" => "one"}, %{}]) == {:error, :unprocessable_entity, "Missing key \"email_body\""}
  end
end
