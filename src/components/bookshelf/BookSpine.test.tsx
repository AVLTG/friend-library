import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  coverUrl: "https://example.com/cover.jpg",
};

describe("BookSpine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts one optimized cover image until the preview is shown", () => {
    const { container } = render(
      <BookSpine book={book} index={0} href="/book/book-1" />,
    );

    const spineImage = container.querySelector("img");
    expect(spineImage).toHaveAttribute("sizes", "55px");
    expect(spineImage).toHaveAttribute(
      "src",
      expect.stringContaining("/_next/image"),
    );
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(
      screen.getByRole("link", {
        name: "Accessible Bookshelves by Ada Reader",
      }),
    );

    const previewImage = screen.getByRole("tooltip").querySelector("img");
    expect(previewImage).toHaveAttribute("sizes", "120px");
    expect(previewImage).toHaveAttribute(
      "src",
      expect.stringContaining("/_next/image"),
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

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

  it("does not mount the preview image when delayed hover is cancelled", () => {
    vi.useFakeTimers();
    const { container } = render(
      <BookSpine book={book} index={0} href="/book/book-1" />,
    );
    const link = screen.getByRole("link", {
      name: "Accessible Bookshelves by Ada Reader",
    });

    fireEvent.mouseEnter(link);
    fireEvent.mouseLeave(link);
    act(() => vi.advanceTimersByTime(600));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("defers the preview image until hover is sustained for 600ms", () => {
    vi.useFakeTimers();
    const { container } = render(
      <BookSpine book={book} index={0} href="/book/book-1" />,
    );
    const link = screen.getByRole("link", {
      name: "Accessible Bookshelves by Ada Reader",
    });

    fireEvent.mouseEnter(link);
    act(() => vi.advanceTimersByTime(599));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("tooltip").querySelector("img")).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("renders no images for a book without a cover, including in its preview", () => {
    const { container } = render(
      <BookSpine
        book={{ ...book, coverUrl: null }}
        index={0}
        href="/book/book-1"
      />,
    );
    const link = screen.getByRole("link", {
      name: "Accessible Bookshelves by Ada Reader",
    });

    expect(container.querySelectorAll("img")).toHaveLength(0);
    fireEvent.focus(link);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
