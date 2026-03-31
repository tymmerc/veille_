"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
}>({ theme: "system", setTheme: () => {}, resolved: "light" });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("veille_theme") as Theme | null;
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("veille_theme", theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const resolve = () => {
      const isDark = theme === "dark" || (theme === "system" && mq.matches);
      setResolved(isDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", isDark);
    };
    resolve();
    mq.addEventListener("change", resolve);
    return () => mq.removeEventListener("change", resolve);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
