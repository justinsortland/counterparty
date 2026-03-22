"use server";

import { redirect } from "next/navigation";
import { CounterpartyType, CounterpartyStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";

type FormErrors = Partial<Record<"name" | "type" | "status" | "form", string>>;

export type CreateCounterpartyState = { errors: FormErrors } | null;

const VALID_TYPES = Object.values(CounterpartyType);
const VALID_STATUSES = Object.values(CounterpartyStatus);

export async function createCounterparty(
  _prevState: CreateCounterpartyState,
  formData: FormData
): Promise<CreateCounterpartyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(user.id);

  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as CounterpartyType;
  const status = formData.get("status") as CounterpartyStatus;
  const website = (formData.get("website") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const tagsRaw = (formData.get("tags") as string)?.trim();

  const errors: FormErrors = {};

  if (!name) errors.name = "Name is required.";
  if (!type || !VALID_TYPES.includes(type)) errors.type = "Type is required.";
  if (!status || !VALID_STATUSES.includes(status))
    errors.status = "Status is required.";

  if (Object.keys(errors).length > 0) return { errors };

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  try {
    await db.counterparty.create({
      data: {
        workspaceId,
        name,
        type,
        status,
        website,
        description,
        tags,
      },
    });
  } catch {
    return { errors: { form: "Something went wrong. Please try again." } };
  }

  redirect("/counterparties");
}
