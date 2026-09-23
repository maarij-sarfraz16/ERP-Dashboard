import { useCallback, useState } from "react";
import { readSession, signInUser, signOutUser, type AuthUser, type SignInResult } from "../auth/auth";

export function useAuth() {
  // Restored from `sessionStorage` on first render, so a page refresh inside a
  // signed-in tab does not bounce back to the login screen.
  const [user, setUser] = useState<AuthUser | null>(readSession);

  const signIn = useCallback(async (username: string, password: string): Promise<SignInResult> => {
    const result = await signInUser(username, password);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    // Clear the UI first: the Frappe logout call is best-effort and must never
    // leave the person staring at a dashboard they just signed out of.
    setUser(null);
    await signOutUser();
  }, []);

  return { user, signIn, signOut };
}
