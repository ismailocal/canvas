import { WhiteboardStore } from './core/Store';
import { EventBus } from './core/EventBus';
import { InputManager } from './core/InputManager';
import { renderScene } from './core/Renderer';
import { TOOLBAR_ITEMS } from './core/constants';
import { hexToRgba } from './core/Utils';
import { exportToJson, importFromJson, exportToSvg, exportToPng } from './core/Export';
import { screenToWorld, getTopShapeAtPoint, getShapeBounds, getArrowClippedEndpoints } from './core/Geometry';
import { createId } from './core/Utils';

import { SelectTool } from './tools/SelectTool';
import { HandTool } from './tools/HandTool';
import { ShapeTool } from './tools/ShapeTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
import { initPropertiesPanel, renderPropertiesPanelHTML } from './ui/PropertiesPanel';

import './styles.css';

function createUI(root: HTMLElement, store: WhiteboardStore, canvas: HTMLCanvasElement) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="board-shell">
        <div class="toolbar-wrap">
          <div style="display: flex; gap: 8px;">
             <div class="toolbar" data-toolbar></div>
             <div class="toolbar" data-actions style="padding: 6px;">
               <button class="tool-button" data-action="export-json" title="Export JSON">JSON</button>
               <button class="tool-button" data-action="export-png" title="Export PNG">PNG</button>
               <button class="tool-button" data-action="export-svg" title="Export SVG">SVG</button>
               <button class="tool-button" data-action="toggle-grid" title="Toggle Grid" style="margin-left: 12px;">#</button>
               <label class="tool-button" title="Import JSON" style="cursor:pointer; display:flex; align-items:center; justify-content:center;">
                 <input type="file" data-action="import-json" accept=".json" style="display:none;" />
                 Load
               </label>
             </div>
          </div>
          <p class="toolbar-hint">To move canvas, hold mouse wheel or spacebar while dragging, or use the hand tool</p>
        </div>
        <section class="board-area">
          <div class="properties-panel hidden" data-properties></div>
        </section>
      </div>
    </div>
  `;

  const boardArea = root.querySelector('.board-area') as HTMLElement;
  boardArea.appendChild(canvas);
  canvas.className = 'board-canvas';

  const toolbar = root.querySelector('[data-toolbar]') as HTMLElement;
  const properties = root.querySelector('[data-properties]') as HTMLElement;

  const renderToolbar = (state: any) => {
    toolbar.innerHTML = TOOLBAR_ITEMS.map((tool) => {
      if (tool.isSeparator) {
        return `<div class="toolbar-separator"></div>`;
      }
      return `
        <button class="tool-button ${state.activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}" title="${tool.label} (${tool.shortcut})">
          <span class="tool-icon">${tool.icon}</span>
        </button>
      `;
    }).join('');
  };

  const selectedShape = () => {
    const state = store.getState();
    return state.shapes.find((shape) => shape.id === state.selectedIds[0]) || null;
  };

  const renderProperties = () => {
    const shape = selectedShape();
    if (!shape) {
      properties.classList.add('hidden');
      properties.innerHTML = '';
      return;
    }
    properties.classList.remove('hidden');
    properties.innerHTML = renderPropertiesPanelHTML(store);
  };

  // Initialize properties panel event delegation
  initPropertiesPanel(properties, store);

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const tool = target.closest('[data-tool]')?.getAttribute('data-tool');
    if (tool) store.setTool(tool);
    
    // Extracted into PropertiesPanel
    // const reorderBtn = target.closest('[data-reorder]');
    // const delBtn = target.closest('[data-delete-shape]');
    
    const actionBtn = target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.getAttribute('data-action');
      const shapes = store.getState().shapes;
      if (action === 'export-json') {
        const str = exportToJson(shapes);
        downloadFile('board.json', str, 'application/json');
      } else if (action === 'toggle-grid') {
        const currentState = store.getState();
        store.setState({ showGrid: !currentState.showGrid });
      } else if (action === 'export-svg') {
        const str = exportToSvg(shapes);
        downloadFile('board.svg', str, 'image/svg+xml');
      } else if (action === 'export-png') {
        exportToPng(shapes).then(url => {
           const a = document.createElement('a');
           a.href = url;
           a.download = 'board.png';
           a.click();
        });
      }
    }
  });

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  root.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-action="import-json"]')) {
      const file = target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const str = e.target?.result as string;
        if (str) {
           const shapes = importFromJson(str);
           if (shapes) store.setState({ shapes });
        }
      };
      reader.readAsText(file);
      target.value = ''; // reset
    }
  });

  properties.addEventListener('input', (event) => {
    const shape = selectedShape();
    if (!shape) return;
    const target = event.target as HTMLInputElement;

    if (target.matches('[data-color="stroke"]')) store.updateShape(shape.id, { stroke: target.value });
    if (target.matches('[data-color="fill"]')) {
      const opacityEl = properties.querySelector('[data-number="fillOpacity"]') as HTMLInputElement;
      const alpha = opacityEl ? Number(opacityEl.value) / 100 : 1;
      store.updateShape(shape.id, { fill: hexToRgba(target.value, alpha) });
    }
    if (target.matches('[data-number="fillOpacity"]')) {
      const colorEl = properties.querySelector('[data-color="fill"]') as HTMLInputElement;
      store.updateShape(shape.id, { fill: hexToRgba(colorEl?.value || '#ffffff', Number(target.value) / 100) });
    }
    if (target.matches('[data-number="strokeWidth"]')) store.updateShape(shape.id, { strokeWidth: Number(target.value) });
    if (target.matches('[data-number="roughness"]')) store.updateShape(shape.id, { roughness: Number(target.value) });
    if (target.matches('[data-select="fillStyle"]')) store.updateShape(shape.id, { fillStyle: target.value });
    if (target.matches('[data-number="fontSize"]')) store.updateShape(shape.id, { fontSize: Number(target.value) });
    if (target.matches('[data-number="opacity"]')) store.updateShape(shape.id, { opacity: Number(target.value) / 100 });
    if (target.matches('[data-text]')) store.updateShape(shape.id, { text: target.value });
  });

  properties.addEventListener('change', () => {
    store.commitState();
  });

  store.subscribe((state) => {
    renderToolbar(state);
    renderProperties();
  });

  renderToolbar(store.getState());
  renderProperties();
}

export function mountCanvas(root: HTMLElement, canvas: HTMLCanvasElement) {
  const bus = new EventBus();
  const store = new WhiteboardStore({}, bus);
  const api = store.createAPI();

  const tools = {
    select: new SelectTool(),
    hand: new HandTool(),
    rectangle: new ShapeTool('rectangle'),
    ellipse: new ShapeTool('ellipse'),
    line: new ShapeTool('line'),
    arrow: new ShapeTool('arrow'),
    freehand: new ShapeTool('freehand'),
    eraser: new EraserTool(),
    text: new TextTool(),
  };

  createUI(root, store, canvas);
  const inputManager = new InputManager(canvas, api, tools);

  const textEditor = document.createElement('textarea');
  textEditor.className = 'inline-text-editor';
  textEditor.style.position = 'absolute';
  textEditor.style.display = 'none';
  textEditor.style.background = 'transparent';
  textEditor.style.color = '#fff';
  textEditor.style.border = 'none';
  textEditor.style.outline = 'none';
  textEditor.style.fontFamily = 'Inter, Arial, sans-serif';
  textEditor.style.margin = '0';
  textEditor.style.padding = '0';
  textEditor.style.overflow = 'hidden';
  textEditor.style.whiteSpace = 'pre';
  textEditor.style.zIndex = '1000';
  textEditor.style.lineHeight = '1.2';
  textEditor.style.resize = 'none';
  root.appendChild(textEditor);

  let editingShapeId: string | null = null;

  root.addEventListener('dblclick', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.panel, .toolbar-wrap')) return;

    const state = store.getState();
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const screen = { x: (event.clientX - rect.left) * dpr, y: (event.clientY - rect.top) * dpr };
    const world = screenToWorld(screen, state.viewport);
    
    let targetShape = getTopShapeAtPoint(state.shapes, world);
    
    if (!targetShape) {
      const newId = createId();
      store.addShape({
        id: newId,
        type: 'text',
        x: world.x,
        y: world.y,
        text: '',
        fontSize: 20,
        fontFamily: 'Inter, Arial, sans-serif',
        stroke: '#f8fafc',
        opacity: 1
      });
      targetShape = store.getState().shapes.find(s => s.id === newId) || null;
    }
    
    if (targetShape) {
      editingShapeId = targetShape.id;
      textEditor.value = targetShape.text || '';
      textEditor.style.display = 'block';
      
      const zoom = state.viewport.zoom;
      textEditor.style.fontSize = `${(targetShape.fontSize || 20) * zoom}px`;
      textEditor.style.color = targetShape.stroke || '#f8fafc';
      
      let cx, cy;
      if (targetShape.type === 'text') {
         textEditor.style.textAlign = 'left';
         textEditor.style.transform = 'translateY(-100%)';
         cx = targetShape.x;
         cy = targetShape.y;
      } else {
         textEditor.style.textAlign = 'center';
         textEditor.style.transform = 'translate(-50%, -50%)';
         if (targetShape.type === 'line' || targetShape.type === 'arrow' || targetShape.type === 'freehand') {
           const pts = targetShape.points || [];
           if (pts.length > 1) {
             if (targetShape.type === 'freehand') {
               const p1 = { x: targetShape.x + pts[0].x, y: targetShape.y + pts[0].y };
               const p2 = { x: targetShape.x + pts[pts.length - 1].x, y: targetShape.y + pts[pts.length - 1].y };
               cx = (p1.x + p2.x) / 2;
               cy = (p1.y + p2.y) / 2;
             } else {
               const { p1, p2 } = getArrowClippedEndpoints(targetShape, state.shapes);
               cx = (p1.x + p2.x) / 2;
               cy = (p1.y + p2.y) / 2;
             }
           } else {
             const bounds = getShapeBounds(targetShape);
             cx = bounds.x + bounds.width / 2;
             cy = bounds.y + bounds.height / 2;
           }
         } else {
           const bounds = getShapeBounds(targetShape);
           cx = bounds.x + bounds.width / 2;
           cy = bounds.y + bounds.height / 2;
         }
      }
      
      const screenX = cx * zoom + state.viewport.x + rect.left;
      const screenY = cy * zoom + state.viewport.y + rect.top;
      
      textEditor.style.left = `${screenX}px`;
      textEditor.style.top = `${screenY}px`;
      
      textEditor.style.width = targetShape.type === 'text' ? 'auto' : `${Math.max(100, (targetShape.width || 100) * zoom)}px`;
      
      setTimeout(() => {
        textEditor.focus();
        textEditor.setSelectionRange(textEditor.value.length, textEditor.value.length);
        textareaResize();
      }, 0);
    }
  });

  const textareaResize = () => {
     textEditor.style.height = 'auto';
     textEditor.style.height = `${textEditor.scrollHeight}px`;
     if (textEditor.style.textAlign !== 'center') {
       textEditor.style.width = `${Math.max(50, textEditor.scrollWidth)}px`;
     }
  };
  textEditor.addEventListener('input', textareaResize);

  const closeEditor = () => {
    if (editingShapeId) {
      const val = textEditor.value.trim();
      const state = store.getState();
      const shape = state.shapes.find(s => s.id === editingShapeId);
      if (val) {
        store.updateShape(editingShapeId, { text: val });
        store.commitState();
      } else if (shape) {
         if (shape.type === 'text') {
            store.deleteShape(editingShapeId);
         } else {
            store.updateShape(editingShapeId, { text: '' });
         }
      }
      editingShapeId = null;
      textEditor.style.display = 'none';
      textEditor.value = '';
    }
  };

  textEditor.addEventListener('blur', closeEditor);
  textEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      textEditor.blur();
    }
  });

  const render = () => renderScene(canvas, store.getState());
  store.subscribe(render);
  window.addEventListener('resize', render);
  render();

  return {
    store,
    bus,
    destroy: () => {
      window.removeEventListener('resize', render);
      inputManager.destroy();
      textEditor.remove();
    },
  };
}
