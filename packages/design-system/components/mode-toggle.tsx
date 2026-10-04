"use client";

import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export interface ModeToggleLabels {
  dark: string;
  light: string;
  system: string;
  toggle: string;
}

const defaultLabels: ModeToggleLabels = {
  dark: "Dark",
  light: "Light",
  system: "System",
  toggle: "Toggle theme",
};

const themes = ["light", "dark", "system"] as const;

interface ModeToggleProps {
  /** Translated texts; English by default. */
  readonly labels?: ModeToggleLabels;
}

export const ModeToggle = ({ labels = defaultLabels }: ModeToggleProps) => {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="shrink-0 text-foreground"
          size="icon"
          variant="ghost"
        >
          <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{labels.toggle}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {themes.map((value) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            {labels[value]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
