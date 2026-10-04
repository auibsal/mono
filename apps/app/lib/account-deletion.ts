const NOTICE_KEY = "account-deleted";

/** Remembers, for the sign-in page, that the account was just deleted. */
export const markAccountDeleted = () => {
  try {
    sessionStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // Without storage the sign-in page just shows no notice.
  }
};

/** True once after `markAccountDeleted`. */
export const takeAccountDeletedNotice = () => {
  try {
    const deleted = sessionStorage.getItem(NOTICE_KEY) === "1";
    sessionStorage.removeItem(NOTICE_KEY);
    return deleted;
  } catch {
    return false;
  }
};

/** The typed confirmation matches, ignoring surrounding spaces and case. */
export const matchesConfirmation = (typed: string, expected: string) =>
  typed.trim().normalize("NFC").toLowerCase() ===
  expected.trim().normalize("NFC").toLowerCase();
