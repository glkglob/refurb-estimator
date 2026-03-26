"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type ScenarioLimitPromptDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ScenarioLimitPromptDialog({
  isOpen,
  onOpenChange
}: ScenarioLimitPromptDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save and compare multiple scenarios</DialogTitle>
          <DialogDescription>
            Sign in to save and compare multiple scenarios.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-0 bg-transparent p-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href="/auth/signin">Sign in to unlock</Link>
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/auth/signup">Create free account</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
