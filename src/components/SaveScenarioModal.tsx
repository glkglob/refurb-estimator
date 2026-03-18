"use client";

import { useEffect, useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

type SaveScenarioModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, purchasePrice?: number, gdv?: number) => void;
};

export default function SaveScenarioModal({
  isOpen,
  onClose,
  onSave
}: SaveScenarioModalProps) {
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [gdv, setGdv] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setPurchasePrice("");
      setGdv("");
      setNameError(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  function parseOptionalNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    return parsed;
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Scenario name is required");
      return;
    }

    onSave(trimmedName, parseOptionalNumber(purchasePrice), parseOptionalNumber(gdv));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900">Save Scenario</h2>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="scenario-name" className="text-sm font-medium text-slate-700">
              Scenario name
            </label>
            <input
              id="scenario-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) {
                  setNameError(null);
                }
              }}
              className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 ${
                nameError
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-300 focus:border-slate-500 focus:ring-slate-200"
              }`}
            />
            {nameError ? <p className="text-sm text-red-600">{nameError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="scenario-purchase-price" className="text-sm font-medium text-slate-700">
              Purchase price
            </label>
            <input
              id="scenario-purchase-price"
              type="number"
              placeholder="e.g. 150000"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="scenario-gdv" className="text-sm font-medium text-slate-700">
              <InfoTooltip
                term="GDV"
                explanation="Gross Development Value — the estimated market value of the property after refurbishment."
              />
            </label>
            <input
              id="scenario-gdv"
              type="number"
              placeholder="e.g. 250000"
              value={gdv}
              onChange={(event) => setGdv(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
