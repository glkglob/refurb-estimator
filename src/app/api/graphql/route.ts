import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { NextRequest } from "next/server";
import { resolvers, type GraphQLContext } from "@/graphql/resolvers";
import { typeDefs } from "@/graphql/schema";
import type {
  AuthenticatedUser,
  UserRole
} from "@/lib/supabase/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileRoleRow = {
  role: UserRole | null;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "customer" || value === "tradesperson" || value === "admin";
}

async function getContextUser(): Promise<AuthenticatedUser | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRoleRow>();

  const role: UserRole = isUserRole(profile?.role) ? profile.role : "customer";

  return {
    id: user.id,
    email: user.email ?? "",
    role
  };
}

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers
});

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: async (_req) => {
    const user = await getContextUser();
    return {
      req: { user }
    };
  }
});

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
