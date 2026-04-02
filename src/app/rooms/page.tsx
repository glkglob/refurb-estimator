"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";

import AuthBanner from "@/components/AuthBanner";
import EstimateAssistantPanel from "@/components/EstimateAssistantPanel";
import ScenarioLimitPromptDialog from "@/components/ScenarioLimitPromptDialog";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import ShareEstimateModal from "@/components/ShareEstimateModal";
import TermTooltip from "@/components/TermTooltip";
import { ValueUpliftCard } from "@/components/ValueUpliftCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { AssistantAction } from "@/lib/assistant/schemas";
import { applyEditorActionsToRoomsState } from "@/lib/assistant/roomsActions";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { saveScenario } from "@/lib/dataService";
import { estimateRooms } from "@/lib/estimator";
import { PropertyType } from "@/lib/propertyType";
import { applyLabourToEstimateResult } from "@/lib/pricing/applyLabourCost";
import {
  estimateLabourCost,
  LABOUR_REGION_OPTIONS,
  type LabourRegion,
  TRADE_RATES,
} from "@/lib/pricing/tradeRates";
import type { SharedEstimateSnapshot } from "@/lib/share";
import { ScenarioLimitExceededError } from "@/lib/storage";
import type {
  Condition,
  EstimateInput,
  RoomInput,
  RoomType,
  Scenario,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { REGION_VALUES, type Region } from "@/lib/domain/region";

const EstimateResults = dynamic(() => import("@/components/EstimateResults"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-muted" />,
});


const CONDITIONS: Condition[] = ["poor", "fair", "good"];

const ROOM_TYPES: RoomType[] = [
  "kitchen",
  "bathroom",
  "bedroom",
  "living",
  "hallway",
  "utility",
];

const FINISH_LEVELS: RoomInput["finishLevel"][] = [
  "budget",
  "standard",
  "premium",
];

const INTENSITY_OPTIONS: RoomInput["intensity"][] = ["light", "full"];

const INITIAL_ROOMS: RoomInput[] = [
  {
    id: "room-1",
    roomType: "kitchen",
    areaM2: 15,
    intensity: "full",
    finishLevel: "standard",
  },
  {
    id: "room-2",
    roomType: "bathroom",
    areaM2: 5,
    intensity: "full",
    finishLevel: "standard",
  },
];

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function RoomsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [region, setRegion] = useState<Region>("east_midlands");
  const [condition, setCondition] = useState<Condition>("fair");
  const [tradeId, setTradeId] = useState<string>("general_builder");
  const [labourDays, setLabourDays] = useState<number>(1);
  const [labourRegion, setLabourRegion] = useState<LabourRegion>("midlands");
  const [contractorPostcode, setContractorPostcode] = useState("");
  const [rooms, setRooms] = useState<RoomInput[]>(INITIAL_ROOMS);
  const [nextRoomId, setNextRoomId] = useState(3);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isScenarioLimitPromptOpen, setIsScenarioLimitPromptOpen] = useState(false);

  const shouldScrollToResultsRef = useRef(false);

  function markShouldScroll(): void {
    shouldScrollToResultsRef.current = true;
  }

  function updateRoom(id: string, patch: Partial<Omit<RoomInput, "id">>): void {
    setRooms((prev) =>
      prev.map((room) => (room.id === id ? { ...room, ...patch } : room)),
    );
    markShouldScroll();
  }

  function addRoom(): void {
    setRooms((prev) => [
      ...prev,
      {
        id: `room-${nextRoomId}`,
        roomType: "bedroom",
        areaM2: 12,
        intensity: "full",
        finishLevel: "standard",
      },
    ]);
    setNextRoomId((prev) => prev + 1);
    markShouldScroll();
  }

  function removeRoom(id: string): void {
    setRooms((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((room) => room.id !== id);
    });

    markShouldScroll();
  }

  function handleApplyAssistantEditorActions(actions: AssistantAction[]): void {
    const applied = applyEditorActionsToRoomsState(
      {
        region,
        condition,
        rooms,
        nextRoomId
      },
      actions
    );

    if (applied.changedFields.length === 0 || !applied.shouldRecalculate) {
      return;
    }

    setRegion(applied.nextState.region);
    setCondition(applied.nextState.condition);
    setRooms(applied.nextState.rooms);
    setNextRoomId(applied.nextState.nextRoomId);
    markShouldScroll();
  }

  const calculation = useMemo(() => {
    const labour = estimateLabourCost(tradeId, labourDays, labourRegion);
    const totalAreaM2 = rooms.reduce((sum, room) => sum + room.areaM2, 0);

    try {
      const baseResult = estimateRooms(rooms, { region, condition }, defaultCostLibrary);
      return {
        result: applyLabourToEstimateResult(baseResult, labour, totalAreaM2),
        labour,
        error: null as string | null,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          result: null,
          labour: null as { low: number; mid: number; high: number } | null,
          error: error.message,
        };
      }

      return {
        result: null,
        labour: null as { low: number; mid: number; high: number } | null,
        error: "Unable to estimate rooms",
      };
    }
  }, [condition, labourDays, labourRegion, region, rooms, tradeId]);

  useEffect(() => {
    if (!shouldScrollToResultsRef.current) {
      return;
    }

    if (calculation.result) {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      shouldScrollToResultsRef.current = false;
    }
  }, [calculation.result]);

  const estimateInput = useMemo<EstimateInput>(() => {
    const totalAreaM2 = rooms.reduce((sum, room) => sum + room.areaM2, 0);

    return {
      region,
      projectType: "refurb",
      propertyType: PropertyType.FLAT_APARTMENT,
      totalAreaM2,
      condition,
      finishLevel: "standard",
      rooms,
    };
  }, [rooms, region, condition]);

  const shareSnapshot = useMemo<SharedEstimateSnapshot | null>(() => {
    if (!calculation.result) {
      return null;
    }

    return {
      kind: "rooms",
      input: estimateInput,
      result: calculation.result,
    };
  }, [estimateInput, calculation.result]);

  async function handleSaveScenario(
    name: string,
    purchasePrice?: number,
    gdv?: number,
  ): Promise<void> {
    if (!calculation.result) {
      return;
    }

    const timestamp = new Date().toISOString();

    const scenario: Scenario = {
      id: crypto.randomUUID(),
      name,
      input: estimateInput,
      result: calculation.result,
      createdAt: timestamp,
      updatedAt: timestamp,
      purchasePrice,
      gdv,
    };

    try {
      await saveScenario(scenario);
      setIsSaveModalOpen(false);

      toast({
        title: "Scenario saved",
        description: "You can compare it on the Scenario Comparison page.",
      });
    } catch (error) {
      setIsSaveModalOpen(false);

      if (error instanceof ScenarioLimitExceededError) {
        setIsScenarioLimitPromptOpen(true);
        return;
      }

      toast({
        title: "Scenario saved locally",
        description:
          error instanceof Error
            ? error.message
            : "Cloud sync failed. Scenario was saved locally.",
        variant: "destructive",
      });
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Detailed Rooms</h1>

      <AuthBanner />

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="rooms-region">Region</Label>
            <Select
              value={region}
              onValueChange={(value) => {
                setRegion(value as Region);
                markShouldScroll();
              }}
            >
              <SelectTrigger id="rooms-region" className="w-full">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {REGION_VALUES.map((regionValue) => (
                  <SelectItem key={regionValue} value={regionValue}>
                    {regionValue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="rooms-condition">Condition</Label>
            <Select
              value={condition}
              onValueChange={(value) => {
                setCondition(value as Condition);
                markShouldScroll();
              }}
            >
              <SelectTrigger id="rooms-condition" className="w-full">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {CONDITIONS.map((conditionValue) => (
                  <SelectItem key={conditionValue} value={conditionValue}>
                    {formatLabel(conditionValue)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="rooms-postcode">Postcode (for contractor matching)</Label>
            <Input
              id="rooms-postcode"
              maxLength={10}
              placeholder="e.g. SW1A 1AA"
              value={contractorPostcode}
              onChange={(event) => setContractorPostcode(event.target.value.toUpperCase())}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Labour Assumptions
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="rooms-trade">Trade</Label>
              <select
                id="rooms-trade"
                value={tradeId}
                onChange={(event) => {
                  setTradeId(event.target.value);
                  markShouldScroll();
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TRADE_RATES.map((trade) => (
                  <option key={trade.id} value={trade.id}>
                    {trade.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rooms-labour-days">Days</Label>
              <Input
                id="rooms-labour-days"
                type="number"
                min={1}
                step={1}
                value={labourDays}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setLabourDays(
                    Number.isFinite(nextValue) && nextValue >= 1 ? Math.floor(nextValue) : 1,
                  );
                  markShouldScroll();
                }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rooms-labour-region">Region</Label>
              <select
                id="rooms-labour-region"
                value={labourRegion}
                onChange={(event) => {
                  setLabourRegion(event.target.value as LabourRegion);
                  markShouldScroll();
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {LABOUR_REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {calculation.labour ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-lg font-medium">
                Labour estimate: £{calculation.labour.low.toLocaleString("en-GB")} – £
                {calculation.labour.high.toLocaleString("en-GB")} (typical: £
                {calculation.labour.mid.toLocaleString("en-GB")})
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rates sourced from Checkatrade &amp; industry aggregators, April 2026. Excludes
                materials, VAT, and specialist certifications.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Workscope guide:{" "}
          <TermTooltip
            term="First fix"
            explanation="Initial installation of wiring, pipes, and heating before plastering."
          />{" "}
          and{" "}
          <TermTooltip
            term="Second fix"
            explanation="Final fitting of sockets, taps, radiators, and light fixtures after plastering."
          />
          .
        </p>

        {rooms.map((room, index) => {
          const hasAreaError = !Number.isFinite(room.areaM2) || room.areaM2 <= 0;

          return (
            <Card key={room.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">Room {index + 1}</CardTitle>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeRoom(room.id)}
                    disabled={rooms.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Room type</Label>
                    <Select
                      value={room.roomType}
                      onValueChange={(value) =>
                        updateRoom(room.id, { roomType: value as RoomType })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {ROOM_TYPES.map((roomType) => (
                          <SelectItem key={roomType} value={roomType}>
                            {formatLabel(roomType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Area (m²)</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 12"
                      value={room.areaM2}
                      onChange={(event) =>
                        updateRoom(room.id, { areaM2: Number(event.target.value) })
                      }
                      aria-invalid={hasAreaError}
                      className={cn("w-full", hasAreaError && "border-destructive")}
                    />

                    {hasAreaError ? (
                      <div className="bp-warning mt-1 flex items-start gap-1.5 rounded-md border px-2 py-1 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <p className="text-destructive">
                          Area must be greater than zero
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <Label>Intensity</Label>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {INTENSITY_OPTIONS.map((intensity) => {
                        const isActive = room.intensity === intensity;

                        return (
                          <Button
                            key={intensity}
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            onClick={() => updateRoom(room.id, { intensity })}
                          >
                            {formatLabel(intensity)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Finish level</Label>
                    <Select
                      value={room.finishLevel}
                      onValueChange={(value) =>
                        updateRoom(room.id, {
                          finishLevel: value as RoomInput["finishLevel"],
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {FINISH_LEVELS.map((finishLevel) => (
                          <SelectItem key={finishLevel} value={finishLevel}>
                            {formatLabel(finishLevel)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button type="button" variant="outline" onClick={addRoom}>
        <Plus className="size-4" />
        Add room
      </Button>

      {calculation.error ? (
        <div className="bp-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="font-medium text-destructive">{calculation.error}</p>
        </div>
      ) : null}

      {calculation.result ? (
        <div id="results" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => setIsSaveModalOpen(true)}
            >
              Save as Scenario
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsShareModalOpen(true)}
            >
              Share estimate
            </Button>

            <Button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  postcode: contractorPostcode.trim().toUpperCase(),
                  estimate: String(Math.round(calculation.result.totalTypical)),
                });
                router.push(`/tradespeople?${params.toString()}`);
              }}
            >
              Get quotes from vetted contractors →
            </Button>
          </div>

          <EstimateResults result={calculation.result} />

          <ValueUpliftCard refurbCost={calculation.result.totalTypical} />

          <EstimateAssistantPanel
            mode="rooms"
            estimateInput={estimateInput}
            estimateResult={calculation.result}
            onApplyEditorActions={handleApplyAssistantEditorActions}
          />
        </div>
      ) : null}

      <SaveScenarioModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveScenario}
      />

      {shareSnapshot ? (
        <ShareEstimateModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          snapshot={shareSnapshot}
        />
      ) : null}

      <ScenarioLimitPromptDialog
        isOpen={isScenarioLimitPromptOpen}
        onOpenChange={setIsScenarioLimitPromptOpen}
      />
    </section>
  );
}
