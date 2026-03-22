"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

type FormErrors = Partial<Record<"name" | "form", string>>;

export type CreateContactState = { errors: FormErrors } | null;

export async function createContact(
  _prevState: CreateContactState,
  formData: FormData
): Promise<CreateContactState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);
  const counterpartyId = (formData.get("counterpartyId") as string)?.trim();

  // Verify the counterparty exists and belongs to this workspace
  const counterparty = await db.counterparty.findFirst({
    where: { id: counterpartyId, workspaceId },
    select: { id: true },
  });
  if (!counterparty) redirect("/counterparties");

  const name = (formData.get("name") as string)?.trim();
  const title = (formData.get("title") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const linkedinUrl = (formData.get("linkedinUrl") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const errors: FormErrors = {};
  if (!name) errors.name = "Name is required.";
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await db.contact.create({
      data: {
        workspaceId,
        counterpartyId,
        name,
        title,
        email,
        phone,
        linkedinUrl,
        notes,
      },
    });
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  redirect(`/counterparties/${counterpartyId}`);
}
