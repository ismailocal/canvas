const TOOLBAR = [
  { key: 'select', label: 'Select', shortcut: 'V', icon: '↖' },
  { key: 'hand', label: 'Hand', shortcut: 'H', icon: '✋' },
  { key: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: '▭' },
  { key: 'ellipse', label: 'Ellipse', shortcut: 'E', icon: '◯' },
  { key: 'line', label: 'Line', shortcut: 'L', icon: '／' },
  { key: 'freehand', label: 'Draw', shortcut: 'P', icon: '✎' },
  { key: 'text', label: 'Text', shortcut: 'T', icon: 'A' },
];

const STYLE_PRESETS = {
  rectangle: { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.18)', strokeWidth: 2, opacity: 1 },
  ellipse: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.16)', strokeWidth: 2, opacity: 1 },
  line: { stroke: '#f8fafc', strokeWidth: 3, opacity: 1 },
  freehand: { stroke: '#f59e0b', strokeWidth: 3, opacity: 1 },
  text: { stroke: '#f8fafc', fontSize: 28, opacity: 1 },
};

const DEFAULT_STATE = {
  shapes: [],
  selectedIds: [],
  activeTool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  hoveredShapeId: null,
  drawingShapeId: null,
  isDraggingSelection: false,
  isPanning: false,
  isSpacePanning: false,
};

const createId = () => Math.random().toString(36).slice(2, 10);
const clone = (value) => structuredClone(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const screenToWorld = (screen, viewport) => ({
  x: (screen.x - viewport.x) / viewport.zoom,
  y: (screen.y - viewport.y) / viewport.zoom,
});

function pointToSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
  const clampedT = clamp(t, 0, 1);
  return distance(point, { x: a.x + clampedT * dx, y: a.y + clampedT * dy });
}

