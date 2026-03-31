import {
  isRegion,
  type Region,
} from "@/lib/domain/region";
import type { AssistantAction } from "@/lib/assistant/schemas";
import type { Condition, RoomInput, RoomType } from "@/lib/types";


type RoomsAssistantState = {
  region: Region;
  condition: Condition;
  rooms: RoomInput[];
  nextRoomId: number;
};

type ApplyRoomsActionsResult = {
  nextState: RoomsAssistantState;
  changedFields: string[];
  shouldRecalculate: boolean;
  noneReason: string | null;
};

const CONDITION_VALUES: ReadonlySet<Condition> = new Set(["poor", "fair", "good"]);
const ROOM_TYPE_VALUES: ReadonlySet<RoomType> = new Set([
  "kitchen",
  "bathroom",
  "bedroom",
  "living",
  "hallway",
  "utility"
]);
const INTENSITY_VALUES: ReadonlySet<RoomInput["intensity"]> = new Set(["light", "full"]);
const FINISH_VALUES: ReadonlySet<RoomInput["finishLevel"]> = new Set([
  "budget",
  "standard",
  "premium"
]);

function parseRoomFieldPath(field: string): {
  index: number;
  key: "roomType" | "areaM2" | "intensity" | "finishLevel";
} | null {
  const match = field.match(/^rooms\[(\d+)\]\.(roomType|areaM2|intensity|finishLevel)$/);
  if (!match) {
    return null;
  }

  return {
    index: Number(match[1]),
    key: match[2] as "roomType" | "areaM2" | "intensity" | "finishLevel"
  };
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function buildRoomId(seed: number): string {
  return `room-${seed}`;
}

export function applyEditorActionsToRoomsState(
  state: RoomsAssistantState,
  actions: AssistantAction[]
): ApplyRoomsActionsResult {
  const nextState: RoomsAssistantState = {
    region: state.region,
    condition: state.condition,
    rooms: state.rooms.map((room) => ({ ...room })),
    nextRoomId: state.nextRoomId
  };
  const changedFieldSet = new Set<string>();
  let shouldRecalculate = false;
  let noneReason: string | null = null;

  for (const action of actions) {
    if (action.type === "none") {
      noneReason = action.reason ?? null;
      continue;
    }

    if (action.type === "recalculate") {
      shouldRecalculate = true;
      continue;
    }

    if (action.type === "add_room") {
      const roomType = ROOM_TYPE_VALUES.has(action.room.roomType as RoomType)
        ? (action.room.roomType as RoomType)
        : "bedroom";
      const areaM2 = parsePositiveNumber(action.room.areaM2) ?? 12;
      const intensity = INTENSITY_VALUES.has(action.room.intensity as RoomInput["intensity"])
        ? (action.room.intensity as RoomInput["intensity"])
        : "full";
      const finishLevel = FINISH_VALUES.has(action.room.finishLevel as RoomInput["finishLevel"])
        ? (action.room.finishLevel as RoomInput["finishLevel"])
        : "standard";

      nextState.rooms.push({
        id: buildRoomId(nextState.nextRoomId),
        roomType,
        areaM2,
        intensity,
        finishLevel
      });
      nextState.nextRoomId += 1;
      changedFieldSet.add("rooms");
      continue;
    }

    if (action.type === "remove_room") {
      if (nextState.rooms.length <= 1) {
        continue;
      }
      const nextRooms = nextState.rooms.filter((room) => room.id !== action.roomId);
      if (nextRooms.length !== nextState.rooms.length) {
        nextState.rooms = nextRooms;
        changedFieldSet.add("rooms");
      }
      continue;
    }

    if (action.type !== "update_fields") {
      continue;
    }

    for (const [field, value] of Object.entries(action.fields)) {
      if (field === "region" && isRegion(value)) {
        if (nextState.region !== value) {
          nextState.region = value as Region;
          changedFieldSet.add("region");
        }
        continue;
      }

      if (field === "condition" && CONDITION_VALUES.has(value as Condition)) {
        if (nextState.condition !== value) {
          nextState.condition = value as Condition;
          changedFieldSet.add("condition");
        }
        continue;
      }

      const roomPath = parseRoomFieldPath(field);
      if (!roomPath) {
        continue;
      }

      const room = nextState.rooms[roomPath.index];
      if (!room) {
        continue;
      }

      if (roomPath.key === "roomType" && ROOM_TYPE_VALUES.has(value as RoomType)) {
        if (room.roomType !== value) {
          room.roomType = value as RoomType;
          changedFieldSet.add(field);
        }
        continue;
      }

      if (roomPath.key === "areaM2") {
        const parsed = parsePositiveNumber(value);
        if (parsed !== null && room.areaM2 !== parsed) {
          room.areaM2 = parsed;
          changedFieldSet.add(field);
        }
        continue;
      }

      if (
        roomPath.key === "intensity" &&
        INTENSITY_VALUES.has(value as RoomInput["intensity"])
      ) {
        if (room.intensity !== value) {
          room.intensity = value as RoomInput["intensity"];
          changedFieldSet.add(field);
        }
        continue;
      }

      if (
        roomPath.key === "finishLevel" &&
        FINISH_VALUES.has(value as RoomInput["finishLevel"])
      ) {
        if (room.finishLevel !== value) {
          room.finishLevel = value as RoomInput["finishLevel"];
          changedFieldSet.add(field);
        }
      }
    }
  }

  if (changedFieldSet.size > 0) {
    shouldRecalculate = true;
  }

  return {
    nextState,
    changedFields: [...changedFieldSet],
    shouldRecalculate,
    noneReason
  };
}
