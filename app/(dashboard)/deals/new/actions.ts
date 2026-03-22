"use server";

import { redirect } from "next/navigation";
import { DealStage } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

type FormErrors = Partial<
  Record<"name" | "counterpartyId" | "stage" | "form", string>
>;

export type CreateDealState = { errors: FormErrors } | null;

const VALID_STAGES = Object.values(DealStage);

export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const name = (formData.get("name") as string)?.trim();
  const counterpartyId = (formData.get("counterpartyId") as string)?.trim();
  const type = (formData.get("type") as string)?.trim() || null;
  const stage = formData.get("stage") as DealStage;
  const valueRaw = (formData.get("value") as string)?.trim();
  const currency = (formData.get("currency") as string)?.trim() || "USD";
  const followUpRaw = (formData.get("nextFollowUpAt") as string)?.trim();

  const errors: FormErrors = {};

  if (!name) errors.name = "Name is required.";
  if (!counterpartyId) {
    errors.counterpartyId = "Counterparty is required.";
  } else {
    const cp = await db.counterparty.findFirst({
      where: { id: counterpartyId, workspaceId },
      select: { id: true },
    });
    if (!cp) errors.counterpartyId = "Invalid counterparty.";
  }
  if (!stage || !VALID_STAGES.includes(stage))
    errors.stage = "Stage is required.";

  if (Object.keys(errors).length > 0) return { errors };

  const value =
    valueRaw && !isNaN(parseFloat(valueRaw)) ? parseFloat(valueRaw) : null;
  const nextFollowUpAt = followUpRaw ? new Date(followUpRaw) : null;

  try {
    await db.deal.create({
      data: {
        workspaceId,
        counterpartyId,
        name,
        type,
        stage,
        value,
        currency,
        nextFollowUpAt,
      },
    });
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  redirect("/deals");
}
