import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface User {
  email: string;
  name: string;
}

interface AuthCtx {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  ready: boolean;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

const USERS_KEY = "pp_users";
const SESSION_KEY = "pp_session";

function readUsers(): Record<string, { name: string; password: string }> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeUsers(u: any) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      if (s) setUser(JSON.parse(s));
    } catch {}
    setReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const users = readUsers();
    const u = users[email.toLowerCase()];
    if (!u || u.password !== password) throw new Error("Invalid email or password");
    const session = { email: email.toLowerCase(), name: u.name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  };

  const signup = async (name: string, email: string, password: string) => {
    const users = readUsers();
    const key = email.toLowerCase();
    if (users[key]) throw new Error("Account already exists");
    users[key] = { name, password };
    writeUsers(users);
    const session = { email: key, name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
