import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteRequestBody = {
  configId?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabaseServiceKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");

    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as DeleteRequestBody;
    const configId = body.configId?.trim();
    if (!configId) {
      return NextResponse.json({ error: "configId is required." }, { status: 400 });
    }

    const deleteClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : authedClient;

    const { data, error } = await deleteClient
      .from("employee_configs")
      .delete()
      .eq("id", configId)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Employee not found or you do not have permission to delete it." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, id: data[0]?.id ?? configId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete request failed." },
      { status: 500 },
    );
  }
}
