const TOOLBAR = [
  { key: 'select', label: 'Select', shortcut: 'V' },
  { key: 'hand', label: 'Hand', shortcut: 'H' },
  { key: 'rectangle', label: 'Rect', shortcut: 'R' },
  { key: 'ellipse', label: 'Ellipse', shortcut: 'E' },
  { key: 'line', label: 'Line', shortcut: 'L' },
  { key: 'freehand', label: 'Pen', shortcut: 'P' },
  { key: 'text', label: 'Text', shortcut: 'T' },
];

const ROADMAP = [
  'Command pattern + immutable patch tabanlı history katmanı',
  'Selection box, resize handles ve rotation handles',
  'Canvas üstünde HTML text edit overlay',
  'Shape registry, serializer ve plugin lifecycle',
  'Yjs/CRDT ile gerçek zamanlı collaboration adaptörü',
  'IndexedDB/local snapshot persistence',
  'Spatial index ve dirty rectangle performans optimizasyonları',
];

const DEFAULT_STATE = {
  shapes: [
    {
      id: 'seed-rect',
      type: 'rectangle',
      x: 96,
      y: 96,
      width: 220,
      height: 120,
      stroke: '#111827',
      fill: 'rgba(59, 130, 246, 0.12)',
      strokeWidth: 2,
      opacity: 1,
    },
    {
      id: 'seed-text',
      type: 'text',
      x: 120,
      y: 158,
      text: 'Whiteboard starter\nçizmeye hazır.',
      fontSize: 24,
      fontFamily: 'Inter, Arial, sans-serif',
      stroke: '#111827',
      opacity: 1,
    },
  ],
  selectedIds: [],
  activeTool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  hoveredShapeId: null,
  drawingShapeId: null,
  isDraggingSelection: false,
  isPanning: false,
  stroke: '#111827',
  fill: 'transparent',
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

function getTextMetrics(shape) {
  const lines = shape.text.split('\n');
  const fontSize = shape.fontSize || 20;
  return {
    lines,
    width: Math.max(40, Math.max(...lines.map((line) => line.length)) * fontSize * 0.6),
    height: lines.length * fontSize * 1.2,
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
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function isPointInsideShape(point, shape) {
  if (shape.type === 'rectangle' || shape.type === 'ellipse') {
    return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height;
  }

  if (shape.type === 'text') {
    const metrics = getTextMetrics(shape);
    return point.x >= shape.x && point.x <= shape.x + metrics.width && point.y >= shape.y - (shape.fontSize || 20) && point.y <= shape.y + metrics.height;
  }

  if (shape.type === 'line' || shape.type === 'freehand') {
    for (let i = 0; i < shape.points.length - 1; i += 1) {
      const a = { x: shape.x + shape.points[i].x, y: shape.y + shape.points[i].y };
      const b = { x: shape.x + shape.points[i + 1].x, y: shape.y + shape.points[i + 1].y };
      if (pointToSegmentDistance(point, a, b) <= 6) return true;
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

  commitHistory(reason) {
    this.bus.emit('history:commit', { reason });
  }

  resetScene() {
    this.state = clone(DEFAULT_STATE);
    this.notify();
    this.bus.emit('history:commit', { reason: 'reset scene' });
  }
}

function renderShape(ctx, shape, isSelected) {
  ctx.save();
  ctx.globalAlpha = shape.opacity ?? 1;
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.strokeStyle = shape.stroke || '#111827';
  ctx.fillStyle = shape.fill || 'transparent';

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
      ctx.fillStyle = shape.stroke || '#111827';
      ctx.font = `${fontSize}px ${shape.fontFamily || 'Inter, Arial, sans-serif'}`;
      shape.text.split('\n').forEach((line, index) => ctx.fillText(line, shape.x, shape.y + index * fontSize * 1.2));
      break;
    }
  }

  if (isSelected) {
    const bounds = getShapeBounds(shape);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
  }

  ctx.restore();
}

function drawGrid(ctx, width, height, viewport) {
  const gridSize = 40 * viewport.zoom;
  if (gridSize < 12) return;
  const offsetX = viewport.x % gridSize;
  const offsetY = viewport.y % gridSize;

  ctx.save();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;

  for (let x = offsetX; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = offsetY; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

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
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, rect.width, rect.height);
  drawGrid(ctx, rect.width, rect.height, state.viewport);

  ctx.save();
  ctx.translate(state.viewport.x, state.viewport.y);
  ctx.scale(state.viewport.zoom, state.viewport.zoom);
  [...state.shapes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach((shape) => {
    renderShape(ctx, shape, state.selectedIds.includes(shape.id));
  });
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
    const state = ctx.getState();
    const common = {
      id: createId(),
      x: payload.world.x,
      y: payload.world.y,
      stroke: state.stroke,
      fill: type === 'line' || type === 'freehand' ? undefined : state.fill,
      strokeWidth: 2,
      opacity: 1,
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

  const completeShape = (ctx, reason) => {
    drawStart = null;
    currentShapeId = null;
    ctx.store.setState((prev) => ({ ...prev, drawingShapeId: null }));
    ctx.store.commitHistory(reason);
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
          ctx.store.commitHistory('move selection');
        }
        dragStartWorld = null;
        initialSelectionSnapshot = [];
      },
      onKeyDown(payload, ctx) {
        const state = ctx.getState();
        if ((payload.key === 'Delete' || payload.key === 'Backspace') && state.selectedIds.length) {
          [...state.selectedIds].forEach((id) => ctx.store.deleteShape(id));
          ctx.store.setSelection([]);
          ctx.store.commitHistory('delete shapes');
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
      onPointerUp: (_payload, ctx) => completeShape(ctx, 'draw rectangle'),
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
      onPointerUp: (_payload, ctx) => completeShape(ctx, 'draw ellipse'),
    },
    line: {
      onPointerDown: (payload, ctx) => createShape(payload, ctx, 'line'),
      onPointerMove(payload, ctx) {
        if (!drawStart || !currentShapeId) return;
        ctx.store.updateShape(currentShapeId, {
          points: [
            { x: 0, y: 0 },
            { x: payload.world.x - drawStart.x, y: payload.world.y - drawStart.y },
          ],
        });
      },
      onPointerUp: (_payload, ctx) => completeShape(ctx, 'draw line'),
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
      onPointerUp: (_payload, ctx) => completeShape(ctx, 'draw freehand'),
    },
    text: {
      onPointerDown(payload, ctx) {
        const text = window.prompt('Metin girin', 'Yeni not');
        if (!text) return;
        const state = ctx.getState();
        const shape = {
          id: createId(),
          type: 'text',
          x: payload.world.x,
          y: payload.world.y,
          text,
          fontSize: 24,
          fontFamily: 'Inter, Arial, sans-serif',
          stroke: state.stroke,
          opacity: 1,
        };
        ctx.store.addShape(shape);
        ctx.store.setSelection([shape.id]);
        ctx.store.commitHistory('create text');
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

function createUI(root, store, bus, canvas) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">Canvas Product Starter</div>
          <h1>Excalidraw-benzeri whiteboard için başlangıç workspace’i</h1>
        </div>
        <p>Pan, zoom, shape creation, selection, event log ve product roadmap aynı ekranda.</p>
      </header>
      <main class="workspace-layout">
        <section class="board-area">
          <div class="toolbar"></div>
          <div class="panel console">
            <div class="panel-title">Event Console</div>
            <div class="console-list" data-console-list><div>Henüz event yok.</div></div>
          </div>
          <div class="status-bar" data-status></div>
        </section>
        <aside class="panel sidebar">
          <div class="panel-title">Product Direction</div>
          <p class="panel-copy">Bu ekran, Excalidraw-benzeri ürün için mimari başlangıç ve deney alanı olarak hazırlandı.</p>
          <div class="palette-row">
            <label>Stroke <input data-stroke-picker type="color" /></label>
            <label>Fill <input data-fill-picker type="color" /></label>
            <button class="ghost-button" data-no-fill>No fill</button>
          </div>
          <div class="action-row">
            <button class="ghost-button" data-reset-scene>Reset scene</button>
            <button class="ghost-button danger" data-delete-selected>Delete selected</button>
          </div>
          <div class="panel-title small">Next milestones</div>
          <ul class="roadmap">${ROADMAP.map((item) => `<li>${item}</li>`).join('')}</ul>
        </aside>
      </main>
    </div>
  `;

  const boardArea = root.querySelector('.board-area');
  boardArea.appendChild(canvas);
  canvas.className = 'board-canvas';

  const toolbar = root.querySelector('.toolbar');
  const status = root.querySelector('[data-status]');
  const consoleList = root.querySelector('[data-console-list]');
  const strokePicker = root.querySelector('[data-stroke-picker]');
  const fillPicker = root.querySelector('[data-fill-picker]');
  const noFillButton = root.querySelector('[data-no-fill]');
  const resetButton = root.querySelector('[data-reset-scene]');
  const deleteButton = root.querySelector('[data-delete-selected]');

  let logs = [];

  const renderToolbar = (state) => {
    toolbar.innerHTML = TOOLBAR.map((tool) => `
      <button class="tool-button ${state.activeTool === tool.key ? 'active' : ''}" data-tool="${tool.key}">
        ${tool.label}<span>${tool.shortcut}</span>
      </button>
    `).join('');
  };

  const renderStatus = (state) => {
    status.innerHTML = `
      <div><strong>Tool</strong> ${state.activeTool}</div>
      <div><strong>Zoom</strong> %${Math.round(state.viewport.zoom * 100)}</div>
      <div><strong>Shapes</strong> ${state.shapes.length}</div>
      <div><strong>Selected</strong> ${state.selectedIds.length}</div>
    `;
    strokePicker.value = state.stroke;
    fillPicker.value = state.fill === 'transparent' ? '#ffffff' : state.fill;
  };

  const renderConsole = () => {
    consoleList.innerHTML = logs.length ? logs.map((line) => `<div>${line}</div>`).join('') : '<div>Henüz event yok.</div>';
  };

  const pushLog = (message) => {
    logs = [message, ...logs].slice(0, 8);
    renderConsole();
  };

  root.addEventListener('click', (event) => {
    const tool = event.target.closest('[data-tool]')?.dataset.tool;
    if (tool) store.setTool(tool);
  });

  strokePicker.addEventListener('input', (event) => store.setState({ stroke: event.target.value }));
  fillPicker.addEventListener('input', (event) => store.setState({ fill: event.target.value }));
  noFillButton.addEventListener('click', () => store.setState({ fill: 'transparent' }));
  resetButton.addEventListener('click', () => store.resetScene());
  deleteButton.addEventListener('click', () => {
    const { selectedIds } = store.getState();
    [...selectedIds].forEach((id) => store.deleteShape(id));
    store.setSelection([]);
  });

  bus.on('tool:changed', ({ tool }) => pushLog(`tool:changed → ${tool}`));
  bus.on('shape:created', ({ shape }) => pushLog(`shape:created → ${shape.type}:${shape.id}`));
  bus.on('shape:updated', ({ shape }) => pushLog(`shape:updated → ${shape.type}:${shape.id}`));
  bus.on('selection:changed', ({ ids }) => pushLog(`selection:changed → [${ids.join(', ')}]`));
  bus.on('history:commit', ({ reason }) => pushLog(`history:commit → ${reason}`));

  store.subscribe((state) => {
    renderToolbar(state);
    renderStatus(state);
  });

  renderToolbar(store.getState());
  renderStatus(store.getState());
  renderConsole();
}

function attachInteractions(canvas, store, tools) {
  const handlePointer = (kind, event) => {
    const payload = createPointerPayload(canvas, event, store.getState().viewport);
    const ctx = { store, getState: () => store.getState() };
    const tool = tools[store.getState().activeTool];

    if (kind === 'down') {
      store.bus.emit('pointer:down', payload);
      tool.onPointerDown?.(payload, ctx);
    }
    if (kind === 'move') {
      store.bus.emit('pointer:move', payload);
      tool.onPointerMove?.(payload, ctx);
    }
    if (kind === 'up') {
      store.bus.emit('pointer:up', payload);
      tool.onPointerUp?.(payload, ctx);
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    handlePointer('down', event);
  });
  canvas.addEventListener('pointermove', (event) => handlePointer('move', event));
  canvas.addEventListener('pointerup', (event) => handlePointer('up', event));

  canvas.addEventListener('wheel', (event) => {
    const rect = canvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    store.bus.emit('wheel', { nativeEvent: event, screen, deltaX: event.deltaX, deltaY: event.deltaY, ctrlKey: event.ctrlKey, metaKey: event.metaKey });

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
    const payload = {
      nativeEvent: event,
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    };
    store.bus.emit('keyboard:down', payload);
    tools[store.getState().activeTool].onKeyDown?.(payload, { store, getState: () => store.getState() });
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
}

function bootstrap() {
  const root = document.getElementById('app');
  const canvas = document.createElement('canvas');
  const bus = new EventBus();
  const store = new WhiteboardStore({}, bus);
  const tools = createTools();

  createUI(root, store, bus, canvas);
  attachInteractions(canvas, store, tools);

  const render = () => renderScene(canvas, store.getState());
  store.subscribe(render);
  window.addEventListener('resize', render);
  render();
}

bootstrap();
