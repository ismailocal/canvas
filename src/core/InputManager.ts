import type { CanvasState, ICanvasAPI, PointerPayload, ToolDefinition } from './types';
import { screenToWorld } from './Geometry';
import { clamp } from './Utils';

export function createPointerPayload(canvas: HTMLCanvasElement, event: PointerEvent, state: CanvasState): PointerPayload {
  const rect = canvas.getBoundingClientRect();
  const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  let world = screenToWorld(screen, state.viewport);
  
  if (state.showGrid && state.gridSize) {
    world.x = Math.round(world.x / state.gridSize) * state.gridSize;
    world.y = Math.round(world.y / state.gridSize) * state.gridSize;
  }

  return {
    nativeEvent: event,
    screen,
    world,
    button: event.button,
    pointerId: event.pointerId,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  };
}

export class InputManager {
  private activeOverrideTool: string | null = null;
  private tools: Record<string, ToolDefinition>;
  private api: ICanvasAPI;
  private canvas: HTMLCanvasElement;
  private disposeHandlers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, api: ICanvasAPI, tools: Record<string, ToolDefinition>) {
    this.canvas = canvas;
    this.api = api;
    this.tools = tools;
    this.attach();
  }

  private getActiveTool() {
    return this.activeOverrideTool || this.api.getState().activeTool;
  }

  private handlePointer(kind: 'down' | 'move' | 'up', event: PointerEvent) {
    const state = this.api.getState();
    const payload = createPointerPayload(this.canvas, event, state);
    const toolName = this.getActiveTool();
    const tool = this.tools[toolName];
    if (!tool) return;

    if (kind === 'down' && tool.onPointerDown) tool.onPointerDown(payload, this.api);
    if (kind === 'move' && tool.onPointerMove) tool.onPointerMove(payload, this.api);
    if (kind === 'up' && tool.onPointerUp) tool.onPointerUp(payload, this.api);
  }

  private attach() {
    const onDown = (e: PointerEvent) => {
      if (e.button === 1) this.activeOverrideTool = 'hand';
      this.canvas.setPointerCapture(e.pointerId);
      this.handlePointer('down', e);
    };
    const onMove = (e: PointerEvent) => this.handlePointer('move', e);
    const onUp = (e: PointerEvent) => {
      this.handlePointer('up', e);
      this.activeOverrideTool = null;
    };
    const onWheel = (e: WheelEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const state = this.api.getState();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const worldBeforeZoom = screenToWorld(screen, state.viewport);
        const nextZoom = clamp(state.viewport.zoom * (e.deltaY > 0 ? 0.95 : 1.05), 0.2, 4);
        this.api.setViewport({
          zoom: nextZoom,
          x: screen.x - worldBeforeZoom.x * nextZoom,
          y: screen.y - worldBeforeZoom.y * nextZoom,
        });
        return;
      }
      this.api.setViewport({
        ...state.viewport,
        x: state.viewport.x - e.deltaX,
        y: state.viewport.y - e.deltaY,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const active = this.api.getState().activeTool;
      if (e.code === 'Space' && !this.api.getState().isSpacePanning) {
        this.api.setState({ isSpacePanning: true });
        this.activeOverrideTool = 'hand';
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.api.redo();
          } else {
            this.api.undo();
          }
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          this.api.redo();
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && active === 'select') {
        const tool = this.tools.select;
        if (tool?.onKeyDown) tool.onKeyDown(e, this.api);
      }

      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
      
      if (!isInputFocused && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'v') this.api.setTool('select');
        if (e.key === 'h') this.api.setTool('hand');
        if (e.key === 'r') this.api.setTool('rectangle');
        if (e.key === 'e') this.api.setTool('ellipse');
        if (e.key === 'l') this.api.setTool('line');
        if (e.key === 'a') this.api.setTool('arrow');
        if (e.key === 'p') this.api.setTool('freehand');
        if (e.key === 'x') this.api.setTool('eraser');
        if (e.key === 't') this.api.setTool('text');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.api.setState({ isSpacePanning: false, isPanning: false });
        this.activeOverrideTool = null;
      }
    };

    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.disposeHandlers = [
      () => this.canvas.removeEventListener('pointerdown', onDown),
      () => this.canvas.removeEventListener('pointermove', onMove),
      () => this.canvas.removeEventListener('pointerup', onUp),
      () => this.canvas.removeEventListener('wheel', onWheel),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
    ];
  }

  destroy() {
    this.disposeHandlers.forEach(fn => fn());
    this.disposeHandlers = [];
  }
}
