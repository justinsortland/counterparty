"use server";

import { redirect } from "next/navigation";
import { NoteType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

type FormErrors = Partial<Record<"type" | "date" | "body" | "form", string>>;

export type CreateNoteState = { errors: FormErrors } | null;

const VALID_TYPES = Object.values(NoteType);

export async function createNote(
  _prevState: CreateNoteState,
  formData: FormData
): Promise<CreateNoteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const counterpartyId = (formData.get("counterpartyId") as string)?.trim();
  const dealId = (formData.get("dealId") as string)?.trim() || null;
  const redirectTo = (formData.get("redirectTo") as string)?.trim() || "/dashboard";
  const type = formData.get("type") as NoteType;
  const dateRaw = (formData.get("date") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();

  const errors: FormErrors = {};

  if (!type || !VALID_TYPES.includes(type)) errors.type = "Type is required.";
  if (!dateRaw) errors.date = "Date is required.";
  if (!body) errors.body = "Note body is required.";

  if (Object.keys(errors).length > 0) return { errors };

  // Verify ownership
  const cp = await db.counterparty.findFirst({
    where: { id: counterpartyId, workspaceId },
    select: { id: true },
  });
  if (!cp) return { errors: { form: "Counterparty not found." } };

  if (dealId) {
    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId },
      select: { id: true },
    });
    if (!deal) return { errors: { form: "Deal not found." } };
  }

  try {
    await db.note.create({
      data: {
        workspaceId,
        counterpartyId,
        dealId,
        type,
        date: new Date(dateRaw),
        body,
      },
    });
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  redirect(redirectTo);
}
