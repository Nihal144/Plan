"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions are public endpoints, so each one re-verifies the session via
 * requireUser() rather than assuming the proxy redirect ran.
 *
 * None of these take a user id from the client: every RPC derives the caller
 * from auth.uid() inside Postgres.
 */

export type ActionState = { error?: string; ok?: boolean };

// All four share the useActionState signature so the client can surface errors
// and pending state uniformly.
export async function generateCode(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("generate_invite_code");
  if (error) return { error: error.message };

  revalidatePath("/partner");
  revalidatePath("/home");
  return { ok: true };
}

export async function redeemCode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const raw = String(formData.get("code") ?? "").trim();
  if (!/^\d{4}$/.test(raw)) {
    return { error: "Enter the 4-digit code." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_invite_code", { p_code: raw });
  if (error) return { error: error.message };

  revalidatePath("/partner");
  revalidatePath("/home");
  return { ok: true };
}

export async function respondToRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const requestId = String(formData.get("requestId") ?? "");
  const accept = formData.get("accept") === "true";
  if (!requestId) return { error: "Missing request." };

  const supabase = await createClient();
  // The RPC checks that the caller is the addressee — passing someone else's
  // request id here fails inside Postgres, not just in the UI.
  const { error } = await supabase.rpc("respond_to_pair_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return { error: error.message };

  revalidatePath("/partner");
  revalidatePath("/home");
  return { ok: true };
}

export async function unpair(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("unpair");
  if (error) return { error: error.message };

  revalidatePath("/partner");
  revalidatePath("/home");
  return { ok: true };
}
