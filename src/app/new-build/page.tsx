"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";

import NewBuildResults from "@/components/NewBuildResults";
import ShareEstimateModal from "@/components/ShareEstimateModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import type { QuotePdfInput } from "@/lib/generateQuotePdf";
import { calculateNewBuild } from "@/lib/newBuildEstimator";
import type { SharedEstimateSnapshot } from "@/lib/share";
import type {
  NewBuildInput,
  NewBuildPropertyType,
  NewBuildResult,
  NewBuildSpec,
} from "@/lib/types";

type CommercialType = "office" | "retail" | "warehouse" | "restaurant";
type FitOutLevel = "shell_only" | "cat_a" | "cat_b";

const PROPERTY_OPTIONS: Array<{ value: NewBuildPropertyType; label: string }> = [
  { value: "flat", label: "Flat" },
  { value: "terraced", label: "Terraced house" },
  { value: "semi-detached", label: "Semi-detached house" },
  { value: "detached", label: "Detached house" },
  { value: "bungalow", label: "Bungalow" },
  { value: "hmo", label: "HMO" },
  { value: "block_of_flats", label: "Block of flats" },
  { value: "commercial", label: "Commercial" },
];

const SPEC_OPTIONS: Array<{
  value: NewBuildSpec;
  label: string;
  description: string;
}> = [
  {
    value: "basic",
    label: "Basic",
    description: "Standard materials, functional design",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Good quality finishes, modern systems",
  },
  {
    value: "premium",
    label: "Premium",
    description: "High-end finishes, bespoke design",
  },
];

const COMMERCIAL_TYPES: Array<{ value: CommercialType; label: string }> = [
  { value: "office", label: "Office" },
  { value: "retail", label: "Retail" },
  { value: "warehouse", label: "Warehouse" },
  { value: "restaurant", label: "Restaurant" },
];

const FIT_OUT_LEVELS: Array<{
  value: FitOutLevel;
  label: string;
  helper: string;
}> = [
  {
    value: "shell_only",
    label: "Shell only",
    helper: "Empty shell, no internal fit-out",
  },
  {
    value: "cat_a",
    label: "Cat A",
    helper: "Raised floors, suspended ceilings, basic M&E",
  },
  {
    value: "cat_b",
    label: "Cat B",
    helper: "Fully fitted: partitions, furniture, IT infrastructure",
  },
];

const PROPERTY_LABELS: Record<NewBuildPropertyType, string> = {
  flat: "flat",
  terraced: "terraced house",
  "semi-detached": "semi-detached house",
  detached: "detached house",
  bungalow: "bungalow",
  hmo: "HMO",
  block_of_flats: "block of flats",
  commercial: "commercial property",
};

