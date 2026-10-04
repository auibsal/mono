"use client";

import { AvatarStack } from "./avatar-stack";
import { CollaborationProvider } from "./collaboration-provider";
import { Cursors } from "./cursors";

/** Who else is looking at this organization, with live cursors. */
export const Presence = ({ organizationId }: { organizationId: string }) => (
  <CollaborationProvider organizationId={organizationId}>
    <AvatarStack />
    <Cursors />
  </CollaborationProvider>
);
