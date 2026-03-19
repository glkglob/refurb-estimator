"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EstimateResults from "@/components/EstimateResults";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import TermTooltip from "@/components/TermTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { saveScenario } from "@/lib/dataService";
import { estimateRooms } from "@/lib/estimator";
import type {
  Condition,
  EstimateInput,
  Region,
  RoomInput,
  RoomType,
  Scenario
} from "@/lib/types";
import { cn } from "@/lib/utils";

const regions: Region[] = [
  "London",
  "SouthEast",
  "Midlands",
  "North",
  "Scotland",
  "Wales"
];

const conditions: Condition[] = ["poor", "fair", "good"];
const roomTypes: RoomType[] = [
  "kitchen",
  "bathroom",
  "bedroom",
  "living",
  "hallway",
  "utility"
];
const finishLevels: RoomInput["finishLevel"][] = ["budget", "standard", "premium"];
const intensityOptions: RoomInput["intensity"][] = ["light", "full"];

export default function RoomsPage() {
  const [region, setRegion] = useState<Region>("Midlands");
  const [condition, setCondition] = useState<Condition>("fair");
  const [rooms, setRooms] = useState<RoomInput[]>([
    {
      id: "room-1",
      roomType: "kitchen",
      areaM2: 15,
      intensity: "full",
      finishLevel: "standard"
    },
    {
      id: "room-2",
      roomType: "bathroom",
      areaM2: 5,
      intensity: "full",
      finishLevel: "standard"
    }
  ]);
  const [nextRoomId, setNextRoomId] = useState(3);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false);
  const { toast } = useToast();

  function updateRoom(id: string, patch: Partial<Omit<RoomInput, "id">>) {
    setRooms((prev) =>
      prev.map((room) => (room.id === id ? { ...room, ...patch } : room))
    );
    setShouldScrollToResults(true);
  }

  function addRoom() {
    setRooms((prev) => [
      ...prev,
      {
        id: `room-${nextRoomId}`,
        roomType: "bedroom",
        areaM2: 12,
        intensity: "full",
        finishLevel: "standard"
      }
    ]);
    setNextRoomId((prev) => prev + 1);
    setShouldScrollToResults(true);
  }

  function removeRoom(id: string) {
    setRooms((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((room) => room.id !== id);
    });
    setShouldScrollToResults(true);
  }

  const calculation = useMemo(() => {
    try {
      return {
        result: estimateRooms(rooms, { region, condition }, defaultCostLibrary),
        error: null as string | null
      };
    } catch (error) {
      if (error instanceof Error) {
        return { result: null, error: error.message };
      }
      return { result: null, error: "Unable to estimate rooms" };
    }
  }, [rooms, region, condition]);

  useEffect(() => {
    if (!shouldScrollToResults) {
      return;
    }

    if (calculation.result) {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      setShouldScrollToResults(false);
    }
  }, [calculation.result, shouldScrollToResults]);

  const estimateInput = useMemo<EstimateInput>(() => {
    const totalAreaM2 = rooms.reduce((sum, room) => sum + room.areaM2, 0);

    return {
      region,
      projectType: "refurb",
      propertyType: "rooms",
      totalAreaM2,
      condition,
      finishLevel: "standard",
      rooms
    };
  }, [rooms, region, condition]);

  async function handleSaveScenario(
    name: string,
    purchasePrice?: number,
    gdv?: number
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
      gdv
    };

    try {
      await saveScenario(scenario);
      setIsSaveModalOpen(false);
      toast({
        title: "Scenario saved",
        description: "You can compare it on the Scenario Comparison page."
      });
    } catch (error) {
      setIsSaveModalOpen(false);
      toast({
        title: "Scenario saved locally",
        description:
          error instanceof Error ? error.message : "Cloud sync failed. Scenario was saved locally.",
        variant: "destructive"
      });
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Detailed Rooms</h1>

      <Card className="shadow-sm">
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="rooms-region">Region</Label>
            <Select
              value={region}
              onValueChange={(value) => {
                setRegion(value as Region);
                setShouldScrollToResults(true);
              }}
            >
              <SelectTrigger id="rooms-region" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((regionValue) => (
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
                setShouldScrollToResults(true);
              }}
            >
              <SelectTrigger id="rooms-condition" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditions.map((conditionValue) => (
                  <SelectItem key={conditionValue} value={conditionValue}>
                    {conditionValue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Card key={room.id} className="shadow-sm">
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Room type</Label>
                    <Select
                      value={room.roomType}
                      onValueChange={(value) => updateRoom(room.id, { roomType: value as RoomType })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roomTypes.map((roomType) => (
                          <SelectItem key={roomType} value={roomType}>
                            {roomType}
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
                      onChange={(event) => updateRoom(room.id, { areaM2: Number(event.target.value) })}
                      aria-invalid={hasAreaError}
                      className={cn("w-full", hasAreaError && "border-red-500 focus-visible:ring-red-200")}
                    />
                    {hasAreaError ? (
                      <p className="text-sm text-red-600">Area must be greater than zero</p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <Label>Intensity</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {intensityOptions.map((intensity) => {
                        const isActive = room.intensity === intensity;
                        return (
                          <Button
                            key={intensity}
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            onClick={() => updateRoom(room.id, { intensity })}
                          >
                            {intensity}
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
                          finishLevel: value as RoomInput["finishLevel"]
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {finishLevels.map((finishLevel) => (
                          <SelectItem key={finishLevel} value={finishLevel}>
                            {finishLevel}
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

      {calculation.error ? <p className="text-sm font-medium text-red-600">{calculation.error}</p> : null}
      {calculation.result ? (
        <div id="results" className="space-y-4">
          <Button type="button" variant="default" onClick={() => setIsSaveModalOpen(true)}>
            Save as Scenario
          </Button>
          <EstimateResults result={calculation.result} />
        </div>
      ) : null}
      <SaveScenarioModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveScenario}
      />
    </section>
  );
}
