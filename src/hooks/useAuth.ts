import { useCallback, useState } from "react";
import { clearSession, readSession, verifyCredentials, writeSession } from "../auth/auth";

export function useAuth() {
  const [user, setUser] = useState<string | null>(readSession);

  const signIn = useCallback(async (username: string, password: string): Promise<boolean> => {
    const ok = await verifyCredentials(username, password);
    if (ok) {
      writeSession();
      setUser(readSession());
    }
    return ok;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return { user, signIn, signOut };
}
