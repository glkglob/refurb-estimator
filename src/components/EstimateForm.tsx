"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EstimateInput } from "@/lib/types";

type EstimateFormProps = {
  onSubmit: (input: EstimateInput) => void;
};

type FormValues = {
  region: EstimateInput["region"] | "";
  propertyType: string;
  totalAreaM2: string;
  condition: EstimateInput["condition"] | "";
  finishLevel: EstimateInput["finishLevel"] | "";
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const regions: EstimateInput["region"][] = [
  "London",
  "SouthEast",
  "Midlands",
  "North",
  "Scotland",
  "Wales"
];

const conditions: EstimateInput["condition"][] = ["poor", "fair", "good"];
const finishLevels: EstimateInput["finishLevel"][] = ["budget", "standard", "premium"];
const propertyTypes = [
  "Flat",
  "Terraced house",
  "Semi-detached",
  "Detached",
  "Bungalow",
  "HMO",
  "Commercial"
] as const;

export default function EstimateForm({ onSubmit }: EstimateFormProps) {
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

    if (!values.propertyType.trim()) {
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
      return;
    }

    onSubmit({
      region: values.region as EstimateInput["region"],
      projectType: "refurb",
      propertyType: values.propertyType.trim(),
      totalAreaM2: areaAsNumber,
      condition: values.condition as EstimateInput["condition"],
      finishLevel: values.finishLevel as EstimateInput["finishLevel"]
    });
  }

  const getInputClass = (hasError: boolean) =>
    cn("w-full", hasError && "border-red-500 focus-visible:ring-red-200 focus-visible:border-red-500");

  const getSelectClass = (hasError: boolean) =>
    cn("w-full", hasError && "border-red-500 ring-red-200 aria-invalid:border-red-500");

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="region">Region</Label>
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
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.region ? <p className="text-sm text-red-600">{errors.region}</p> : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="propertyType">Property type</Label>
              <Select
                value={values.propertyType}
                onValueChange={(value) => updateField("propertyType", value)}
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
              {errors.propertyType ? <p className="text-sm text-red-600">{errors.propertyType}</p> : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="totalAreaM2">Total area m²</Label>
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
              {errors.totalAreaM2 ? <p className="text-sm text-red-600">{errors.totalAreaM2}</p> : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="condition">Condition</Label>
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
                      {condition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.condition ? <p className="text-sm text-red-600">{errors.condition}</p> : null}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="finishLevel">Finish level</Label>
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
                      {finish}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.finishLevel ? <p className="text-sm text-red-600">{errors.finishLevel}</p> : null}
            </div>
          </div>

          <Button type="submit" variant="default" className="w-full sm:w-auto">
            Calculate estimate
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
