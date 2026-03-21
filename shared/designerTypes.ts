export type RoomCondition = "good" | "fair" | "poor";

export interface DesignerMaterialsItem {
  category: "walls" | "floor" | "ceiling" | "lighting" | "furniture" | "joinery" | "other";
  description: string;
  cost_band: "low" | "medium" | "high";
}

export interface DesignerStyleVariant {
  style_key: string;
  label: string;
  description: string;
  render_image_url: string;
  materials_spec: DesignerMaterialsItem[];
}

export interface DesignerAgentResponse {
  room_id: string;
  room_type: string;
  approx_room_area_m2: number;
  room_summary: string;
  condition: RoomCondition;
  issues: string[];
  style_variants: DesignerStyleVariant[];
}

export type DesignerRoomType = "living room" | "bedroom" | "kitchen" | "bathroom" | "other";

export type DesignerTargetSpec = "basic" | "standard" | "premium";

export interface DesignerAgentInput {
  imageUrls: string[];
  propertySizeM2: number;
  roomType: DesignerRoomType;
  targetSpec: DesignerTargetSpec;
  preferredStyles: string;
}
