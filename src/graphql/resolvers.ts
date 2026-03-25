import { GraphQLError } from "graphql";
import { supabaseRepository } from "@/lib/prisma";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateProject } from "@/lib/estimator";
import type {
  Condition,
  EstimateInput,
  FinishLevel,
  Region
} from "@/lib/types";
import type { AuthenticatedUser } from "@/lib/supabase/auth-helpers";
import type { ProfileUpdateInput } from "@/lib/platform-types";

const REGION_VALUES: Region[] = [
   "London",
  "SouthEast",
  "EastOfEngland",
  "EastMidlands",
  "WestMidlands",
  "SouthWest",
  "NorthWest",
  "NorthEast",
  "YorkshireAndTheHumber",
  "Scotland",
  "Wales",
  "NorthernIreland"
];
const CONDITION_VALUES: Condition[] = ["poor", "fair", "good"];
const FINISH_LEVEL_VALUES: FinishLevel[] = ["budget", "standard", "premium"];

type CreateEstimateArgs = {
  input: {
    name?: string | null;
    region: string;
    propertyType: string;
    totalAreaM2: number;
    condition: string;
    finishLevel: string;
    purchasePrice?: number | null;
    gdv?: number | null;
  };
};

type UpdateProfileArgs = {
  input: ProfileUpdateInput;
};

type MarkNotificationReadArgs = {
  id: string;
};

export type GraphQLContext = {
  req: {
    user: AuthenticatedUser | null;
  };
};

function requireGraphQLUser(context: GraphQLContext): AuthenticatedUser {
  const user = context.req.user;
  if (!user) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" }
    });
  }
  return user;
}

function toGraphQLError(error: unknown): GraphQLError {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return new GraphQLError(message, {
    extensions: { code: "INTERNAL_SERVER_ERROR" }
  });
}

function ensureRegion(value: string): Region {
  if (REGION_VALUES.includes(value as Region)) {
    return value as Region;
  }

  throw new GraphQLError("Invalid region", {
    extensions: { code: "BAD_USER_INPUT" }
  });
}

function ensureCondition(value: string): Condition {
  if (CONDITION_VALUES.includes(value as Condition)) {
    return value as Condition;
  }

  throw new GraphQLError("Invalid condition", {
    extensions: { code: "BAD_USER_INPUT" }
  });
}

function ensureFinishLevel(value: string): FinishLevel {
  if (FINISH_LEVEL_VALUES.includes(value as FinishLevel)) {
    return value as FinishLevel;
  }

  throw new GraphQLError("Invalid finishLevel", {
    extensions: { code: "BAD_USER_INPUT" }
  });
}

export const resolvers = {
  Query: {
    me: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return context.req.user;
    },

    estimates: async (
      _parent: unknown,
      args: { limit?: number },
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);

      try {
        return await supabaseRepository.scenario.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: args.limit
        });
      } catch (error) {
        throw toGraphQLError(error);
      }
    },

    estimate: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);

      try {
        return await supabaseRepository.scenario.findUnique({
          where: { id: args.id, userId: user.id }
        });
      } catch (error) {
        throw toGraphQLError(error);
      }
    },

    gallery: async (
      _parent: unknown,
      args: { limit?: number },
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);

      try {
        return await supabaseRepository.galleryItem.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: args.limit
        });
      } catch (error) {
        throw toGraphQLError(error);
      }
    },

    notifications: async (
      _parent: unknown,
      args: { unreadOnly?: boolean; limit?: number },
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);

      try {
        return await supabaseRepository.notification.findMany({
          where: {
            userId: user.id,
            isRead: args.unreadOnly ? false : undefined
          },
          orderBy: { createdAt: "desc" },
          take: args.limit
        });
      } catch (error) {
        throw toGraphQLError(error);
      }
    }
  },

  Mutation: {
    createEstimate: async (
      _parent: unknown,
      args: CreateEstimateArgs,
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);
      const region = ensureRegion(args.input.region);
      const condition = ensureCondition(args.input.condition);
      const finishLevel = ensureFinishLevel(args.input.finishLevel);
      const propertyType = args.input.propertyType?.trim();

      if (!propertyType) {
        throw new GraphQLError("propertyType is required", {
          extensions: { code: "BAD_USER_INPUT" }
        });
      }

      if (!Number.isFinite(args.input.totalAreaM2) || args.input.totalAreaM2 <= 0) {
        throw new GraphQLError("totalAreaM2 must be a positive number", {
          extensions: { code: "BAD_USER_INPUT" }
        });
      }

      const estimateInput: EstimateInput = {
        region,
        projectType: "refurb",
        propertyType,
        totalAreaM2: args.input.totalAreaM2,
        condition,
        finishLevel
      };

      try {
        const estimateResult = estimateProject(estimateInput, defaultCostLibrary);
        return await supabaseRepository.scenario.create({
          data: {
            userId: user.id,
            name: args.input.name?.trim() || `${propertyType} estimate`,
            input: estimateInput,
            result: estimateResult,
            purchasePrice: args.input.purchasePrice ?? undefined,
            gdv: args.input.gdv ?? undefined
          }
        });
      } catch (error) {
        throw toGraphQLError(error);
      }
    },

    updateProfile: async (
      _parent: unknown,
      args: UpdateProfileArgs,
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);

      try {
        return await supabaseRepository.profile.update({
          where: { id: user.id },
          data: args.input
        });
      } catch (error) {
        throw toGraphQLError(error);
      }
    },

    markNotificationRead: async (
      _parent: unknown,
      args: MarkNotificationReadArgs,
      context: GraphQLContext
    ) => {
      const user = requireGraphQLUser(context);

      try {
        await supabaseRepository.notification.update({
          where: {
            id: args.id,
            userId: user.id
          },
          data: {
            isRead: true
          }
        });
        return true;
      } catch (error) {
        throw toGraphQLError(error);
      }
    }
  }
};
