import { applyEditorActionsToRoomsState } from "./roomsActions";
import type { AssistantAction } from "./schemas";
import type { RoomInput } from "@/lib/types";

const BASE_ROOMS: RoomInput[] = [
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
    areaM2: 6,
    intensity: "full",
    finishLevel: "standard"
  }
];

describe("applyEditorActionsToRoomsState", () => {
  test("applies top-level and indexed room updates and triggers recalculate", () => {
    const actions: AssistantAction[] = [
      {
        type: "update_fields",
        fields: {
          region: "london",
          condition: "good",
          "rooms[0].areaM2": 12,
          "rooms[1].finishLevel": "premium"
        }
      }
    ];

    const applied = applyEditorActionsToRoomsState(
      {
        region: "east_midlands",
        condition: "fair",
        rooms: BASE_ROOMS,
        nextRoomId: 3
      },
      actions
    );

    expect(applied.nextState.region).toBe("london");
    expect(applied.nextState.condition).toBe("good");
    expect(applied.nextState.rooms[0]?.areaM2).toBe(12);
    expect(applied.nextState.rooms[1]?.finishLevel).toBe("premium");
    expect(applied.shouldRecalculate).toBe(true);
  });

  test("adds and removes rooms safely", () => {
    const actions: AssistantAction[] = [
      {
        type: "add_room",
        room: {
          roomType: "bedroom",
          areaM2: 11
        }
      },
      {
        type: "remove_room",
        roomId: "room-1"
      }
    ];

    const applied = applyEditorActionsToRoomsState(
      {
        region: "east_midlands",
        condition: "fair",
        rooms: BASE_ROOMS,
        nextRoomId: 3
      },
      actions
    );

    expect(applied.nextState.rooms).toHaveLength(2);
    expect(applied.nextState.rooms.some((room) => room.id === "room-1")).toBe(false);
    expect(applied.nextState.rooms.some((room) => room.id === "room-3")).toBe(true);
    expect(applied.nextState.nextRoomId).toBe(4);
    expect(applied.shouldRecalculate).toBe(true);
  });

  test("captures none reason without mutating state", () => {
    const actions: AssistantAction[] = [
      {
        type: "none",
        reason: "Need a specific room target."
      }
    ];

    const applied = applyEditorActionsToRoomsState(
      {
        region: "east_midlands",
        condition: "fair",
        rooms: BASE_ROOMS,
        nextRoomId: 3
      },
      actions
    );

    expect(applied.noneReason).toBe("Need a specific room target.");
    expect(applied.changedFields).toHaveLength(0);
    expect(applied.shouldRecalculate).toBe(false);
  });
});
