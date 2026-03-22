import { db } from "./db";

export async function getWorkspaceId(userId: string): Promise<string> {
  const member = await db.workspaceMember.findFirstOrThrow({
    where: { userId },
    select: { workspaceId: true },
  });
  return member.workspaceId;
}
