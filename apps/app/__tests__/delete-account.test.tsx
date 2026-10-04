import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DeleteAccountDialog } from "@/components/account/delete-account";
import { takeAccountDeletedNotice } from "@/lib/account-deletion";
import { fakeSupabase, renderWithApp } from "./render";

const SLUG_LABEL = /Type “solo-org” to confirm/;
const PHRASE_LABEL = /To confirm, type/;

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const ME = "00000000-0000-0000-0000-00000000000a";
const TEAMMATE = "00000000-0000-0000-0000-00000000000b";

/**
 * A query-builder stand-in: every builder method returns the same object,
 * and awaiting it resolves to the result for the table and operation.
 */
const fakeFrom = (results: Record<string, { data: unknown; error: null }>) => {
  const calls: { method: string; args: unknown[]; table: string }[] = [];
  const from = vi.fn((table: string) => {
    let operation = "select";
    const builder: Record<string, unknown> = {
      // biome-ignore lint/suspicious/noThenProperty: mimics the awaitable builder
      then: (resolve: (value: unknown) => unknown) =>
        resolve(results[`${table}.${operation}`]),
    };
    for (const method of ["select", "update", "eq", "neq", "in"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ args, method, table });
        if (method === "update") {
          operation = "update";
        }
        return builder;
      };
    }
    return builder;
  });
  return { calls, from };
};

const session = { access_token: "token", user: { id: ME } };

const setup = ({
  blockers,
  fromResults = {},
}: {
  blockers: unknown[][];
  fromResults?: Record<string, { data: unknown; error: null }>;
}) => {
  const rpc = vi.fn();
  for (const data of blockers) {
    rpc.mockResolvedValueOnce({ data, error: null });
  }
  const { calls, from } = fakeFrom(fromResults);
  const signOut = vi.fn(async () => ({ error: null }));
  const supabase = fakeSupabase({
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn((callback) => {
        callback("INITIAL_SESSION", session);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut,
    },
    from,
    rpc,
  });
  const fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);

  renderWithApp(
    <DeleteAccountDialog trigger={<button type="button">open</button>} />,
    { locale: "en", supabase }
  );
  fireEvent.click(screen.getByRole("button", { name: "open" }));

  return { calls, fetchMock, rpc, signOut };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("delete account", () => {
  test("a sole owner hands the organization to a teammate first", async () => {
    const { calls, fetchMock } = setup({
      blockers: [
        [
          {
            name: "Org One",
            organization_id: ORG_ID,
            other_members: 1,
            slug: "org-one",
          },
        ],
        [],
      ],
      fromResults: {
        "memberships.select": { data: [{ user_id: TEAMMATE }], error: null },
        "memberships.update": { data: [{ user_id: TEAMMATE }], error: null },
        "profiles.select": {
          data: [{ full_name: "Member B", id: TEAMMATE }],
          error: null,
        },
      },
    });

    expect(
      await screen.findByText("First, resolve your organizations")
    ).toBeTruthy();
    const makeOwner = screen.getByRole("button", { name: "Make owner" });
    expect(makeOwner).toHaveProperty("disabled", true);

    fireEvent.click(await screen.findByRole("radio", { name: "Member B" }));
    fireEvent.click(makeOwner);

    // Resolved: the final confirmation step appears.
    expect(await screen.findByText("Delete your account?")).toBeTruthy();
    expect(calls).toContainEqual({
      args: [{ role: "owner" }],
      method: "update",
      table: "memberships",
    });
    expect(calls).toContainEqual({
      args: ["user_id", TEAMMATE],
      method: "eq",
      table: "memberships",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an organization can only be deleted after typing its address", async () => {
    const { fetchMock } = setup({
      blockers: [
        [
          {
            name: "Solo Org",
            organization_id: ORG_ID,
            other_members: 0,
            slug: "solo-org",
          },
        ],
        [],
      ],
    });

    expect(
      await screen.findByText(
        "You're the only member, so this organization can only be deleted."
      )
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete organization" })
    );

    const confirm = screen.getByRole("button", { name: "Delete Solo Org" });
    const input = screen.getByLabelText(SLUG_LABEL);
    fireEvent.change(input, { target: { value: "solo" } });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(input, { target: { value: "solo-org" } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3002/organizations/delete",
        expect.objectContaining({
          body: JSON.stringify({ organizationId: ORG_ID }),
        })
      )
    );
    expect(await screen.findByText("Delete your account?")).toBeTruthy();
  });

  test("deletes the account after the phrase is typed", async () => {
    const { fetchMock, signOut } = setup({ blockers: [[]] });

    const confirm = await screen.findByRole("button", {
      name: "Delete my account permanently",
    });
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(PHRASE_LABEL), {
      target: { value: "  Delete my account " },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(signOut).toHaveBeenCalledWith({ scope: "local" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3002/account/delete",
      expect.objectContaining({ method: "POST" })
    );
    expect(takeAccountDeletedNotice()).toBe(true);
  });

  test("goes back to the organizations when the API reports a new blocker", async () => {
    const { rpc, signOut } = setup({
      blockers: [
        [],
        [
          {
            name: "Org One",
            organization_id: ORG_ID,
            other_members: 0,
            slug: "org-one",
          },
        ],
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "sole_owner" }, { status: 409 }))
    );

    fireEvent.change(await screen.findByLabelText(PHRASE_LABEL), {
      target: { value: "delete my account" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete my account permanently" })
    );

    expect(
      await screen.findByText("First, resolve your organizations")
    ).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(signOut).not.toHaveBeenCalled();
  });
});
