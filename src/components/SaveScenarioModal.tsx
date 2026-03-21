"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import TermTooltip from "@/components/TermTooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SaveScenarioModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, purchasePrice?: number, gdv?: number) => void;
  isSaving?: boolean;
};

export default function SaveScenarioModal({
  isOpen,
  onClose,
  onSave,
  isSaving = false
}: SaveScenarioModalProps) {
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [gdv, setGdv] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setPurchasePrice("");
    setGdv("");
    setNameError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Scenario</DialogTitle>
          <DialogDescription>
            Save this estimate so you can compare scenarios and track budget variance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="scenario-name">Scenario name</Label>
            <Input
              id="scenario-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) {
                  setNameError(null);
                }
              }}
              aria-invalid={Boolean(nameError)}
              className={nameError ? "border-destructive" : ""}
            />
            {nameError ? (
              <div className="bp-warning mt-1 flex items-start gap-1.5 rounded-md border px-2 py-1">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{nameError}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="scenario-purchase-price">Purchase price</Label>
            <Input
              id="scenario-purchase-price"
              type="number"
              placeholder="e.g. 150000"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="scenario-gdv">
              <TermTooltip
                term="GDV"
                explanation="Gross Development Value — the estimated market value of the property after refurbishment."
              />
            </Label>
            <Input
              id="scenario-gdv"
              type="number"
              placeholder="e.g. 250000"
              value={gdv}
              onChange={(event) => setGdv(event.target.value)}
            />
          </div>

          <DialogFooter className="border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
