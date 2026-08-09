import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PasswordField from "./PasswordField";

function ControlledPasswordField({ error }: { error?: string }) {
  const [value, setValue] = useState("Secret123!");
  return (
    <PasswordField
      id="account-password"
      name="password"
      label="Current Password"
      autoComplete="current-password"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      help="Use the password you sign in with."
      helpId="password-help"
      error={error}
      errorId="password-error"
    />
  );
}

describe("PasswordField", () => {
  it("preserves the controlled input contract and help linkage", () => {
    render(<ControlledPasswordField />);

    const input = screen.getByLabelText("Current Password");
    expect(input).toHaveAttribute("id", "account-password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).toHaveValue("Secret123!");
    expect(input).toHaveAttribute("aria-describedby", "password-help");

    fireEvent.change(input, { target: { value: "Updated456!" } });
    expect(input).toHaveValue("Updated456!");
  });

  it("links errors and exposes them as alerts", () => {
    render(<ControlledPasswordField error="That password is incorrect." />);

    expect(screen.getByRole("alert")).toHaveTextContent("That password is incorrect.");
    expect(screen.getByLabelText("Current Password")).toHaveAttribute(
      "aria-describedby",
      "password-help password-error",
    );
    expect(screen.getByLabelText("Current Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("reveals and hides the value without losing reveal-button focus", () => {
    render(<ControlledPasswordField />);

    const input = screen.getByLabelText("Current Password");
    const reveal = screen.getByRole("button", { name: "Show current password" });
    reveal.focus();
    fireEvent.click(reveal);

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide current password" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Hide current password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show current password" })).toHaveFocus();
  });
});
