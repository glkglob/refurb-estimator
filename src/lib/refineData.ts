import type { Condition, CostCategory, FinishLevel } from "@/lib/types"

export type RefineScopeCategory = CostCategory | "structural"
export type RefineScopeUnit = "fixed" | "per_m2" | "per_unit" | "percent_of_build"

export type RefineScopeRule = {
  conditions?: Condition[]
  finishLevels?: FinishLevel[]
}

export type RefineScopeItem = {
  id: string
  label: string
  low: number
  high: number
  unit: RefineScopeUnit
  defaultSelectedWhen?: RefineScopeRule[]
}

export type RefineScopeCategoryConfig = {
  label: string
  items: RefineScopeItem[]
}

const ALL_CONDITIONS: Condition[] = ["poor", "fair", "good"]
const POOR_OR_FAIR: Condition[] = ["poor", "fair"]

const FOR_POOR_OR_FAIR: RefineScopeRule = { conditions: POOR_OR_FAIR }
const FOR_PREMIUM: RefineScopeRule = { finishLevels: ["premium"] }
const ALWAYS_SELECTED: RefineScopeRule = { conditions: ALL_CONDITIONS }

export const REFINE_SCOPE: Record<RefineScopeCategory, RefineScopeCategoryConfig> = {
  kitchen: {
    label: "Kitchen",
    items: [
      {
        id: "kitchen-replace-units-worktops",
        label: "Remove and replace kitchen units + worktops",
        low: 4500,
        high: 12000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "kitchen-sink-replumb",
        label: "New sink + replumb",
        low: 800,
        high: 1800,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "kitchen-appliances",
        label: "New appliances (oven, hob, extractor)",
        low: 1200,
        high: 4000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "kitchen-island",
        label: "Kitchen island",
        low: 2000,
        high: 6000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "kitchen-retile-splashback",
        label: "Retile splashback",
        low: 400,
        high: 1200,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "kitchen-rewire-sockets-lighting",
        label: "Rewire kitchen sockets + lighting",
        low: 600,
        high: 1400,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "kitchen-underfloor-heating",
        label: "Underfloor heating",
        low: 1500,
        high: 3500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "kitchen-decoration",
        label: "Decoration (paint)",
        low: 400,
        high: 800,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      }
    ]
  },

  bathroom: {
    label: "Bathroom",
    items: [
      {
        id: "bathroom-replace-bath",
        label: "Remove and replace bath",
        low: 1800,
        high: 3200,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-replace-shower-cubicle",
        label: "Remove and replace shower cubicle",
        low: 2500,
        high: 4500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-replace-wc",
        label: "Replace WC (toilet + cistern)",
        low: 400,
        high: 900,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-replace-basin-vanity",
        label: "Replace basin + vanity unit",
        low: 600,
        high: 1400,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-full-retile",
        label: "Full retile walls + floor",
        low: 3500,
        high: 6000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-wet-room-conversion",
        label: "Wet room conversion",
        low: 5000,
        high: 9000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "bathroom-radiator-towel-rail",
        label: "New radiator / towel rail",
        low: 300,
        high: 600,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-extractor-fan",
        label: "Extractor fan",
        low: 150,
        high: 350,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-plastering-skim",
        label: "Plastering and skim",
        low: 800,
        high: 1500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-decoration",
        label: "Decoration",
        low: 400,
        high: 800,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "bathroom-underfloor-heating",
        label: "Underfloor heating",
        low: 1200,
        high: 2800,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "bathroom-bespoke-fitted-furniture",
        label: "Bespoke fitted furniture",
        low: 2000,
        high: 5000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      }
    ]
  },

  electrics: {
    label: "Electrics",
    items: [
      {
        id: "electrics-full-rewire",
        label: "Full rewire",
        low: 4000,
        high: 9000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "electrics-consumer-unit",
        label: "Consumer unit replacement",
        low: 800,
        high: 1500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "electrics-extra-sockets-per-room",
        label: "Extra sockets per room",
        low: 150,
        high: 400,
        unit: "per_unit",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "electrics-ev-charger",
        label: "EV charger installation",
        low: 800,
        high: 1400,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "electrics-smart-home",
        label: "Smart home / Hive system",
        low: 500,
        high: 2000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "electrics-external-lighting",
        label: "External / garden lighting",
        low: 600,
        high: 2000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "electrics-smoke-co-detectors",
        label: "Smoke + CO detectors",
        low: 200,
        high: 500,
        unit: "fixed",
        defaultSelectedWhen: [ALWAYS_SELECTED]
      }
    ]
  },

  plumbing: {
    label: "Plumbing",
    items: [
      {
        id: "plumbing-new-boiler",
        label: "New boiler",
        low: 2500,
        high: 4500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "plumbing-radiator-replacements",
        label: "Radiator replacements (per unit)",
        low: 300,
        high: 700,
        unit: "per_unit",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "plumbing-unvented-cylinder",
        label: "Unvented hot water cylinder",
        low: 1500,
        high: 3000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "plumbing-system-flush",
        label: "Full system flush + chemical clean",
        low: 400,
        high: 800,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "plumbing-leak-investigation",
        label: "Leak investigation + repair",
        low: 500,
        high: 2000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "plumbing-outside-tap",
        label: "Outside tap",
        low: 200,
        high: 500,
        unit: "fixed"
      }
    ]
  },

  heating: {
    label: "Heating",
    items: [
      {
        id: "heating-ashp",
        label: "Air source heat pump (ASHP)",
        low: 8000,
        high: 15000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "heating-smart-thermostat",
        label: "Smart thermostat",
        low: 200,
        high: 600,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "heating-radiators-throughout",
        label: "New radiators throughout",
        low: 2000,
        high: 5000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "heating-underfloor-wet-system",
        label: "Underfloor heating (wet system)",
        low: 5000,
        high: 12000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      }
    ]
  },

  windows: {
    label: "Windows",
    items: [
      {
        id: "windows-double-triple-glazing",
        label: "Double/triple glaze windows (per window)",
        low: 500,
        high: 1200,
        unit: "per_unit",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "windows-velux-roof-window",
        label: "Velux / roof windows (per unit)",
        low: 1200,
        high: 2500,
        unit: "per_unit"
      }
    ]
  },

  doors: {
    label: "Doors",
    items: [
      {
        id: "doors-bifold",
        label: "Bifold doors",
        low: 3500,
        high: 8000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "doors-composite-front",
        label: "Composite front door",
        low: 1200,
        high: 2500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "doors-internal-per-door",
        label: "Internal doors (per door)",
        low: 200,
        high: 600,
        unit: "per_unit"
      },
      {
        id: "doors-loft-hatch-ladder",
        label: "Loft hatch with ladder",
        low: 500,
        high: 1200,
        unit: "fixed"
      }
    ]
  },

  plastering: {
    label: "Plastering",
    items: [
      {
        id: "plastering-room-skim",
        label: "Plastering and skim",
        low: 800,
        high: 1500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
    ]
  },

  decoration: {
    label: "Decoration",
    items: [
      {
        id: "decoration-skim-paint-all-rooms",
        label: "Skim and paint all rooms",
        low: 80,
        high: 150,
        unit: "per_m2",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "decoration-feature-wall",
        label: "Feature wall (wallpaper/specialist)",
        low: 400,
        high: 1200,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "decoration-external-render",
        label: "External render",
        low: 3000,
        high: 8000,
        unit: "fixed"
      },
      {
        id: "decoration-coving-cornicing",
        label: "Coving / cornicing",
        low: 500,
        high: 1500,
        unit: "fixed",
        defaultSelectedWhen: [FOR_PREMIUM]
      }
    ]
  },

  flooring: {
    label: "Flooring",
    items: [
      {
        id: "flooring-engineered-hardwood",
        label: "Engineered hardwood",
        low: 60,
        high: 120,
        unit: "per_m2",
        defaultSelectedWhen: [FOR_PREMIUM]
      },
      {
        id: "flooring-lvt",
        label: "LVT / luxury vinyl",
        low: 30,
        high: 70,
        unit: "per_m2",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "flooring-carpet",
        label: "Carpet",
        low: 20,
        high: 50,
        unit: "per_m2",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "flooring-ceramic-porcelain-tile",
        label: "Ceramic / porcelain tile",
        low: 50,
        high: 100,
        unit: "per_m2"
      }
    ]
  },

  contingency: {
    label: "Contingency",
    items: [
      {
        id: "contingency-buffer",
        label: "Contingency allowance (recommended)",
        low: 10,
        high: 15,
        unit: "percent_of_build",
        defaultSelectedWhen: [ALWAYS_SELECTED]
      }
    ]
  },

  fees: {
    label: "Fees",
    items: [
      {
        id: "fees-architect-designer",
        label: "Architect / designer fees",
        low: 5,
        high: 12,
        unit: "percent_of_build",
        defaultSelectedWhen: [ALWAYS_SELECTED]
      },
      {
        id: "fees-planning-application",
        label: "Planning application fee",
        low: 258,
        high: 578,
        unit: "fixed"
      },
      {
        id: "fees-structural-engineer",
        label: "Structural engineer",
        low: 500,
        high: 1500,
        unit: "fixed"
      },
      {
        id: "fees-party-wall-surveyor",
        label: "Party wall surveyor",
        low: 800,
        high: 2000,
        unit: "fixed"
      },
      {
        id: "fees-building-control",
        label: "Building control / building regulations",
        low: 500,
        high: 1200,
        unit: "fixed"
      }
    ]
  },

  structural: {
    label: "Structural",
    items: [
      {
        id: "structural-knock-through-non-load-bearing",
        label: "Knock-through (non-load-bearing)",
        low: 800,
        high: 2000,
        unit: "fixed"
      },
      {
        id: "structural-rsj-load-bearing",
        label: "RSJ steel beam + knock-through (load-bearing)",
        low: 3500,
        high: 8000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "structural-underpinning",
        label: "Underpinning",
        low: 10000,
        high: 25000,
        unit: "fixed"
      },
      {
        id: "structural-roof-repair-refelt",
        label: "Roof repair / re-felt",
        low: 2000,
        high: 6000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "structural-damp-proof-course",
        label: "Damp proof course",
        low: 1500,
        high: 4000,
        unit: "fixed",
        defaultSelectedWhen: [FOR_POOR_OR_FAIR]
      },
      {
        id: "structural-fascias-soffits-guttering",
        label: "Fascias, soffits and guttering",
        low: 1500,
        high: 4000,
        unit: "fixed"
      }
    ]
  }
}

function matchesRule(
  rule: RefineScopeRule,
  condition: Condition,
  finishLevel: FinishLevel
): boolean {
  const conditionMatches =
    !rule.conditions || rule.conditions.includes(condition)
  const finishMatches =
    !rule.finishLevels || rule.finishLevels.includes(finishLevel)

  return conditionMatches && finishMatches
}

export function isRefineScopeItemDefaultSelected(
  item: RefineScopeItem,
  condition: Condition,
  finishLevel: FinishLevel
): boolean {
  if (!item.defaultSelectedWhen || item.defaultSelectedWhen.length === 0) {
    return false
  }

  return item.defaultSelectedWhen.some((rule) =>
    matchesRule(rule, condition, finishLevel)
  )
}
