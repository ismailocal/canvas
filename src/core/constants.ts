export const STYLE_PRESETS: Record<string, any> = {
  rectangle: { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.18)', strokeWidth: 2, opacity: 1 },
  ellipse: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.16)', strokeWidth: 2, opacity: 1 },
  line: { stroke: '#f8fafc', strokeWidth: 3, opacity: 1 },
  arrow: { stroke: '#ef4444', strokeWidth: 3, opacity: 1 },
  freehand: { stroke: '#f59e0b', strokeWidth: 3, opacity: 1 },
  text: { stroke: '#f8fafc', fontSize: 28, opacity: 1 },
};

export type ToolbarItem = {
  key: string;
  label?: string;
  shortcut?: string;
  icon?: string;
  isSeparator?: boolean;
};

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { key: 'hand', label: 'Hand', shortcut: 'H', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4H14V5a2 2 0 0 0-4 0v5H10V4a2 2 0 0 0-4 0v10a6 6 0 0 0 12 0z"></path></svg>` },
  { key: 'select', label: 'Select', shortcut: 'V', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l7.07 16.97 2.51-7.39 7.39-2.51L4 4z"/></svg>` },
  { key: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>` },
  { key: 'ellipse', label: 'Ellipse', shortcut: 'E', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>` },
  { key: 'arrow', label: 'Arrow', shortcut: 'A', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg>` },
  { key: 'line', label: 'Line', shortcut: 'L', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>` },
  { key: 'freehand', label: 'Draw', shortcut: 'P', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>` },
  { key: 'text', label: 'Text', shortcut: 'T', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M12 4v16M9 20h6"/></svg>` },
  { key: 'eraser', label: 'Eraser', shortcut: 'X', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"/></svg>` },
];
