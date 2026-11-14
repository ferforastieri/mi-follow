import { useEffect, useState } from "react";
import { Segmented } from "faang-ui/components/Segmented";

type Theme = "light" | "dark";

/** The kit reads the theme from `data-theme` on `<html>`; the choice is remembered. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("mifollow:theme", theme);
    } catch {
      // Private mode: the choice just doesn't survive the tab.
    }
  }, [theme]);

  return (
    <Segmented
      label="Tema"
      size="sm"
      value={theme}
      onValueChange={setTheme}
      options={[
        { value: "light", label: "Claro" },
        { value: "dark", label: "Escuro" },
      ]}
    />
  );
}
