import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("pp_theme") as Theme | null) || "dark";
    setThemeState(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pp_theme", theme);
  }, [theme]);

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
        setTheme: setThemeState,
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
