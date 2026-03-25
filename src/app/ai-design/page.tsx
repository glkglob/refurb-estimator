"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";

const ROOM_TYPES = ["Living Room", "Kitchen", "Bathroom", "Bedroom", "Hallway", "Other"] as const;
const STYLES = ["Modern", "Contemporary", "Traditional", "Industrial", "Scandinavian", "Maximalist"] as const;
const BUDGETS = ["Under £5k", "£5k-£15k", "£15k-£30k", "£30k-£50k", "£50k+"] as const;

type ColourSwatch = { name: string; hex: string; usage: string };
type Material = { item: string; description: string; supplier: string; estimatedCost: number };
type DesignResponse = {
  currentAssessment: string;
  designConcept: string;
  colourPalette: ColourSwatch[];
  materialRecommendations: Material[];
  roomTransformation: string;
  estimatedCost: { low: number; typical: number; high: number };
  nextSteps: string[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function AiDesignPage() {
  const [roomType, setRoomType] = useState<string>(ROOM_TYPES[0]);
  const [style, setStyle] = useState<string>(STYLES[0]);
  const [budget, setBudget] = useState<string>(BUDGETS[2]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const photos = photoUrl.trim() ? [photoUrl.trim()] : ["https://example.com/placeholder.jpg"];
      const response = await apiFetch("/api/v1/ai/design-agent", {
        method: "POST",
        body: JSON.stringify({ photos, roomType, style, budget })
      });
      const payload = await response.json() as DesignResponse;
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate design.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI Design Agent</h1>
        <p className="text-sm text-muted-foreground">Get AI-powered interior design recommendations</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Room Details</CardTitle>
          <CardDescription>Tell us about the room you want to redesign</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Room Type</p>
                <Select value={roomType} onValueChange={setRoomType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROOM_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Style</p>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Budget</p>
                <Select value={budget} onValueChange={setBudget}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUDGETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Photo URL (optional)</p>
              <Input placeholder="https://example.com/room.jpg" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">Paste a public URL to a room photo for better results</p>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Generating...</> : "Generate Design"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {result ? <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Design Concept</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{result.currentAssessment}</p>
              <p className="text-sm font-medium">{result.designConcept}</p>
              <p className="text-sm">{result.roomTransformation}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Colour Palette</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {result.colourPalette.map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <div className="size-8 rounded-full border" style={{ backgroundColor: c.hex }} />
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.usage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Materials &amp; Costs</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.materialRecommendations.map((m) => (
                  <div key={m.item} className="flex items-start justify-between border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{m.item}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                      <p className="text-xs text-muted-foreground">Supplier: {m.supplier}</p>
                    </div>
                    <p className="text-sm font-semibold">{fmt(m.estimatedCost)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center">
                <div><p className="text-xs text-muted-foreground">Low</p><p className="font-semibold">{fmt(result.estimatedCost.low)}</p></div>
                <div><p className="text-xs text-muted-foreground">Typical</p><p className="font-semibold">{fmt(result.estimatedCost.typical)}</p></div>
                <div><p className="text-xs text-muted-foreground">High</p><p className="font-semibold">{fmt(result.estimatedCost.high)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Next Steps</CardTitle></CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-1">
                {result.nextSteps.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
              </ol>
            </CardContent>
          </Card>
        </div> : null}
    </section>
  );
}
