import type { Shape } from '../core/types';

// Constants for Excalidraw-like colors
const STROKE_COLORS = ['#e5e7eb', '#ff8a8a', '#4ade80', '#60a5fa', '#eab308'];
const FILL_COLORS = ['transparent', '#7f1d1d', '#14532d', '#1e3a8a', '#713f12'];

const ICONS = {
  strokeWidth: [
    { val: '1', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="1"/></svg>` },
    { val: '3', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2.5"/></svg>` },
    { val: '6', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="4"/></svg>` }
  ],
  strokeStyle: [
    { val: 'solid', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/></svg>` },
    { val: 'dashed', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2" stroke-dasharray="4 4"/></svg>` },
    { val: 'dotted', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/></svg>` }
  ],
  roughness: [
    { val: '0', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4,12 10,12 14,12 20,12" stroke-width="2"/></svg>` },
    { val: '1', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12c4-2 4 2 8 0s4 2 8 0" stroke-width="2"/></svg>` },
    { val: '2', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12c3-4 5 4 8 0s5 4 8 0" stroke-width="2"/></svg>` }
  ],
  roundness: [
    { val: 'sharp', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="6" y="6" width="12" height="12" stroke-width="2"/></svg>` },
    { val: 'round', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="6" y="6" width="12" height="12" rx="3" stroke-width="2"/></svg>` }
  ],
  layers: [
    { val: 'back', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8L12 3L21 8L12 13L3 8Z"/><path d="M3 16L12 21L21 16"/><path d="M12 13V21"/></svg>` },
    { val: 'backward', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5V19M19 12l-7 7-7-7"/></svg>` },
    { val: 'forward', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>` },
    { val: 'front', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16L12 21L3 16"/><path d="M3 8L12 13L21 8L12 3L3 8Z"/><path d="M12 13V3"/></svg>` },
  ],
  align: [
    { val: 'left', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="4" y2="20"/><line x1="8" y1="10" x2="20" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>` },
    { val: 'center', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="4" x2="12" y2="20"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>` },
    { val: 'right', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="20" y1="4" x2="20" y2="20"/><line x1="4" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>` },
    { val: 'top', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="20" y2="4"/><line x1="10" y1="8" x2="10" y2="20"/><line x1="14" y1="8" x2="14" y2="16"/></svg>` },
    { val: 'middle', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="12" x2="20" y2="12"/><line x1="10" y1="6" x2="10" y2="18"/><line x1="14" y1="8" x2="14" y2="16"/></svg>` },
    { val: 'bottom', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="20" x2="20" y2="20"/><line x1="10" y1="4" x2="10" y2="16"/><line x1="14" y1="8" x2="14" y2="16"/></svg>` },
  ],
  actions: [
    { val: 'duplicate', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` },
    { val: 'delete', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>` },
    { val: 'group', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/><path d="M10 10l4 4"/></svg>` }, // simple mockup icon for group
  ]
};

export function initPropertiesPanel(container: HTMLElement, store: any) {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-prop]');
    if (btn) {
      const prop = btn.getAttribute('data-prop')!;
      const val = btn.getAttribute('data-val')!;
      
      const state = store.getState();
      const selectedIds = state.selectedIds;
      if (selectedIds.length > 0) {
        if (prop === 'action') {
          if (val === 'delete') {
            selectedIds.forEach((id: string) => store.deleteShape(id));
            store.setSelection([]);
            store.commitState();
          } else if (val === 'duplicate') {
            const newIds: string[] = [];
            selectedIds.forEach((id: string) => {
              const oldShape = state.shapes.find((s: Shape) => s.id === id);
              if (oldShape) {
                const newShape = { ...oldShape, id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9), x: oldShape.x + 10, y: oldShape.y + 10 };
                store.addShape(newShape);
                newIds.push(newShape.id);
              }
            });
            store.setSelection(newIds);
            store.commitState();
          }
          return;
        }

        if (prop === 'layer') {
          selectedIds.forEach((id: string) => store.reorderShape(id, val));
          return;
        }

        let parsedVal: any = val;
        if (prop === 'strokeWidth' || prop === 'roughness') {
          parsedVal = parseFloat(val);
        }
        selectedIds.forEach((id: string) => store.updateShape(id, { [prop]: parsedVal }));
        store.commitState();
      }
    }
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches('[data-prop="opacity"]')) {
      const state = store.getState();
      const selectedIds = state.selectedIds;
      if (selectedIds.length > 0) {
        selectedIds.forEach((id: string) => store.updateShape(id, { opacity: parseInt(target.value) / 100 }));
      }
    }
  });

  container.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches('[data-prop="opacity"]')) {
      store.commitState();
    }
  });
}

function renderColorSwatches(prop: string, colors: string[], activeColor: string | undefined): string {
  const safeActiveColor = activeColor || colors[0];
  let html = `<div class="color-picker-row">`;
  
  html += `<div class="color-picker-group">`;
  colors.forEach(c => {
    const isTrans = c === 'transparent';
    const activeClass = safeActiveColor === c ? 'active' : '';
    html += `
      <button class="color-swatch ${isTrans ? 'transparent-swatch' : ''} ${activeClass}" 
              data-prop="${prop}" data-val="${c}" 
              style="background-color: ${isTrans ? 'transparent' : c};"></button>
    `;
  });
  html += `</div>`;
  
  // Vertical divider
  html += `<div class="divider-vertical"></div>`;
  
  // Active selection box
  const isTrans = safeActiveColor === 'transparent';
  html += `<div class="color-picker-group">
      <div class="color-swatch static-active ${isTrans ? 'transparent-swatch' : ''}" style="background-color: ${isTrans ? 'transparent' : safeActiveColor};"></div>
  </div>`;

  html += `</div>`;
  return html;
}

function renderBtnGroup(prop: string, items: { val: string, svg: string }[], activeVal: any): string {
  let html = `<div class="prop-btn-group">`;
  items.forEach(item => {
    const activeClass = String(activeVal) === item.val ? 'active' : '';
    html += `
      <button class="prop-btn ${activeClass}" data-prop="${prop}" data-val="${item.val}">
        ${item.svg}
      </button>
    `;
  });
  html += `</div>`;
  return html;
}

export function renderPropertiesPanelHTML(store: any): string {
  const state = store.getState();
  const selectedShape = state.shapes.find((s: Shape) => s.id === state.selectedIds[0]);

  if (!selectedShape) {
    return '';
  }

  const isRectOrEllipse = selectedShape.type === 'rectangle' || selectedShape.type === 'ellipse';
  const isText = selectedShape.type === 'text';

  let html = `<div class="prop-panel-inner">`;

  // Stroke Color
  if (!isText) {
    html += `<div class="prop-section">
      <div class="prop-label">Kontur</div>
      ${renderColorSwatches('stroke', STROKE_COLORS, selectedShape.stroke)}
    </div>`;
  }

  // Fill Color
  if (isRectOrEllipse) {
    html += `<div class="prop-section">
      <div class="prop-label">Arka plan</div>
      ${renderColorSwatches('fill', FILL_COLORS, selectedShape.fill)}
    </div>`;
  }

  // Stroke Width
  if (!isText) {
    html += `<div class="prop-section">
      <div class="prop-label">Kontur genişliği</div>
      ${renderBtnGroup('strokeWidth', ICONS.strokeWidth, selectedShape.strokeWidth ?? 1)}
    </div>`;
  }

  // Stroke Style
  if (!isText) {
    html += `<div class="prop-section">
      <div class="prop-label">Kontur stili</div>
      ${renderBtnGroup('strokeStyle', ICONS.strokeStyle, selectedShape.strokeStyle ?? 'solid')}
    </div>`;
  }

  // Roughness
  if (!isText) {
    html += `<div class="prop-section">
      <div class="prop-label">Üstün körülük</div>
      ${renderBtnGroup('roughness', ICONS.roughness, selectedShape.roughness ?? 1)}
    </div>`;
  }

  // Roundness
  if (isRectOrEllipse) {
    html += `<div class="prop-section">
      <div class="prop-label">Kenarlar</div>
      ${renderBtnGroup('roundness', ICONS.roundness, selectedShape.roundness ?? 'sharp')}
    </div>`;
  }

  // Opacity
  const opacityVal = Math.round((selectedShape.opacity ?? 1) * 100);
  html += `<div class="prop-section">
    <div class="prop-label">Opaklık</div>
    <div class="slider-container">
      <input type="range" class="prop-slider" data-prop="opacity" min="0" max="100" value="${opacityVal}" />
      <div class="slider-labels">
        <span>0</span><span>100</span>
      </div>
    </div>
  </div>`;

  // Layers
  html += `<div class="prop-section">
    <div class="prop-label">Katmanlar</div>
    ${renderBtnGroup('layer', ICONS.layers, null)}
  </div>`;

  // Actions
  html += `<div class="prop-section">
    <div class="prop-label">Eylemler</div>
    <div class="prop-btn-group">
      ${ICONS.actions.map(item => `
        <button class="prop-btn" data-prop="action" data-val="${item.val}" title="${item.val}">${item.svg}</button>
      `).join('')}
    </div>
  </div>`;

  html += `</div>`;
  return html;
}
