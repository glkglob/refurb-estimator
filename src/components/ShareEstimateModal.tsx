"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { createSharedEstimate, type SharedEstimateSnapshot } from "@/lib/share";

type ShareEstimateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  snapshot: SharedEstimateSnapshot;
};

const SHARE_DOMAIN = "https://refurb-estimator.vercel.app";

function formatExpiry(expiresAtIso: string) {
  const date = new Date(expiresAtIso);
  if (Number.isNaN(date.getTime())) return expiresAtIso;
  return date.toLocaleString();
}

export default function ShareEstimateModal({ isOpen, onClose, snapshot }: ShareEstimateModalProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (!token) return "";
    return `${SHARE_DOMAIN}/share/${token}`;
  }, [token]);

  async function handleCreateLink() {
    setIsCreating(true);
    try {
      const result = await createSharedEstimate(snapshot);
      setToken(result.token);
      setExpiresAt(result.expiresAt);
    } catch (error) {
      toast({
        title: "Share link failed",
        description: error instanceof Error ? error.message : "Unable to create share link",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Unable to copy link",
        variant: "destructive"
      });
    }
  }

  function handleClose() {
    // reset each close so a new estimate generates a new link
    setToken(null);
    setExpiresAt(null);
    setIsCreating(false);
    onClose();
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share estimate</DialogTitle>
          <DialogDescription>
            Create a read-only link you can send to builders, partners, or lenders. The link expires after 30 days.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Your shareable link</label>
              <Input readOnly value={shareUrl} />
            </div>

            <div className="text-sm text-muted-foreground">
              Expires: <span className="font-medium text-foreground">{expiresAt ? formatExpiry(expiresAt) : "—"}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="default" onClick={handleCopy}>
                Copy link
              </Button>
              <Button type="button" variant="outline" onClick={handleCreateLink} disabled={isCreating}>
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
                Generate new link
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button type="button" variant="default" onClick={handleCreateLink} disabled={isCreating}>
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
              Create share link
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
