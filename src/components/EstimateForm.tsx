"use client";

import { useMemo, useState } from "react";
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

const inputBaseClass =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2";

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

  function fieldClass(hasError: boolean): string {
    if (hasError) {
      return `${inputBaseClass} border-red-500 focus:border-red-500 focus:ring-red-200`;
    }
    return `${inputBaseClass} border-slate-300 focus:border-slate-500 focus:ring-slate-200`;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="region" className="text-sm font-medium text-slate-700">
            Region
          </label>
          <select
            id="region"
            value={values.region}
            onChange={(event) => updateField("region", event.target.value as FormValues["region"])}
            className={fieldClass(Boolean(errors.region))}
          >
            <option value="">Select region</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          {errors.region ? <p className="text-sm text-red-600">{errors.region}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="propertyType" className="text-sm font-medium text-slate-700">
            Property type
          </label>
          <select
            id="propertyType"
            value={values.propertyType}
            onChange={(event) => updateField("propertyType", event.target.value)}
            className={fieldClass(Boolean(errors.propertyType))}
          >
            <option value="">Select property type</option>
            {propertyTypes.map((propertyType) => (
              <option key={propertyType} value={propertyType}>
                {propertyType}
              </option>
            ))}
          </select>
          {errors.propertyType ? <p className="text-sm text-red-600">{errors.propertyType}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="totalAreaM2" className="text-sm font-medium text-slate-700">
            Total area m²
          </label>
          <input
            id="totalAreaM2"
            type="number"
            min={1}
            step={1}
            placeholder="e.g. 75"
            value={values.totalAreaM2}
            onChange={(event) => updateField("totalAreaM2", event.target.value)}
            className={fieldClass(Boolean(errors.totalAreaM2))}
          />
          {errors.totalAreaM2 ? <p className="text-sm text-red-600">{errors.totalAreaM2}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="condition" className="text-sm font-medium text-slate-700">
            Condition
          </label>
          <select
            id="condition"
            value={values.condition}
            onChange={(event) =>
              updateField("condition", event.target.value as FormValues["condition"])
            }
            className={fieldClass(Boolean(errors.condition))}
          >
            <option value="">Select condition</option>
            {conditions.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
          {errors.condition ? <p className="text-sm text-red-600">{errors.condition}</p> : null}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="finishLevel" className="text-sm font-medium text-slate-700">
            Finish level
          </label>
          <select
            id="finishLevel"
            value={values.finishLevel}
            onChange={(event) =>
              updateField("finishLevel", event.target.value as FormValues["finishLevel"])
            }
            className={fieldClass(Boolean(errors.finishLevel))}
          >
            <option value="">Select finish level</option>
            {finishLevels.map((finish) => (
              <option key={finish} value={finish}>
                {finish}
              </option>
            ))}
          </select>
          {errors.finishLevel ? <p className="text-sm text-red-600">{errors.finishLevel}</p> : null}
        </div>
      </div>

      <button
        type="submit"
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Calculate estimate
      </button>
    </form>
  );
}
