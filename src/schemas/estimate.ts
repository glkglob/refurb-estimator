import { z } from "zod";

export const estimateInputSchema = z
  .object({
    area: z
      .number()
      .finite("area must be a finite number")
      .gt(0, "area must be greater than 0"),
    region: z.string().trim().min(1, "region is required"),
  })
  .strict();

export type EstimateInput = z.infer<typeof estimateInputSchema>;
