import { db } from "./db";

export async function bootstrapWorkspace(
  userId: string,
  email: string,
  name?: string | null
) {
  const existing = await db.workspaceMember.findFirst({
    where: { userId },
  });

  if (existing) return;

  const workspaceName =
    email.split("@")[0].replace(/[._-]/g, " ") + "'s workspace";

  await db.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: userId },
      update: { email },
      create: { id: userId, email, name: name ?? null },
    });

    const workspace = await tx.workspace.create({
      data: { name: workspaceName },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: "OWNER",
      },
    });
  });
}
