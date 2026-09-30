import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentWorkspace() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id,name,slug")
    .order("created_at", { ascending: true })
    .limit(1);

  const workspace = workspaces?.[0];
  if (!workspace) redirect("/dashboard");

  return { supabase, workspace, userId: claimsData.claims.sub };
}
