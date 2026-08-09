import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoadError from "./LoadError";
import LoadingState from "./LoadingState";

describe("LoadingState", () => {
  it("announces the visible loading message", () => {
    render(<LoadingState message="Loading your library..." className="h-[400px]" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your library...");
    expect(screen.getByRole("status")).toHaveClass("h-[400px]");
  });
});

describe("LoadError", () => {
  it("preserves the error heading, message, and retry action name", () => {
    const onRetry = vi.fn();
    render(
      <LoadError
        title="Couldn't load your library"
        message="The request failed."
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Couldn't load your library" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The request failed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
