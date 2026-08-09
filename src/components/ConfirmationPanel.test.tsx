import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmationPanel from "./ConfirmationPanel";

function renderPanel({
  pending = false,
  confirmDisabled = false,
  cancelDisabled = false,
} = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const cancelRef = createRef<HTMLButtonElement>();
  render(
    <ConfirmationPanel
      id="remove-confirmation"
      titleId="remove-title"
      descriptionId="remove-description"
      title="Remove your activity?"
      description="Your statuses, rating, and review will be removed."
      variant="warm"
      confirmLabel="Remove my activity"
      pendingLabel="Removing..."
      pending={pending}
      confirmIcon={<span aria-hidden="true">x</span>}
      confirmDisabled={confirmDisabled}
      cancelDisabled={cancelDisabled}
      cancelRef={cancelRef}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel, cancelRef };
}

describe("ConfirmationPanel", () => {
  it("uses named non-modal region semantics and exposes the cancel ref", () => {
    const { cancelRef } = renderPanel();

    expect(
      screen.getByRole("region", { name: "Remove your activity?" }),
    ).toHaveAccessibleDescription(
      "Your statuses, rating, and review will be removed.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    cancelRef.current?.focus();
    expect(cancelRef.current).toHaveFocus();
  });

  it("runs confirm, cancel, and Escape actions", () => {
    const { onConfirm, onCancel } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Remove my activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("preserves pending labels and disabled actions", () => {
    const { onCancel } = renderPanel({
      pending: true,
      confirmDisabled: true,
      cancelDisabled: true,
    });

    expect(screen.getByRole("button", { name: "Removing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
