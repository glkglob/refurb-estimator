"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CONTRACTOR_BUDGET_RANGE_OPTIONS,
  CONTRACTOR_PROJECT_TYPE_OPTIONS
} from "@/lib/contractorEnquiryOptions";

function toNumericString(value: string | null): string {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/[^\d.]/g, "");
  if (normalized.length === 0) {
    return "";
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return "";
  }

  return String(numericValue);
}

export default function ContractorEnquiryForm() {
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [projectType, setProjectType] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [estimateTotal, setEstimateTotal] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefilledPostcode = searchParams.get("postcode");
    const prefilledEstimate = toNumericString(searchParams.get("estimate"));
    const prefilledCategory = searchParams.get("category");
    const prefilledNotes = searchParams.get("notes");

    if (prefilledPostcode && postcode.length === 0) {
      setPostcode(prefilledPostcode.trim().toUpperCase());
    }

    if (prefilledEstimate && estimateTotal.length === 0) {
      setEstimateTotal(prefilledEstimate);
    }

    if (prefilledCategory && projectType.length === 0) {
      setProjectType(prefilledCategory.trim());
    }

    if (prefilledNotes && message.length === 0) {
      setMessage(prefilledNotes.trim());
    }
  }, [searchParams, postcode.length, estimateTotal.length, projectType.length, message.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          postcode,
          projectType,
          budgetRange,
          estimateTotal: estimateTotal ? Number(estimateTotal) : null,
          message
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to submit enquiry");
      }

      setIsSuccess(true);
      setName("");
      setEmail("");
      setProjectType("");
      setBudgetRange("");
      setMessage("");
    } catch (submitError) {
      const messageValue =
        submitError instanceof Error ? submitError.message : "Unable to submit enquiry";
      setError(messageValue);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request contractor quotes</CardTitle>
        <p className="text-sm text-muted-foreground">
          Share your project details and we&apos;ll match you with relevant local contractors.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-muted-foreground">
              Name
              <Input
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
              />
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              Email
              <Input
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              Postcode
              <Input
                name="postcode"
                required
                value={postcode}
                onChange={(event) => setPostcode(event.target.value.toUpperCase())}
                placeholder="e.g. M1 1AE"
              />
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              Project Type
              <select
                name="projectType"
                required
                value={projectType}
                onChange={(event) => setProjectType(event.target.value)}
                className="bp-focus-ring flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:outline-none"
              >
                <option value="">Select project type</option>
                {CONTRACTOR_PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              Budget Range
              <select
                name="budgetRange"
                required
                value={budgetRange}
                onChange={(event) => setBudgetRange(event.target.value)}
                className="bp-focus-ring flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:outline-none"
              >
                <option value="">Select budget range</option>
                {CONTRACTOR_BUDGET_RANGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              Estimate Total (optional)
              <Input
                name="estimateTotal"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={estimateTotal}
                onChange={(event) => setEstimateTotal(event.target.value)}
                placeholder="e.g. 85000"
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm text-muted-foreground">
            Message (optional)
            <textarea
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="bp-focus-ring w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none"
              placeholder="Tell us a bit about your project scope and timeline."
            />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit enquiry"}
            </Button>
            {isSuccess ? (
              <p className="text-sm text-emerald-600">
                Thanks! We&apos;ll match you with local contractors shortly.
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
