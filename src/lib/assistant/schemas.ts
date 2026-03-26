import { z } from "zod";

export const AppModeSchema = z.enum(["rooms", "new_build", "development"]);
export type AppMode = z.infer<typeof AppModeSchema>;

export const AssistantAgentSchema = z.enum(["chat", "editor", "copilot"]);
export type AssistantAgent = z.infer<typeof AssistantAgentSchema>;

export const MODE_FIELD_WHITELISTS = {
  rooms: [
    "region",
    "condition",
    "finishLevel",
    "rooms",
    "rooms[].roomType",
    "rooms[].areaM2",
    "rooms[].intensity",
    "rooms[].finishLevel"
  ],
  new_build: [
    "propertyType",
    "spec",
    "totalAreaM2",
    "bedrooms",
    "storeys",
    "postcodeDistrict",
    "garage",
    "renewableEnergy",
    "basementIncluded",
    "numberOfUnits",
    "numberOfStoreys",
    "liftIncluded",
    "commercialGroundFloor",
    "numberOfLettableRooms",
    "enSuitePerRoom",
    "communalKitchen",
    "fireEscapeRequired",
    "commercialType",
    "fitOutLevel",
    "disabledAccess",
    "extractionSystem",
    "parkingSpaces"
  ],
  development: [
    "purchasePrice",
    "grossDevelopmentValue",
    "acquisitionLegalFees",
    "buildCosts",
    "professionalFees",
    "planningCosts",
    "contingencyPercent",
    "includeFinance",
    "bridgingRateMonthlyPercent",
    "loanTermMonths",
    "loanToValuePercent",
    "saleLegalFees",
    "estateAgentFeePercent",
    "targetProfitMarginPercent"
  ]
} as const;

export type ModeFieldWhitelist = (typeof MODE_FIELD_WHITELISTS)[AppMode][number];

export const UpdateFieldsActionSchema = z.object({
  type: z.literal("update_fields"),
  fields: z.record(z.string(), z.unknown())
});

export const AddRoomActionSchema = z.object({
  type: z.literal("add_room"),
  room: z.object({
    roomType: z.string(),
    areaM2: z.number().positive().optional(),
    intensity: z.string().optional(),
    finishLevel: z.string().optional()
  })
});

export const RemoveRoomActionSchema = z.object({
  type: z.literal("remove_room"),
  roomId: z.string().min(1)
});

export const RecalculateActionSchema = z.object({
  type: z.literal("recalculate")
});

export const NoneActionSchema = z.object({
  type: z.literal("none"),
  reason: z.string().optional()
});

export const AssistantActionSchema = z.union([
  UpdateFieldsActionSchema,
  AddRoomActionSchema,
  RemoveRoomActionSchema,
  RecalculateActionSchema,
  NoneActionSchema
]);

export type AssistantAction = z.infer<typeof AssistantActionSchema>;

export const ProjectContextSchema = z
  .object({
    scenarioId: z.string().optional(),
    notes: z.array(z.string()).optional(),
    memory: z.array(z.string()).optional()
  })
  .optional();

export const AssistantRequestSchema = z.object({
  agent: AssistantAgentSchema,
  message: z.string().min(1),
  mode: AppModeSchema,
  estimateInput: z.unknown().optional(),
  estimateResult: z.unknown().optional(),
  projectContext: ProjectContextSchema
});

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const ChatAssistantResponseSchema = z.object({
  reply: z.string(),
  suggestions: z.array(z.string()).optional(),
  actions: z.array(AssistantActionSchema).default([])
});

export const EstimateEditorResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(AssistantActionSchema)
});

export const ProjectCopilotResponseSchema = z.object({
  reply: z.string(),
  nextSteps: z.array(z.string()).optional(),
  suggestedActions: z.array(AssistantActionSchema).optional()
});

export type ChatAssistantResponse = z.infer<typeof ChatAssistantResponseSchema>;
export type EstimateEditorResponse = z.infer<typeof EstimateEditorResponseSchema>;
export type ProjectCopilotResponse = z.infer<typeof ProjectCopilotResponseSchema>;
