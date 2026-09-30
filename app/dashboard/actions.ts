"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    redirect("/dashboard?error=workspace-name");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const workspaceId = crypto.randomUUID();
  const slugBase = slugify(name) || "workspace";
  const slug = `${slugBase}-${workspaceId.slice(0, 8)}`;

  const { error: workspaceError } = await supabase.from("workspaces").insert({
    id: workspaceId,
    name,
    slug,
    created_by: userId,
  });

  if (workspaceError) {
    redirect("/dashboard?error=workspace-create");
  }

  const { error: membershipError } = await supabase
    .from("workspace_memberships")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
    });

  if (membershipError) {
    redirect("/dashboard?error=membership-create");
  }

  redirect("/dashboard");
}
