import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BookSpine from "./BookSpine";

const book = {
  id: "book-1",
  title: "Accessible Bookshelves",
  authors: ["Ada Reader"],
  spineColor: "#4A3728",
  pageCount: 240,
  averageRating: 4.5,
  owners: [
    { id: "user-1", firstName: "Ada", avatarColor: "#3A5A8B" },
  ],
};

describe("BookSpine", () => {
  it("is a named link and reveals its preview on keyboard focus", async () => {
    render(<BookSpine book={book} index={0} href="/book/book-1" />);

    const link = screen.getByRole("link", {
      name: "Accessible Bookshelves by Ada Reader",
    });
    expect(link).toHaveAttribute("href", "/book/book-1");

    link.focus();
    fireEvent.focus(link);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Accessible Bookshelves",
    );

    fireEvent.keyDown(link, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
    expect(link).toHaveFocus();
  });
});
