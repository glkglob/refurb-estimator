/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import TradespeoplePage from "./page";
import { listPublicTradespeople } from "@/lib/supabase/profiles-db";

jest.mock("@/components/tradespeople/ContractorEnquiryForm", () => ({
  __esModule: true,
  default: () => <div data-testid="contractor-enquiry-form">Contractor enquiry form</div>
}));

jest.mock("@/lib/supabase/profiles-db", () => ({
  listPublicTradespeople: jest.fn()
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt,
    ...props
  }: {
    alt: string;
    [key: string]: unknown;
  }) => <span aria-label={alt} data-next-image="mocked" {...props} />
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>
}));

const mockedListPublicTradespeople = jest.mocked(listPublicTradespeople);

describe("TradespeoplePage", () => {
  beforeEach(() => {
    mockedListPublicTradespeople.mockReset();
  });

  test("renders fallback state when directory lookup fails", async () => {
    mockedListPublicTradespeople.mockRejectedValueOnce(new Error("Missing Supabase env"));

    render(await TradespeoplePage({ searchParams: {} }));

    expect(screen.getByTestId("contractor-enquiry-form")).toBeInTheDocument();
    expect(
      screen.getByText(/The trades directory is temporarily unavailable\./i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No public tradespeople matched your filters\./i)
    ).not.toBeInTheDocument();
  });

  test("renders standard empty state when directory lookup succeeds with no rows", async () => {
    mockedListPublicTradespeople.mockResolvedValueOnce({ data: [], total: 0 });

    render(await TradespeoplePage({ searchParams: {} }));

    expect(
      screen.queryByText(/The trades directory is temporarily unavailable\./i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No public tradespeople matched your filters\./i)).toBeInTheDocument();
  });
});
