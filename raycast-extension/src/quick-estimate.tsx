import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getPreferenceValues,
  showToast,
  Toast,
  useNavigation
} from "@raycast/api";
import { useState } from "react";

type Region = "London" | "SouthEast" | "Midlands" | "North" | "Scotland" | "Wales";
type Condition = "poor" | "fair" | "good";
type FinishLevel = "budget" | "standard" | "premium";
type CategoryBreakdown = {
  category: string;
  low: number;
  typical: number;
  high: number;
};
type EstimateResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: {
    low: number;
    typical: number;
    high: number;
  };
  categories: CategoryBreakdown[];
};
type EstimateInput = {
  region: Region;
  projectType: "refurb";
  propertyType: string;
  totalAreaM2: number;
  condition: Condition;
  finishLevel: FinishLevel;
};
type ApiResponse = {
  estimateInput: EstimateInput;
  estimateResult: EstimateResult;
  error?: string;
};

type Preferences = {
  apiBaseUrl: string;
};

type FormValues = {
  region: Region;
  propertyType: string;
  totalAreaM2: string;
  condition: Condition;
  finishLevel: FinishLevel;
};

const REGION_OPTIONS: Region[] = [
  "London",
  "SouthEast",
  "Midlands",
  "North",
  "Scotland",
  "Wales"
];
const CONDITION_OPTIONS: Condition[] = ["poor", "fair", "good"];
const FINISH_LEVEL_OPTIONS: FinishLevel[] = ["budget", "standard", "premium"];

function normaliseBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(amount);
}

function toCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function toMarkdown(input: EstimateInput, result: EstimateResult): string {
  const categoryTable = result.categories
    .map(
      (category) =>
        `| ${toCategoryLabel(category.category)} | ${formatCurrency(category.low)} | ${formatCurrency(category.typical)} | ${formatCurrency(category.high)} |`
    )
    .join("\n");

  return [
    `# Estimate Result`,
    ``,
    `**Property:** ${input.propertyType}`,
    `**Region:** ${input.region}`,
    `**Area:** ${input.totalAreaM2} m²`,
    `**Condition:** ${input.condition}`,
    `**Finish:** ${input.finishLevel}`,
    ``,
    `## Totals`,
    `- Low: ${formatCurrency(result.totalLow)} (${formatCurrency(result.costPerM2.low)}/m²)`,
    `- Typical: ${formatCurrency(result.totalTypical)} (${formatCurrency(result.costPerM2.typical)}/m²)`,
    `- High: ${formatCurrency(result.totalHigh)} (${formatCurrency(result.costPerM2.high)}/m²)`,
    ``,
    `## Category Breakdown`,
    `| Category | Low | Typical | High |`,
    `| --- | ---: | ---: | ---: |`,
    categoryTable
  ].join("\n");
}

function EstimateResultView(props: { input: EstimateInput; result: EstimateResult }) {
  const markdown = toMarkdown(props.input, props.result);

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Typical Total" content={formatCurrency(props.result.totalTypical)} />
          <Action.CopyToClipboard title="Copy Full Result" content={markdown} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: FormValues) {
    const totalAreaM2 = Number(values.totalAreaM2);
    if (!Number.isFinite(totalAreaM2) || totalAreaM2 <= 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid area",
        message: "Area must be greater than zero"
      });
      return;
    }

    const propertyType = values.propertyType.trim();
    if (!propertyType) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Property type required"
      });
      return;
    }

    const apiBaseUrl = normaliseBaseUrl(preferences.apiBaseUrl);
    if (!apiBaseUrl) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Missing API base URL",
        message: "Set API Base URL in extension preferences"
      });
      return;
    }

    setIsLoading(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Calculating estimate..."
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/estimate/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: values.region,
          propertyType,
          totalAreaM2,
          condition: values.condition,
          finishLevel: values.finishLevel
        })
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch estimate");
      }

      toast.style = Toast.Style.Success;
      toast.title = "Estimate ready";

      push(<EstimateResultView input={data.estimateInput} result={data.estimateResult} />);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Estimate failed";
      toast.message =
        error instanceof Error ? error.message : "Unexpected error";
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Calculate Estimate" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="region" title="Region" defaultValue="Midlands">
        {REGION_OPTIONS.map((region) => (
          <Form.Dropdown.Item key={region} value={region} title={region} />
        ))}
      </Form.Dropdown>
      <Form.TextField id="propertyType" title="Property Type" placeholder="e.g. Terraced house" />
      <Form.TextField id="totalAreaM2" title="Total Area (m²)" placeholder="e.g. 85" />
      <Form.Dropdown id="condition" title="Condition" defaultValue="fair">
        {CONDITION_OPTIONS.map((condition) => (
          <Form.Dropdown.Item
            key={condition}
            value={condition}
            title={condition.charAt(0).toUpperCase() + condition.slice(1)}
          />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="finishLevel" title="Finish Level" defaultValue="standard">
        {FINISH_LEVEL_OPTIONS.map((finishLevel) => (
          <Form.Dropdown.Item
            key={finishLevel}
            value={finishLevel}
            title={finishLevel.charAt(0).toUpperCase() + finishLevel.slice(1)}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
