"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowUpRightIcon,
  CompassIcon,
  GridIcon,
  LayersIcon,
  MoonIcon,
  NoteIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  SunIcon
} from "@/components/icons";
import type { CommandItemRecord } from "@/lib/types";

type CommandPaletteProps = {
  open: boolean;
  items: CommandItemRecord[];
  theme: "light" | "dark";
  onClose: () => void;
  onToggleTheme: () => void;
};

function iconForItem(item: CommandItemRecord, theme: "light" | "dark") {
  if (item.kind === "category") return <GridIcon className="palette-icon" />;
  if (item.kind === "tag") return <SparkIcon className="palette-icon" />;
  if (item.kind === "collection") return <LayersIcon className="palette-icon" />;
  if (item.kind === "view") return <NoteIcon className="palette-icon" />;
  if (item.kind === "link") return <CompassIcon className="palette-icon" />;
  if (item.action === "theme") return theme === "light" ? <MoonIcon className="palette-icon" /> : <SunIcon className="palette-icon" />;
  return <ShieldIcon className="palette-icon" />;
}

function isNavigationItem(item: CommandItemRecord) {
  return item.kind === "category" || item.kind === "tag" || item.kind === "collection" || item.kind === "view" || item.kind === "action";
}

export function CommandPalette({ open, items, theme, onClose, onToggleTheme }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actionItems = useMemo<CommandItemRecord[]>(
    () => [
      {
        id: "action-theme",
        label: theme === "light" ? "切换到深色主题" : "切换到浅色主题",
        hint: "系统",
        kind: "action",
        action: "theme"
      },
      {
        id: "action-admin",
        label: "打开后台控制台",
        hint: "系统",
        kind: "action",
        href: "/admin",
        action: "admin"
      }
    ],
    [theme]
  );

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const merged = [...actionItems, ...items];

    if (!keyword) {
      return merged;
    }

    return merged.filter((item) => `${item.label} ${item.hint} ${item.kind}`.toLowerCase().includes(keyword));
  }, [actionItems, items, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredItems.length - 1, 0)));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === "Enter" && filteredItems[selectedIndex]) {
        event.preventDefault();
        activate(filteredItems[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, open, selectedIndex]);

  const activate = (item: CommandItemRecord) => {
    if (item.action === "theme") {
      onToggleTheme();
      onClose();
      return;
    }

    if (isNavigationItem(item) && item.href) {
      router.push(item.href);
      onClose();
      return;
    }

    if (item.kind === "link" && item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer");
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="palette-overlay" onClick={onClose} role="presentation">
      <div className="palette-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="命令面板">
        <div className="palette-header">
          <SearchIcon className="palette-search-icon" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="palette-input"
            placeholder="搜索站点、分类、标签、集合..."
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>
        <div className="palette-list">
          {filteredItems.length === 0 ? (
            <div className="palette-empty">
              <SparkIcon className="palette-icon" />
              <span>没有匹配的命令。</span>
            </div>
          ) : null}
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`palette-item ${index === selectedIndex ? "is-selected" : ""}`}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => activate(item)}
            >
              {iconForItem(item, theme)}
              <span>{item.label}</span>
              <span className="palette-item-hint">{item.hint}</span>
              {item.kind === "link" ? <ArrowUpRightIcon className="palette-item-arrow" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
