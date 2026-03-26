/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import ContractorEnquiryForm from "./ContractorEnquiryForm";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn()
}));

const mockedUseSearchParams = jest.mocked(useSearchParams);
const originalFetch = global.fetch;

function mockSearchParams(values: Record<string, string> = {}): void {
  mockedUseSearchParams.mockReturnValue(
    new URLSearchParams(values) as unknown as ReturnType<typeof useSearchParams>
  );
}

describe("ContractorEnquiryForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("prefills postcode and estimate from URL query params", () => {
    mockSearchParams({
      postcode: "sw1a 1aa",
      estimate: "£85000"
    });

    render(<ContractorEnquiryForm />);

    expect(screen.getByLabelText(/Postcode/i)).toHaveValue("SW1A 1AA");
    expect(screen.getByLabelText(/Estimate Total \(optional\)/i)).toHaveValue(85000);
  });

  test("marks key fields as required", () => {
    render(<ContractorEnquiryForm />);

    expect(screen.getByLabelText(/Name/i)).toBeRequired();
    expect(screen.getByLabelText(/Email/i)).toBeRequired();
    expect(screen.getByLabelText(/Postcode/i)).toBeRequired();
    expect(screen.getByLabelText(/Project Type/i)).toBeRequired();
    expect(screen.getByLabelText(/Budget Range/i)).toBeRequired();
  });

  test("submits a valid enquiry and shows success message", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });

    render(<ContractorEnquiryForm />);

    await user.type(screen.getByLabelText(/Name/i), "Alex Builder");
    await user.type(screen.getByLabelText(/Email/i), "alex@example.com");
    await user.type(screen.getByLabelText(/Postcode/i), "SW1A 1AA");
    await user.selectOptions(screen.getByLabelText(/Project Type/i), "Extension");
    await user.selectOptions(screen.getByLabelText(/Budget Range/i), "£50,000 - £100,000");
    await user.type(screen.getByLabelText(/Estimate Total \(optional\)/i), "85000");
    await user.type(screen.getByLabelText(/Message \(optional\)/i), "Single storey rear extension.");
    await user.click(screen.getByRole("button", { name: /Submit enquiry/i }));

    await waitFor(() => {
      expect(screen.getByText("Thanks! We'll match you with local contractors shortly.")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/enquiries", expect.any(Object));

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(fetchCall[0]).toBe("/api/enquiries");

    const payload = JSON.parse(String(fetchCall[1].body)) as {
      name: string;
      email: string;
      postcode: string;
      projectType: string;
      budgetRange: string;
      estimateTotal: number;
      message: string;
    };

    expect(payload).toEqual({
      name: "Alex Builder",
      email: "alex@example.com",
      postcode: "SW1A 1AA",
      projectType: "Extension",
      budgetRange: "£50,000 - £100,000",
      estimateTotal: 85000,
      message: "Single storey rear extension."
    });
  });

  test("surfaces API errors to the user", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: "Submission failed" })
    });

    render(<ContractorEnquiryForm />);

    await user.type(screen.getByLabelText(/Name/i), "Alex Builder");
    await user.type(screen.getByLabelText(/Email/i), "alex@example.com");
    await user.type(screen.getByLabelText(/Postcode/i), "SW1A 1AA");
    await user.selectOptions(screen.getByLabelText(/Project Type/i), "Extension");
    await user.selectOptions(screen.getByLabelText(/Budget Range/i), "£50,000 - £100,000");
    await user.click(screen.getByRole("button", { name: /Submit enquiry/i }));

    await waitFor(() => {
      expect(screen.getByText("Submission failed")).toBeInTheDocument();
    });
  });
});
