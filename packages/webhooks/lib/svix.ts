import "server-only";
import { Svix } from "svix";
import { keys } from "../keys";

const svixToken = keys().SVIX_TOKEN;

/** Sends an event to the organization's webhook endpoints. */
export const send = (orgId: string, eventType: string, payload: object) => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);

  return svix.message.create(orgId, {
    application: {
      name: orgId,
      uid: orgId,
    },
    eventType,
    payload: {
      eventType,
      ...payload,
    },
  });
};

/** A one-time link to the organization's webhook settings portal. */
export const getAppPortal = (orgId: string) => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);

  return svix.authentication.appPortalAccess(orgId, {
    application: {
      name: orgId,
      uid: orgId,
    },
  });
};
