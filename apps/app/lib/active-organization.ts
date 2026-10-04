const STORAGE_KEY = "active-organization";

/**
 * The organization the user last worked in. Only a preference: the app
 * checks it against the user's memberships (RLS decides what is visible).
 */
export const readActiveOrganization = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const rememberActiveOrganization = (organizationId: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, organizationId);
  } catch {
    // Without storage the first organization is used.
  }
};

export const forgetActiveOrganization = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
};
