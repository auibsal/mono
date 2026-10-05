// Liveblocks types for SAL: presence and user info only. Documents being
// co-edited stay in Postgres; a room holds the live draft.
// https://liveblocks.io/docs/api-reference/liveblocks-react#Typing-your-data
declare global {
  interface Liveblocks {
    Presence: {
      /** The field the person is editing, if any (e.g. "body_en"). */
      field: string | null;
    };
    RoomEvent: { type: "saved"; at: string };
    RoomInfo: Record<string, never>;
    Storage: Record<string, never>;
    ThreadMetadata: Record<string, never>;
    UserMeta: {
      id: string;
      info: {
        color: string;
        name: string;
      };
    };
  }
}

export {};
