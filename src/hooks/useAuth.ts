import { useCallback, useEffect, useState } from "react";
import {
  AUTH_EXPIRED_EVENT,
  fetchSession,
  signIn as requestSignIn,
  signOut as requestSignOut,
} from "../auth/auth";

/**
 * `null` while the session is still being checked, so the app can hold off a
 * frame instead of flashing the login screen at an already-signed-in user on
 * every refresh.
 */
export type AuthState = { status: "checking" } | { status: "in"; user: string } | { status: "out" };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "checking" });

  // One ask on mount: the cookie is HttpOnly, so the server is the only thing
  // that can say whether this browser still has a session.
  useEffect(() => {
    let cancelled = false;
    fetchSession().then((user) => {
      if (cancelled) return;
      setState(user ? { status: "in", user } : { status: "out" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setState({ status: "out" });
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const signIn = useCallback(async (username: string, password: string): Promise<void> => {
    const user = await requestSignIn(username, password);
    setState({ status: "in", user });
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await requestSignOut();
    setState({ status: "out" });
  }, []);

  return { state, signIn, signOut };
}
