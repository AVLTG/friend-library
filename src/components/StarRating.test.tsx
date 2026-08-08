import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StarRating from "./StarRating";

function EditableRating() {
  const [value, setValue] = useState<number | null>(2.5);
  return (
    <StarRating
      value={value}
      onChange={setValue}
      label="Your rating"
      size="lg"
    />
  );
}

describe("StarRating", () => {
  it("supports half-star changes from the keyboard", () => {
    render(<EditableRating />);

    const rating = screen.getByRole("slider", { name: "Your rating" });
    expect(rating).toHaveAttribute("aria-valuenow", "2.5");

    fireEvent.keyDown(rating, { key: "ArrowRight" });
    expect(rating).toHaveAttribute("aria-valuenow", "3");

    fireEvent.keyDown(rating, { key: "Home" });
    expect(rating).toHaveAttribute("aria-valuenow", "0");
    expect(rating).toHaveAttribute("aria-valuetext", "Not rated");
  });

  it("announces an unset value and starts at half a star", () => {
    function Unrated() {
      const [value, setValue] = useState<number | null>(null);
      return <StarRating value={value} onChange={setValue} label="Rating" />;
    }

    render(<Unrated />);
    const rating = screen.getByRole("slider", { name: "Rating" });
    expect(rating).toHaveAttribute("aria-valuetext", "Not rated");

    fireEvent.keyDown(rating, { key: "ArrowRight" });
    expect(rating).toHaveAttribute("aria-valuenow", "0.5");
    expect(rating).toHaveAttribute("aria-valuetext", "0.5 out of 5 stars");
  });

  it("exposes readonly ratings as concise noninteractive text", () => {
    render(<StarRating value={4.5} readonly label="Amir's rating" />);

    expect(
      screen.getByRole("img", { name: "Amir's rating: 4.5 out of 5 stars" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
