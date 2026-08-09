import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FeedbackMessage from "./FeedbackMessage";

describe("FeedbackMessage", () => {
  it("uses alert semantics for errors", () => {
    render(<FeedbackMessage type="error">Unable to save.</FeedbackMessage>);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to save.");
  });

  it.each(["success", "status"] as const)(
    "uses status semantics for %s feedback",
    (type) => {
      render(<FeedbackMessage type={type}>Saved.</FeedbackMessage>);
      expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    },
  );

  it("forwards a focus ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FeedbackMessage ref={ref} tabIndex={-1} type="success">
        Activity removed.
      </FeedbackMessage>,
    );

    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });
});
