import { Knock } from "@knocklabs/node";
import { keys } from "./keys";

const apiKey = keys().KNOCK_SECRET_API_KEY;

export const notifications = new Knock({ apiKey });
