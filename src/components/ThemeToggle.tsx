import { Segmented } from "faang-ui/components/Segmented";

export type Theme = "light" | "dark";

/** The kit reads the theme from `data-theme` on `<html>`; the app keeps the choice. */
export function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <Segmented
      label="Tema"
      size="sm"
      value={theme}
      onValueChange={onChange}
      options={[
        { value: "light", label: "Claro" },
        { value: "dark", label: "Escuro" },
      ]}
    />
  );
}