const SPEC_LABELS: Record<NewBuildSpec, string> = {
  basic: "basic",
  standard: "standard",
  premium: "premium",
};

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function NewBuildPage() {
  const { toast } = useToast();

  const [propertyType, setPropertyType] =
    useState<NewBuildPropertyType>("detached");
  const [spec, setSpec] = useState<NewBuildSpec>("standard");
  const [totalAreaM2, setTotalAreaM2] = useState("120");
  const [bedrooms, setBedrooms] = useState("3");
  const [storeys, setStoreys] = useState("2");
  const [blockStoreys, setBlockStoreys] = useState("3");
  const [postcodeDistrict, setPostcodeDistrict] = useState("");

  const [garage, setGarage] = useState(false);
  const [renewableEnergy, setRenewableEnergy] = useState(false);
  const [basementIncluded, setBasementIncluded] = useState(false);

  const [numberOfUnits, setNumberOfUnits] = useState("6");
  const [liftIncluded, setLiftIncluded] = useState(false);
  const [commercialGroundFloor, setCommercialGroundFloor] = useState(false);

  const [numberOfLettableRooms, setNumberOfLettableRooms] = useState("6");
  const [enSuitePerRoom, setEnSuitePerRoom] = useState(false);
  const [communalKitchen, setCommunalKitchen] = useState(true);
  const [fireEscapeRequired, setFireEscapeRequired] = useState(false);

  const [commercialType, setCommercialType] =
    useState<CommercialType>("office");
  const [fitOutLevel, setFitOutLevel] = useState<FitOutLevel>("cat_a");
  const [disabledAccess, setDisabledAccess] = useState(false);
  const [extractionSystem, setExtractionSystem] = useState(false);
  const [parkingSpaces, setParkingSpaces] = useState("0");

  const [showOptions, setShowOptions] = useState(false);
  const [result, setResult] = useState<NewBuildResult | null>(null);
  const [lastInput, setLastInput] = useState<NewBuildInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const isBlockOfFlats = propertyType === "block_of_flats";
  const isHmo = propertyType === "hmo";
  const isCommercial = propertyType === "commercial";
  const isFlat = propertyType === "flat";
  const storeysMax = isBlockOfFlats ? 20 : 5;

  const specHelper = useMemo(
    () => SPEC_OPTIONS.find((option) => option.value === spec)?.description ?? "",
    [spec],
  );

  const fitOutHelper = useMemo(
    () =>
      FIT_OUT_LEVELS.find((option) => option.value === fitOutLevel)?.helper ?? "",
    [fitOutLevel],
  );

  useEffect(() => {
    if (result) {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  useEffect(() => {
    if (!isHmo) {
      setEnSuitePerRoom(false);
      setFireEscapeRequired(false);
    }

    if (!isCommercial) {
      setExtractionSystem(false);
    }
  }, [isHmo, isCommercial]);

  function buildPropertyDescription(
    input: NewBuildInput,
    summary: NewBuildResult,
  ): string {
    const parts: string[] = [
      `${input.totalAreaM2}m² ${PROPERTY_LABELS[input.propertyType]}`,
    ];

    if (input.propertyType === "block_of_flats" && input.numberOfUnits) {
      parts.push(`${input.numberOfUnits} units`);
    }

    if (input.propertyType === "commercial" && input.commercialType) {
      parts.push(input.commercialType);
    }

    if (input.propertyType !== "commercial") {
      parts.push(`${input.bedrooms} bed`);
    }

    parts.push(summary.region);
    parts.push(`${SPEC_LABELS[input.spec]} spec`);

    return parts.join(", ");
  }

  function buildInput(): NewBuildInput | null {
    const areaValue = parseNumber(totalAreaM2);
    const bedroomValue = parseNumber(bedrooms);
    const storeyValue = parseNumber(isBlockOfFlats ? blockStoreys : storeys);

    if (!areaValue || areaValue <= 0) {
      setError("Total floor area must be greater than zero");
      return null;
    }

    if (!isCommercial && (!bedroomValue || bedroomValue < 1)) {
      setError("Bedrooms must be at least 1");
      return null;
    }

    if (!storeyValue || storeyValue < 1 || storeyValue > storeysMax) {
      setError(`Storeys must be between 1 and ${storeysMax}`);
      return null;
    }

    if (postcodeDistrict.trim().length === 0) {
      setError("Postcode district is required");
      return null;
    }

    const input: NewBuildInput = {
      propertyType,
      spec,
      totalAreaM2: areaValue,
      bedrooms: isCommercial ? 1 : (bedroomValue ?? 1),
      storeys: storeyValue,
      postcodeDistrict: postcodeDistrict.trim().toUpperCase(),
      garage: isFlat ? undefined : garage,
      renewableEnergy,
      basementIncluded: isFlat ? undefined : basementIncluded,
    };

    if (isBlockOfFlats) {
      const unitsValue = parseNumber(numberOfUnits);

      if (!unitsValue || unitsValue < 2) {
        setError("Block of flats must include at least 2 units");
        return null;
      }

      input.numberOfUnits = unitsValue;
      input.numberOfStoreys = storeyValue;
      input.liftIncluded = liftIncluded;
      input.commercialGroundFloor = commercialGroundFloor;
    }

    if (isHmo) {
      const lettableRoomsValue = parseNumber(numberOfLettableRooms);

      if (!lettableRoomsValue || lettableRoomsValue < 3) {
        setError("HMOs require at least 3 lettable rooms");
        return null;
      }

      input.numberOfLettableRooms = lettableRoomsValue;
      input.enSuitePerRoom = enSuitePerRoom;
      input.communalKitchen = communalKitchen;
      input.fireEscapeRequired = fireEscapeRequired;
    }

    if (isCommercial) {
      input.commercialType = commercialType;
      input.fitOutLevel = fitOutLevel;
      input.disabledAccess = disabledAccess;
      input.extractionSystem = extractionSystem;

      const parkingValue = parseNumber(parkingSpaces);
      if (parkingValue !== null) {
        input.parkingSpaces = parkingValue;
      }
    }

    return input;
  }

  const shareSnapshot = useMemo<SharedEstimateSnapshot | null>(() => {
    if (!result || !lastInput) {
      return null;
    }

    return {
      kind: "new_build",
      input: lastInput,
      result,
    };
  }, [lastInput, result]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input = buildInput();
    if (!input) return;

    try {
      const estimate = calculateNewBuild(input);
      setResult(estimate);
      setLastInput(input);
    } catch (submitError) {
      setResult(null);
      setLastInput(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to calculate estimate",
      );
    }
  }

  function handleReset() {
    setPropertyType("detached");
    setSpec("standard");
    setTotalAreaM2("120");
    setBedrooms("3");
    setStoreys("2");
    setBlockStoreys("3");
    setPostcodeDistrict("");

    setGarage(false);
    setRenewableEnergy(false);
    setBasementIncluded(false);

    setNumberOfUnits("6");
    setLiftIncluded(false);
    setCommercialGroundFloor(false);

    setNumberOfLettableRooms("6");
    setEnSuitePerRoom(false);
    setCommunalKitchen(true);
    setFireEscapeRequired(false);

    setCommercialType("office");
    setFitOutLevel("cat_a");
    setDisabledAccess(false);
    setExtractionSystem(false);
    setParkingSpaces("0");

    setShowOptions(false);
    setResult(null);
    setLastInput(null);
    setError(null);
    setIsShareModalOpen(false);
  }

  async function handleDownloadPdf() {
    if (!result || !lastInput) return;

    setIsGeneratingPdf(true);

    try {
      const pdfInput: QuotePdfInput = {
        propertyDescription: buildPropertyDescription(lastInput, result),
        categories: result.categories.map((category) => ({
          category: category.category,
          low: category.low,
          typical: category.typical,
          high: category.high,
        })),
        totalLow: result.totalLow,
        totalTypical: result.totalTypical,
        totalHigh: result.totalHigh,
        costPerM2: result.costPerM2,
        contingencyPercent: result.contingencyPercent,
        feesPercent: result.feesPercent,
        adjustments: result.adjustments.map((adjustment) => ({
          label: adjustment.label,
          amount: adjustment.amount,
          reason: adjustment.reason,
        })),
        metadata: {
          postcodeDistrict: lastInput.postcodeDistrict,
          renovationScope: "New build",
          qualityTier: lastInput.spec,
          listedBuilding: false,
        },
      };

      const response = await apiFetch("/api/v1/estimate/pdf", {
        method: "POST",
        body: JSON.stringify({ input: pdfInput }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "new-build-estimate.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "PDF generation failed",
        description: "Unable to generate the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">New Build Estimate</h1>

      <p className="text-sm text-muted-foreground">
        Estimate the cost of building a new property from scratch, including all
        construction stages, professional fees, and contingency.
      </p>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Property type</Label>
                <Select
                  value={propertyType}
                  onValueChange={(value) =>
                    setPropertyType(value as NewBuildPropertyType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Specification</Label>
                <Select
                  value={spec}
                  onValueChange={(value) => setSpec(value as NewBuildSpec)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specification" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEC_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{specHelper}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-build-area">Total floor area (m²)</Label>
                <Input
                  id="new-build-area"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  placeholder="e.g. 120"
                  value={totalAreaM2}
                  onChange={(event) => setTotalAreaM2(event.target.value)}
                />
              </div>

              {!isCommercial ? (
                <div className="space-y-2">
                  <Label htmlFor="new-build-bedrooms">Bedrooms</Label>
                  <Input
                    id="new-build-bedrooms"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    placeholder="e.g. 3"
                    value={bedrooms}
                    onChange={(event) => setBedrooms(event.target.value)}
                  />
                </div>
              ) : null}

              {!isBlockOfFlats ? (
                <div className="space-y-2">
                  <Label htmlFor="new-build-storeys">Storeys</Label>
                  <Input
                    id="new-build-storeys"
                    type="number"
                    min={1}
                    max={storeysMax}
                    step={1}
                    placeholder="e.g. 2"
                    value={storeys}
                    onChange={(event) => setStoreys(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="new-build-postcode">Postcode district</Label>
                <Input
                  id="new-build-postcode"
                  type="text"
                  maxLength={8}
                  placeholder="e.g. SW1A"
                  value={postcodeDistrict}
                  onChange={(event) =>
                    setPostcodeDistrict(event.target.value.toUpperCase())
                  }
                />
                <p className="text-xs text-muted-foreground">
                  For regional pricing
                </p>
              </div>
            </div>

            {isBlockOfFlats ? (
              <Card className="border border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Block of flats
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-build-units">Number of units</Label>
                    <Input
                      id="new-build-units"
                      type="number"
                      min={2}
                      max={200}
                      step={1}
                      placeholder="e.g. 6"
                      value={numberOfUnits}
                      onChange={(event) => setNumberOfUnits(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-build-block-storeys">
                      Building storeys
                    </Label>
                    <Input
                      id="new-build-block-storeys"
                      type="number"
                      min={2}
                      max={20}
                      step={1}
                      placeholder="e.g. 4"
                      value={blockStoreys}
                      onChange={(event) => setBlockStoreys(event.target.value)}
                    />
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={liftIncluded}
                      onChange={(event) => setLiftIncluded(event.target.checked)}
                    />
                    <span>Include lift</span>
                  </label>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={commercialGroundFloor}
                      onChange={(event) =>
                        setCommercialGroundFloor(event.target.checked)
                      }
                    />
                    <span>
                      Commercial ground floor{" "}
                      <span className="text-xs text-muted-foreground">
                        (retail/office on ground floor)
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>
            ) : null}

            {isHmo ? (
              <Card className="border border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    HMO details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-build-hmo-rooms">
                      Number of lettable rooms
                    </Label>
                    <Input
                      id="new-build-hmo-rooms"
                      type="number"
                      min={3}
                      max={20}
                      step={1}
                      placeholder="e.g. 6"
                      value={numberOfLettableRooms}
                      onChange={(event) =>
                        setNumberOfLettableRooms(event.target.value)
                      }
                    />
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={enSuitePerRoom}
                      onChange={(event) =>
                        setEnSuitePerRoom(event.target.checked)
                      }
                    />
                    <span>
                      En-suite per room{" "}
                      <span className="text-xs text-muted-foreground">
                        (each lettable room gets its own shower room)
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={communalKitchen}
                      onChange={(event) =>
                        setCommunalKitchen(event.target.checked)
                      }
                    />
                    <span>
                      Communal kitchen{" "}
                      <span className="text-xs text-muted-foreground">
                        (shared kitchen facilities)
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={fireEscapeRequired}
                      onChange={(event) =>
                        setFireEscapeRequired(event.target.checked)
                      }
                    />
                    <span>
                      External fire escape{" "}
                      <span className="text-xs text-muted-foreground">
                        (required for 3+ storey HMOs)
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>
            ) : null}

            {isCommercial ? (
              <Card className="border border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Commercial details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Commercial type</Label>
                    <Select
                      value={commercialType}
                      onValueChange={(value) =>
                        setCommercialType(value as CommercialType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select commercial type" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMERCIAL_TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fit-out level</Label>
                    <Select
                      value={fitOutLevel}
                      onValueChange={(value) =>
                        setFitOutLevel(value as FitOutLevel)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fit-out level" />
                      </SelectTrigger>
                      <SelectContent>
                        {FIT_OUT_LEVELS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {fitOutHelper}
                    </p>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={disabledAccess}
                      onChange={(event) =>
                        setDisabledAccess(event.target.checked)
                      }
                    />
                    <span>
                      DDA compliance{" "}
                      <span className="text-xs text-muted-foreground">
                        (ramps, accessible WC, compliant door widths)
                      </span>
                    </span>
                  </label>

                  {commercialType === "restaurant" ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                        checked={extractionSystem}
                        onChange={(event) =>
                          setExtractionSystem(event.target.checked)
                        }
                      />
                      <span>
                        Kitchen extraction{" "}
                        <span className="text-xs text-muted-foreground">
                          (commercial extract and ventilation system)
                        </span>
                      </span>
                    </label>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="new-build-parking">Parking spaces</Label>
                    <Input
                      id="new-build-parking"
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      placeholder="e.g. 10"
                      value={parkingSpaces}
                      onChange={(event) => setParkingSpaces(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                className="flex items-center gap-2 px-0 text-sm font-medium"
                onClick={() => setShowOptions((prev) => !prev)}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${
                    showOptions ? "rotate-180" : ""
                  }`}
                />
                Additional options
              </Button>

              {showOptions ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {!isFlat ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                        checked={garage}
                        onChange={(event) => setGarage(event.target.checked)}
                      />
                      <span>Garage</span>
                    </label>
                  ) : null}

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      checked={renewableEnergy}
                      onChange={(event) =>
                        setRenewableEnergy(event.target.checked)
                      }
                    />
                    <span>Renewable energy (solar/ASHP)</span>
                  </label>

                  {!isFlat ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                        checked={basementIncluded}
                        onChange={(event) =>
                          setBasementIncluded(event.target.checked)
                        }
                      />
                      <span>Basement</span>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="bp-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="font-medium text-destructive">{error}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="default">
                Calculate estimate
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                New estimate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <div id="results" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <NewBuildResults result={result} />
            <ValueUpliftCard ... />
  </div>
) : null}
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? <Loader2 className="size-4 animate-spin" /> : null}
              Download PDF
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsShareModalOpen(true)}
            >
              Share estimate
            </Button>

            <Button type="button" variant="outline" onClick={handleReset}>
              New estimate
            </Button>
          </div>

          <NewBuildResults result={result} />
        </div>
      ) : null}

      {shareSnapshot ? (
        <ShareEstimateModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          snapshot={shareSnapshot}
        />
      ) : null}
    </section>
  );
}
