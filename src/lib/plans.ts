export type Plan = "free" | "pro" | "agency";
export type PlanPeriod = "monthly" | "annual";

export type PlanFeatures = {
  unlimitedEstimates: boolean;
  aiEstimatesPerMonth: number;
  scenarioLimit: number;
  devAppraisal: boolean;
  refineEstimate: boolean;
  pdfExport: boolean;
  csvExport: boolean;
  budgetTracker: boolean;
  teamSeats: number;
  whiteLabelPdf: boolean;
  apiAccess: boolean;
};

export type PlanConfig = {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  stripePriceIds: {
    monthly: string | null;
    annual: string | null;
  };
  features: PlanFeatures;
};

function readPriceId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

const PRO_MONTHLY_PRICE_ID = readPriceId(
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
);
const PRO_ANNUAL_PRICE_ID = readPriceId(
  process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
);

const AGENCY_MONTHLY_PRICE_ID = readPriceId(
  process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID,
);
const AGENCY_ANNUAL_PRICE_ID = readPriceId(
  process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID,
);

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    name: "Free",
    description: "Basic planning tools for early-stage refurb projects.",
    monthlyPrice: 0,
    annualPrice: 0,
    stripePriceIds: {
      monthly: null,
      annual: null,
    },
    features: {
      unlimitedEstimates: false,
      aiEstimatesPerMonth: 3,
      scenarioLimit: 2,
      devAppraisal: false,
      refineEstimate: false,
      pdfExport: false,
      csvExport: false,
      budgetTracker: false,
      teamSeats: 1,
      whiteLabelPdf: false,
      apiAccess: false,
    },
  },
  pro: {
    name: "Pro",
    description: "For active refurb investors managing multiple live projects.",
    monthlyPrice: 1499,
    annualPrice: 11900,
    stripePriceIds: {
      monthly: PRO_MONTHLY_PRICE_ID,
      annual: PRO_ANNUAL_PRICE_ID,
    },
    features: {
      unlimitedEstimates: true,
      aiEstimatesPerMonth: 20,
      scenarioLimit: Number.POSITIVE_INFINITY,
      devAppraisal: true,
      refineEstimate: true,
      pdfExport: true,
      csvExport: true,
      budgetTracker: true,
      teamSeats: 1,
      whiteLabelPdf: false,
      apiAccess: false,
    },
  },
  agency: {
    name: "Agency",
    description: "For teams needing branded outputs and higher-volume workflows.",
    monthlyPrice: 4900,
    annualPrice: 39000,
    stripePriceIds: {
      monthly: AGENCY_MONTHLY_PRICE_ID,
      annual: AGENCY_ANNUAL_PRICE_ID,
    },
    features: {
      unlimitedEstimates: true,
      aiEstimatesPerMonth: 20,
      scenarioLimit: Number.POSITIVE_INFINITY,
      devAppraisal: true,
      refineEstimate: true,
      pdfExport: true,
      csvExport: true,
      budgetTracker: true,
      teamSeats: 10,
      whiteLabelPdf: true,
      apiAccess: true,
    },
  },
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  agency: 2,
};

export function getUserPlan(plan: Plan): PlanConfig {
  return PLANS[plan];
}

export function requirePlan(plan: Plan | Plan[], userPlan: Plan): boolean {
  const requiredPlans = Array.isArray(plan) ? plan : [plan];
  const userRank = PLAN_RANK[userPlan];

  return requiredPlans.some((requiredPlan) => userRank >= PLAN_RANK[requiredPlan]);
}

export function isFeatureEnabled(
  feature: keyof PlanFeatures,
  userPlan: Plan,
): boolean {
  const value = PLANS[userPlan].features[feature];
  return typeof value === "boolean" ? value : value > 0;
}
