/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateForm from "./EstimateForm";
import { PROPERTY_TYPE_DISPLAY_ORDER } from "@/lib/propertyType";

describe("EstimateForm", () => {
  test("shows required validation errors when submitted empty", async () => {
    const onSubmit = jest.fn();
    const onValidationError = jest.fn();
    const user = userEvent.setup();

    render(<EstimateForm onSubmit={onSubmit} onValidationError={onValidationError} />);

    await user.click(screen.getByRole("button", { name: /calculate estimate/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Property type is required")).toBeInTheDocument();
  });

  test("renders all supported property type options in the dropdown", () => {
    render(<EstimateForm onSubmit={jest.fn()} />);

    const optionValues = Array.from(document.querySelectorAll("option"), (option) => option.value);
    expect(optionValues).toEqual(expect.arrayContaining(PROPERTY_TYPE_DISPLAY_ORDER));
    expect(PROPERTY_TYPE_DISPLAY_ORDER).toHaveLength(14);
  });
});
