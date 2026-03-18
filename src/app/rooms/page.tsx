"use client";

import { useEffect, useMemo, useState } from "react";
import EstimateResults from "@/components/EstimateResults";
import InfoTooltip from "@/components/InfoTooltip";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateRooms } from "@/lib/estimator";
import { saveScenario } from "@/lib/storage";
import type {
  Condition,
  EstimateInput,
  Region,
  RoomInput,
  RoomType,
  Scenario
} from "@/lib/types";

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

const inputBaseClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveMessage(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

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

  function handleSaveScenario(
    name: string,
    purchasePrice?: number,
    gdv?: number
  ): void {
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

    saveScenario(scenario);
    setIsSaveModalOpen(false);
    setSaveMessage("Scenario saved");
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Detailed Rooms</h1>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <div className="space-y-1">
          <label htmlFor="rooms-region" className="text-sm font-medium text-slate-700">
            Region
          </label>
          <select
            id="rooms-region"
            value={region}
            onChange={(event) => {
              setRegion(event.target.value as Region);
              setShouldScrollToResults(true);
            }}
            className={inputBaseClass}
          >
            {regions.map((regionValue) => (
              <option key={regionValue} value={regionValue}>
                {regionValue}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="rooms-condition" className="text-sm font-medium text-slate-700">
            Condition
          </label>
          <select
            id="rooms-condition"
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value as Condition);
              setShouldScrollToResults(true);
            }}
            className={inputBaseClass}
          >
            {conditions.map((conditionValue) => (
              <option key={conditionValue} value={conditionValue}>
                {conditionValue}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Workscope guide:{" "}
          <InfoTooltip
            term="First fix"
            explanation="Initial installation of wiring, pipes, and heating before plastering."
          />{" "}
          and{" "}
          <InfoTooltip
            term="Second fix"
            explanation="Final fitting of sockets, taps, radiators, and light fixtures after plastering."
          />
          .
        </p>

        {rooms.map((room, index) => {
          const hasAreaError = !Number.isFinite(room.areaM2) || room.areaM2 <= 0;

          return (
            <article key={room.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Room {index + 1}</h2>
                <button
                  type="button"
                  onClick={() => removeRoom(room.id)}
                  disabled={rooms.length === 1}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Room type</label>
                  <select
                    value={room.roomType}
                    onChange={(event) =>
                      updateRoom(room.id, { roomType: event.target.value as RoomType })
                    }
                    className={inputBaseClass}
                  >
                    {roomTypes.map((roomType) => (
                      <option key={roomType} value={roomType}>
                        {roomType}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Area (m²)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="e.g. 12"
                    value={room.areaM2}
                    onChange={(event) => updateRoom(room.id, { areaM2: Number(event.target.value) })}
                    className={`${inputBaseClass} ${
                      hasAreaError
                        ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                        : ""
                    }`}
                  />
                  {hasAreaError ? (
                    <p className="text-sm text-red-600">Area must be greater than zero</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Intensity</label>
                  <div className="grid grid-cols-2 gap-2">
                    {intensityOptions.map((intensity) => {
                      const isActive = room.intensity === intensity;
                      return (
                        <button
                          key={intensity}
                          type="button"
                          onClick={() => updateRoom(room.id, { intensity })}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {intensity}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Finish level</label>
                  <select
                    value={room.finishLevel}
                    onChange={(event) =>
                      updateRoom(room.id, {
                        finishLevel: event.target.value as RoomInput["finishLevel"]
                      })
                    }
                    className={inputBaseClass}
                  >
                    {finishLevels.map((finishLevel) => (
                      <option key={finishLevel} value={finishLevel}>
                        {finishLevel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRoom}
        className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
      >
        Add room
      </button>

      {calculation.error ? <p className="text-sm font-medium text-red-600">{calculation.error}</p> : null}
      {saveMessage ? <p className="text-sm font-medium text-green-600">{saveMessage}</p> : null}
      {calculation.result ? (
        <div id="results" className="space-y-4">
          <button
            type="button"
            onClick={() => setIsSaveModalOpen(true)}
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Save as Scenario
          </button>
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