function hexToRgba(hex, alpha = 1) {
  const safe = hex.replace('#', '');
  const [r, g, b] = safe.length === 3
    ? safe.split('').map((item) => parseInt(item + item, 16))
    : [safe.slice(0, 2), safe.slice(2, 4), safe.slice(4, 6)].map((item) => parseInt(item, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaToHex(color) {
  if (!color || color === 'transparent') return '#ffffff';
  if (color.startsWith('#')) return color;
  const values = color.match(/\d+/g);
  if (!values || values.length < 3) return '#ffffff';
  return `#${values.slice(0, 3).map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
}

function getOpacityFromColor(color) {
  if (!color || color === 'transparent') return 0;
  const values = color.match(/[\d.]+/g);
  if (!values || values.length < 4) return 1;
  return clamp(Number(values[3]), 0, 1);
}

function getTextMetrics(shape) {
  const lines = shape.text.split('\n');
  const fontSize = shape.fontSize || 20;
  return {
    lines,
    width: Math.max(40, Math.max(...lines.map((line) => line.length || 1)) * fontSize * 0.62),
    height: Math.max(fontSize, lines.length * fontSize * 1.25),
  };
}

function getShapeBounds(shape) {
  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    case 'text': {
      const metrics = getTextMetrics(shape);
      return { x: shape.x, y: shape.y - (shape.fontSize || 20), width: metrics.width, height: metrics.height };
    }
    case 'line':
    case 'freehand': {
      const absolute = shape.points.map((point) => ({ x: point.x + shape.x, y: point.y + shape.y }));
      const xs = absolute.map((point) => point.x);
      const ys = absolute.map((point) => point.y);
      const minX = Math.min(shape.x, ...xs);
      const maxX = Math.max(shape.x, ...xs);
      const minY = Math.min(shape.y, ...ys);
      const maxY = Math.max(shape.y, ...ys);
      return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
    }
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function isPointInsideShape(point, shape) {
  if (shape.type === 'rectangle') {
    return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height;
  }

  if (shape.type === 'ellipse') {
    const radiusX = shape.width / 2;
    const radiusY = shape.height / 2;
    if (!radiusX || !radiusY) return false;
    const centerX = shape.x + radiusX;
    const centerY = shape.y + radiusY;
    return (((point.x - centerX) ** 2) / (radiusX ** 2)) + (((point.y - centerY) ** 2) / (radiusY ** 2)) <= 1;
  }

  if (shape.type === 'text') {
    const metrics = getTextMetrics(shape);
    return point.x >= shape.x && point.x <= shape.x + metrics.width && point.y >= shape.y - (shape.fontSize || 20) && point.y <= shape.y + metrics.height;
  }

  if (shape.type === 'line' || shape.type === 'freehand') {
    for (let i = 0; i < shape.points.length - 1; i += 1) {
      const a = { x: shape.x + shape.points[i].x, y: shape.y + shape.points[i].y };
      const b = { x: shape.x + shape.points[i + 1].x, y: shape.y + shape.points[i + 1].y };
      if (pointToSegmentDistance(point, a, b) <= Math.max(8, (shape.strokeWidth || 2) + 4)) return true;
    }
  }

  return false;
}

function getTopShapeAtPoint(shapes, point) {
  return [...shapes].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).find((shape) => isPointInsideShape(point, shape)) || null;
}

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

class WhiteboardStore {
  constructor(initialState = {}, bus = new EventBus()) {
    this.bus = bus;
    this.subscribers = new Set();
    this.state = { ...clone(DEFAULT_STATE), ...initialState };
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    this.subscribers.forEach((listener) => listener(this.state));
    this.bus.emit('document:changed', { state: this.state });
  }

  setState(updater) {
    this.state = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    this.notify();
  }

  setTool(tool) {
    this.state = { ...this.state, activeTool: tool };
    this.notify();
    this.bus.emit('tool:changed', { tool });
  }

  setViewport(viewport) {
    this.state = { ...this.state, viewport };
    this.notify();
    this.bus.emit('viewport:changed', { viewport });
  }

  addShape(shape) {
    this.state = { ...this.state, shapes: [...this.state.shapes, shape] };
    this.notify();
    this.bus.emit('shape:created', { shape });
  }

  updateShape(shapeId, patch) {
    let updatedShape = null;
    this.state = {
      ...this.state,
      shapes: this.state.shapes.map((shape) => {
        if (shape.id !== shapeId) return shape;
        updatedShape = { ...shape, ...patch };
        return updatedShape;
      }),
    };
    this.notify();
    if (updatedShape) this.bus.emit('shape:updated', { shape: updatedShape });
  }

  replaceShape(shapeId, nextShape) {
    this.state = {
      ...this.state,
      shapes: this.state.shapes.map((shape) => (shape.id === shapeId ? nextShape : shape)),
    };
    this.notify();
    this.bus.emit('shape:updated', { shape: nextShape });
  }

  deleteShape(shapeId) {
    this.state = {
      ...this.state,
      shapes: this.state.shapes.filter((shape) => shape.id !== shapeId),
      selectedIds: this.state.selectedIds.filter((id) => id !== shapeId),
    };
    this.notify();
    this.bus.emit('shape:deleted', { shapeId });
  }

  setSelection(ids) {
    this.state = { ...this.state, selectedIds: ids };
    this.notify();
    this.bus.emit('selection:changed', { ids });
  }
}

function renderShape(ctx, shape, isSelected) {
  ctx.save();
  ctx.globalAlpha = shape.opacity ?? 1;
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.strokeStyle = shape.stroke || '#f8fafc';
  ctx.fillStyle = shape.fill || 'transparent';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape.type) {
    case 'rectangle':
      if (shape.fill && shape.fill !== 'transparent') ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2);
      if (shape.fill && shape.fill !== 'transparent') ctx.fill();
      ctx.stroke();
      break;
    case 'line':
    case 'freehand':
      if (shape.points.length) {
        ctx.beginPath();
        ctx.moveTo(shape.x + shape.points[0].x, shape.y + shape.points[0].y);
        for (let i = 1; i < shape.points.length; i += 1) {
          ctx.lineTo(shape.x + shape.points[i].x, shape.y + shape.points[i].y);
        }
        ctx.stroke();
      }
      break;
    case 'text': {
      const fontSize = shape.fontSize || 20;
      ctx.fillStyle = shape.stroke || '#f8fafc';
      ctx.font = `${fontSize}px ${shape.fontFamily || 'Inter, Arial, sans-serif'}`;
      shape.text.split('\n').forEach((line, index) => ctx.fillText(line, shape.x, shape.y + index * fontSize * 1.25));
      break;
    }
    default:
      break;
  }

  if (isSelected) {
    const bounds = getShapeBounds(shape);
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 1;
    ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12);
  }

  ctx.restore();
}

function renderWelcome(canvas, ctx) {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '600 32px Inter, Arial, sans-serif';
  ctx.fillText('Welcome to your whiteboard', width / 2, height / 2 - 10);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText('Bir araç seçin ve çizime başlayın.', width / 2, height / 2 + 26);
  ctx.restore();
}

function renderScene(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#131316';
  ctx.fillRect(0, 0, rect.width, rect.height);

  if (!state.shapes.length) {
    renderWelcome(canvas, ctx);
  }

  ctx.save();
  ctx.translate(state.viewport.x, state.viewport.y);
  ctx.scale(state.viewport.zoom, state.viewport.zoom);
  [...state.shapes]
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .forEach((shape) => renderShape(ctx, shape, state.selectedIds.includes(shape.id)));
  ctx.restore();
}

function createTools() {
  let drawStart = null;
  let currentShapeId = null;
  let dragStartWorld = null;
  let initialSelectionSnapshot = [];
  let panStartScreen = null;
  let initialViewport = null;

  const createShape = (payload, ctx, type) => {
    drawStart = payload.world;
    const preset = STYLE_PRESETS[type];
    const common = {
      id: createId(),
      x: payload.world.x,
      y: payload.world.y,
      stroke: preset.stroke,
      fill: preset.fill,
      strokeWidth: preset.strokeWidth,
      opacity: preset.opacity,
    };

    const shape = type === 'rectangle'
      ? { ...common, type, width: 1, height: 1 }
      : type === 'ellipse'
        ? { ...common, type, width: 1, height: 1 }
        : type === 'line'
          ? { ...common, type, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }
          : { ...common, type, points: [{ x: 0, y: 0 }] };

    currentShapeId = shape.id;
    ctx.store.addShape(shape);
    ctx.store.setSelection([shape.id]);
    ctx.store.setState((prev) => ({ ...prev, drawingShapeId: shape.id }));
  };

  const completeShape = (ctx) => {
    drawStart = null;
    currentShapeId = null;
    ctx.store.setState((prev) => ({ ...prev, drawingShapeId: null }));
  };

  return {
    select: {
      onPointerDown(payload, ctx) {
        const state = ctx.getState();
        const hit = getTopShapeAtPoint(state.shapes, payload.world);
        if (hit) {
          const ids = state.selectedIds.includes(hit.id) ? state.selectedIds : [hit.id];
          ctx.store.setSelection(ids);
          dragStartWorld = payload.world;
          initialSelectionSnapshot = state.shapes.filter((shape) => ids.includes(shape.id)).map((shape) => ({ ...shape }));
          ctx.store.setState((prev) => ({ ...prev, isDraggingSelection: true }));
        } else {
          ctx.store.setSelection([]);
        }
      },
      onPointerMove(payload, ctx) {
        const state = ctx.getState();
        const hovered = getTopShapeAtPoint(state.shapes, payload.world);
        if ((hovered?.id || null) !== state.hoveredShapeId) {
          ctx.store.setState((prev) => ({ ...prev, hoveredShapeId: hovered?.id || null }));
        }

        if (!state.isDraggingSelection || !dragStartWorld) return;
        const dx = payload.world.x - dragStartWorld.x;
        const dy = payload.world.y - dragStartWorld.y;
        initialSelectionSnapshot.forEach((shape) => ctx.store.updateShape(shape.id, { x: shape.x + dx, y: shape.y + dy }));
      },
      onPointerUp(_payload, ctx) {
        if (ctx.getState().isDraggingSelection) {
          ctx.store.setState((prev) => ({ ...prev, isDraggingSelection: false }));
        }
        dragStartWorld = null;
        initialSelectionSnapshot = [];
      },
      onKeyDown(payload, ctx) {
        const state = ctx.getState();
        if ((payload.key === 'Delete' || payload.key === 'Backspace') && state.selectedIds.length) {
          [...state.selectedIds].forEach((id) => ctx.store.deleteShape(id));
          ctx.store.setSelection([]);
        }
      },
    },
    hand: {
      onPointerDown(payload, ctx) {
        panStartScreen = payload.screen;
        initialViewport = ctx.getState().viewport;
        ctx.store.setState((prev) => ({ ...prev, isPanning: true }));
      },
      onPointerMove(payload, ctx) {
        if (!ctx.getState().isPanning || !panStartScreen || !initialViewport) return;
        ctx.store.setViewport({
          ...initialViewport,
          x: initialViewport.x + (payload.screen.x - panStartScreen.x),
          y: initialViewport.y + (payload.screen.y - panStartScreen.y),
        });
      },
      onPointerUp(_payload, ctx) {
        ctx.store.setState((prev) => ({ ...prev, isPanning: false }));
        panStartScreen = null;
        initialViewport = null;
      },
    },
    rectangle: {
      onPointerDown: (payload, ctx) => createShape(payload, ctx, 'rectangle'),
      onPointerMove(payload, ctx) {
        if (!drawStart || !currentShapeId) return;
        ctx.store.updateShape(currentShapeId, {
          x: Math.min(drawStart.x, payload.world.x),
          y: Math.min(drawStart.y, payload.world.y),
          width: Math.abs(payload.world.x - drawStart.x),
          height: Math.abs(payload.world.y - drawStart.y),
        });
      },
      onPointerUp: (_payload, ctx) => completeShape(ctx),
    },
    ellipse: {
      onPointerDown: (payload, ctx) => createShape(payload, ctx, 'ellipse'),
      onPointerMove(payload, ctx) {
        if (!drawStart || !currentShapeId) return;
        ctx.store.updateShape(currentShapeId, {
          x: Math.min(drawStart.x, payload.world.x),
          y: Math.min(drawStart.y, payload.world.y),
          width: Math.abs(payload.world.x - drawStart.x),
          height: Math.abs(payload.world.y - drawStart.y),
        });
      },
      onPointerUp: (_payload, ctx) => completeShape(ctx),
    },
    line: {
      onPointerDown: (payload, ctx) => createShape(payload, ctx, 'line'),
      onPointerMove(payload, ctx) {
        if (!drawStart || !currentShapeId) return;
        ctx.store.updateShape(currentShapeId, {
          points: [{ x: 0, y: 0 }, { x: payload.world.x - drawStart.x, y: payload.world.y - drawStart.y }],
        });
      },
      onPointerUp: (_payload, ctx) => completeShape(ctx),
    },
    freehand: {
      onPointerDown: (payload, ctx) => createShape(payload, ctx, 'freehand'),
      onPointerMove(payload, ctx) {
        if (!drawStart || !currentShapeId) return;
        const shape = ctx.getState().shapes.find((item) => item.id === currentShapeId && item.type === 'freehand');
        if (!shape) return;
        ctx.store.replaceShape(currentShapeId, {
          ...shape,
          points: [...shape.points, { x: payload.world.x - drawStart.x, y: payload.world.y - drawStart.y }],
        });
      },
      onPointerUp: (_payload, ctx) => completeShape(ctx),
    },
    text: {
      onPointerDown(payload, ctx) {
        const text = window.prompt('Metin girin', 'Yeni metin');
        if (!text) return;
        const preset = STYLE_PRESETS.text;
        const shape = {
          id: createId(),
          type: 'text',
          x: payload.world.x,
          y: payload.world.y,
          text,
          fontSize: preset.fontSize,
          fontFamily: 'Inter, Arial, sans-serif',
          stroke: preset.stroke,
          opacity: preset.opacity,
        };
        ctx.store.addShape(shape);
        ctx.store.setSelection([shape.id]);
      },
    },
  };
}

function createPointerPayload(canvas, event, viewport) {
  const rect = canvas.getBoundingClientRect();
  const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  return {
    nativeEvent: event,
    screen,
    world: screenToWorld(screen, viewport),
    button: event.button,
    pointerId: event.pointerId,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  };
}

function createUI(root, store, canvas) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="board-shell">
        <div class="toolbar-wrap">
          <div class="toolbar" data-toolbar></div>
          <p class="toolbar-hint">To move canvas, hold mouse wheel or spacebar while dragging, or use the hand tool</p>
        </div>
        <section class="board-area">
          <div class="properties-panel hidden" data-properties></div>
        </section>
      </div>
    </div>
  `;

  const boardArea = root.querySelector('.board-area');
  boardArea.appendChild(canvas);
  canvas.className = 'board-canvas';

  const toolbar = root.querySelector('[data-toolbar]');
  const properties = root.querySelector('[data-properties]');

  const renderToolbar = (state) => {
    toolbar.innerHTML = TOOLBAR.map((tool) => `
      <button class="tool-button ${state.activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}" title="${tool.label} (${tool.shortcut})">
        <span class="tool-icon">${tool.icon}</span>
      </button>
    `).join('');
  };

  const selectedShape = () => {
    const state = store.getState();
    return state.shapes.find((shape) => shape.id === state.selectedIds[0]) || null;
  };

  const numberField = (key, label, value, min = 0, max = 100, step = 1) => `
    <label class="field">
      <span>${label}</span>
      <input data-number="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      <strong>${value}</strong>
    </label>
  `;

  const colorField = (key, label, value) => `
    <label class="field color-field">
      <span>${label}</span>
      <input data-color="${key}" type="color" value="${value}" />
    </label>
  `;

  const renderProperties = () => {
    const shape = selectedShape();
    if (!shape) {
      properties.classList.add('hidden');
      properties.innerHTML = '';
      return;
    }

    const supportsFill = shape.type === 'rectangle' || shape.type === 'ellipse';
    const supportsStroke = shape.type !== 'text' || shape.type === 'text';
    const supportsFont = shape.type === 'text';
    const supportsStrokeWidth = shape.type !== 'text';

    properties.classList.remove('hidden');
    properties.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-kicker">Selected element</div>
          <h3>${shape.type}</h3>
        </div>
        <button class="icon-action" data-delete-shape title="Delete">✕</button>
      </div>
      <div class="field-grid">
        ${supportsStroke ? colorField('stroke', shape.type === 'text' ? 'Text color' : 'Stroke', rgbaToHex(shape.stroke || '#ffffff')) : ''}
        ${supportsFill ? colorField('fill', 'Fill', rgbaToHex(shape.fill || '#ffffff')) : ''}
        ${supportsFill ? numberField('fillOpacity', 'Fill opacity', Math.round(getOpacityFromColor(shape.fill || 'transparent') * 100), 0, 100, 1) : ''}
        ${supportsStrokeWidth ? numberField('strokeWidth', 'Stroke width', shape.strokeWidth || 1, 1, 16, 1) : ''}
        ${supportsFont ? numberField('fontSize', 'Font size', shape.fontSize || 28, 12, 96, 1) : ''}
        ${numberField('opacity', 'Opacity', Math.round((shape.opacity ?? 1) * 100), 10, 100, 1)}
      </div>
      ${supportsFont ? `<label class="field"><span>Content</span><textarea data-text rows="4">${shape.text}</textarea></label>` : ''}
    `;
  };

  root.addEventListener('click', (event) => {
    const tool = event.target.closest('[data-tool]')?.dataset.tool;
    if (tool) store.setTool(tool);

    if (event.target.closest('[data-delete-shape]')) {
      const shape = selectedShape();
      if (!shape) return;
      store.deleteShape(shape.id);
      store.setSelection([]);
    }
  });

  properties.addEventListener('input', (event) => {
    const shape = selectedShape();
    if (!shape) return;
    const target = event.target;

    if (target.matches('[data-color="stroke"]')) {
      store.updateShape(shape.id, { stroke: target.value });
    }

    if (target.matches('[data-color="fill"]')) {
      const fillOpacity = properties.querySelector('[data-number="fillOpacity"]');
      const alpha = fillOpacity ? Number(fillOpacity.value) / 100 : 1;
      store.updateShape(shape.id, { fill: hexToRgba(target.value, alpha) });
    }

    if (target.matches('[data-number="fillOpacity"]')) {
      const fillColor = properties.querySelector('[data-color="fill"]');
      store.updateShape(shape.id, { fill: hexToRgba(fillColor?.value || '#ffffff', Number(target.value) / 100) });
    }

    if (target.matches('[data-number="strokeWidth"]')) {
      store.updateShape(shape.id, { strokeWidth: Number(target.value) });
    }

    if (target.matches('[data-number="fontSize"]')) {
      store.updateShape(shape.id, { fontSize: Number(target.value) });
    }

    if (target.matches('[data-number="opacity"]')) {
      store.updateShape(shape.id, { opacity: Number(target.value) / 100 });
    }

    if (target.matches('[data-text]')) {
      store.updateShape(shape.id, { text: target.value });
    }
  });

  store.subscribe((state) => {
    renderToolbar(state);
    renderProperties();
  });

  renderToolbar(store.getState());
  renderProperties();
}

function attachInteractions(canvas, store, tools) {
  let activeOverrideTool = null;

  const getActiveTool = () => activeOverrideTool || store.getState().activeTool;

  const handlePointer = (kind, event) => {
    const payload = createPointerPayload(canvas, event, store.getState().viewport);
    const ctx = { store, getState: () => store.getState() };
    const tool = tools[getActiveTool()];
    if (!tool) return;

    if (kind === 'down') tool.onPointerDown?.(payload, ctx);
    if (kind === 'move') tool.onPointerMove?.(payload, ctx);
    if (kind === 'up') tool.onPointerUp?.(payload, ctx);
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 1) activeOverrideTool = 'hand';
    canvas.setPointerCapture(event.pointerId);
    handlePointer('down', event);
  });

  canvas.addEventListener('pointermove', (event) => handlePointer('move', event));

  canvas.addEventListener('pointerup', (event) => {
    handlePointer('up', event);
    activeOverrideTool = null;
  });

  canvas.addEventListener('wheel', (event) => {
    const rect = canvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const state = store.getState();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const worldBeforeZoom = screenToWorld(screen, state.viewport);
      const nextZoom = clamp(state.viewport.zoom * (event.deltaY > 0 ? 0.95 : 1.05), 0.2, 4);
      store.setViewport({
        zoom: nextZoom,
        x: screen.x - worldBeforeZoom.x * nextZoom,
        y: screen.y - worldBeforeZoom.y * nextZoom,
      });
      return;
    }

    store.setViewport({
      ...state.viewport,
      x: state.viewport.x - event.deltaX,
      y: state.viewport.y - event.deltaY,
    });
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    const active = store.getState().activeTool;
    if (event.code === 'Space' && !store.getState().isSpacePanning) {
      store.setState((prev) => ({ ...prev, isSpacePanning: true }));
      activeOverrideTool = 'hand';
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && active === 'select') {
      tools.select.onKeyDown?.(event, { store, getState: () => store.getState() });
    }

    if (!event.ctrlKey && !event.metaKey) {
      if (event.key === 'v') store.setTool('select');
      if (event.key === 'h') store.setTool('hand');
      if (event.key === 'r') store.setTool('rectangle');
      if (event.key === 'e') store.setTool('ellipse');
      if (event.key === 'l') store.setTool('line');
      if (event.key === 'p') store.setTool('freehand');
      if (event.key === 't') store.setTool('text');
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      store.setState((prev) => ({ ...prev, isSpacePanning: false, isPanning: false }));
      activeOverrideTool = null;
    }
  });
}

function bootstrap() {
  const root = document.getElementById('app');
  const canvas = document.createElement('canvas');
  const bus = new EventBus();
  const store = new WhiteboardStore({}, bus);
  const tools = createTools();

  createUI(root, store, canvas);
  attachInteractions(canvas, store, tools);

  const render = () => renderScene(canvas, store.getState());
  store.subscribe(render);
  window.addEventListener('resize', render);
  render();
}

bootstrap();
