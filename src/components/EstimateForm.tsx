"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PROPERTY_TYPE_DISPLAY_ORDER, type PropertyType } from "@/lib/propertyType";
import { cn } from "@/lib/utils";
import type { EstimateInput } from "@/lib/types";

type EstimateFormProps = {
  onSubmit: (input: EstimateInput) => void;
  onValidationError?: () => void;
};

type FormValues = {
  region: EstimateInput["region"] | "";
  propertyType: PropertyType | "";
  totalAreaM2: string;
  condition: EstimateInput["condition"] | "";
  finishLevel: EstimateInput["finishLevel"] | "";
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const regionDisplayNames: Record<EstimateInput["region"], string> = {
  london: "London",
  south_east: "South East",
  east_of_england: "East of England",
  east_midlands: "East Midlands",
  west_midlands: "West Midlands",
  south_west: "South West",
  north_west: "North West",
  north_east: "North East",
  yorkshire_and_humber: "Yorkshire & Humber",
  scotland: "Scotland",
  wales: "Wales",
  northern_ireland: "Northern Ireland"
};

const regions: EstimateInput["region"][] = [
  "london",
  "south_east",
  "east_of_england",
  "east_midlands",
  "west_midlands",
  "south_west",
  "north_west",
  "north_east",
  "yorkshire_and_humber",
  "scotland",
  "wales",
  "northern_ireland"
];

const conditions: EstimateInput["condition"][] = ["poor", "fair", "good"];
const finishLevels: EstimateInput["finishLevel"][] = ["budget", "standard", "premium"];
const propertyTypes = PROPERTY_TYPE_DISPLAY_ORDER;

export default function EstimateForm({ onSubmit, onValidationError }: EstimateFormProps) {
  const [values, setValues] = useState<FormValues>({
    region: "",
    propertyType: "",
    totalAreaM2: "",
    condition: "",
    finishLevel: ""
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const areaAsNumber = useMemo(() => Number(values.totalAreaM2), [values.totalAreaM2]);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!values.region) {
      nextErrors.region = "Region is required";
    }

    if (!values.propertyType) {
      nextErrors.propertyType = "Property type is required";
    }

    if (!values.totalAreaM2.trim()) {
      nextErrors.totalAreaM2 = "Total area is required";
    } else if (!Number.isFinite(areaAsNumber) || areaAsNumber <= 0) {
      nextErrors.totalAreaM2 = "Area must be greater than zero";
    }

    if (!values.condition) {
      nextErrors.condition = "Condition is required";
    }

    if (!values.finishLevel) {
      nextErrors.finishLevel = "Finish level is required";
    }

    return nextErrors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      onValidationError?.();
      return;
    }

    onSubmit({
      region: values.region as EstimateInput["region"],
      projectType: "refurb",
      propertyType: values.propertyType as PropertyType,
      totalAreaM2: areaAsNumber,
      condition: values.condition as EstimateInput["condition"],
      finishLevel: values.finishLevel as EstimateInput["finishLevel"]
    });
  }

  const getInputClass = (hasError: boolean) =>
    cn("w-full h-11", hasError && "border-destructive focus-visible:border-destructive");

  const getSelectClass = (hasError: boolean) =>
    cn("w-full h-11", hasError && "border-destructive aria-invalid:border-destructive");

  const renderFieldWarning = (message: string | undefined) =>
    message ? (
      <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">{message}</p>
      </div>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <div className="space-y-6">
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Property Details
          </h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="region" className="text-sm font-medium">
                Region
              </Label>
              <Select
                value={values.region || undefined}
                onValueChange={(value) => updateField("region", value as FormValues["region"])}
              >
                <SelectTrigger
                  id="region"
                  aria-invalid={Boolean(errors.region)}
                  className={getSelectClass(Boolean(errors.region))}
                >
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {regionDisplayNames[region]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renderFieldWarning(errors.region)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType" className="text-sm font-medium">
                Property Type
              </Label>
              <Select
                value={values.propertyType || undefined}
                onValueChange={(value) => updateField("propertyType", value as PropertyType)}
              >
                <SelectTrigger
                  id="propertyType"
                  aria-invalid={Boolean(errors.propertyType)}
                  className={getSelectClass(Boolean(errors.propertyType))}
                >
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((propertyType) => (
                    <SelectItem key={propertyType} value={propertyType}>
                      {propertyType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renderFieldWarning(errors.propertyType)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAreaM2" className="text-sm font-medium">
                Total Area (m²)
              </Label>
              <Input
                id="totalAreaM2"
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 75"
                value={values.totalAreaM2}
                onChange={(event) => updateField("totalAreaM2", event.target.value)}
                aria-invalid={Boolean(errors.totalAreaM2)}
                className={getInputClass(Boolean(errors.totalAreaM2))}
              />
              <p className="text-xs text-muted-foreground">Approximate internal floor area</p>
              {renderFieldWarning(errors.totalAreaM2)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition" className="text-sm font-medium">
                Current Condition
              </Label>
              <Select
                value={values.condition || undefined}
                onValueChange={(value) => updateField("condition", value as FormValues["condition"])}
              >
                <SelectTrigger
                  id="condition"
                  aria-invalid={Boolean(errors.condition)}
                  className={getSelectClass(Boolean(errors.condition))}
                >
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {condition.charAt(0).toUpperCase() + condition.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renderFieldWarning(errors.condition)}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Project Quality
          </h3>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="finishLevel" className="text-sm font-medium">
              Finish Level
            </Label>
            <Select
              value={values.finishLevel || undefined}
              onValueChange={(value) => updateField("finishLevel", value as FormValues["finishLevel"])}
            >
              <SelectTrigger
                id="finishLevel"
                aria-invalid={Boolean(errors.finishLevel)}
                className={getSelectClass(Boolean(errors.finishLevel))}
              >
                <SelectValue placeholder="Select finish level" />
              </SelectTrigger>
              <SelectContent>
                {finishLevels.map((finish) => (
                  <SelectItem key={finish} value={finish}>
                    {finish.charAt(0).toUpperCase() + finish.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {renderFieldWarning(errors.finishLevel)}
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full gap-2 sm:w-auto">
        <Calculator className="h-4 w-4" />
        Calculate Estimate
      </Button>
    </form>
  );
}
