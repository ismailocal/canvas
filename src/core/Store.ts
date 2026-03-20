import { EventBus } from './EventBus';
import type { CanvasState, Shape, ICanvasAPI } from './types';

export const DEFAULT_STATE: CanvasState = {
  shapes: [],
  selectedIds: [],
  activeTool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  hoveredShapeId: null,
  drawingShapeId: null,
  isDraggingSelection: false,
  isPanning: false,
  isSpacePanning: false,
  showGrid: false,
  gridSize: 20,
};

export const clone = <T>(value: T): T => structuredClone(value);

export class WhiteboardStore {
  public bus: EventBus;
  private subscribers = new Set<(state: CanvasState) => void>();
  private state: CanvasState;
  
  private history: Shape[][] = [];
  private historyIndex: number = -1;

  constructor(initialState: Partial<CanvasState> = {}, bus = new EventBus()) {
    this.bus = bus;
    this.state = { ...clone(DEFAULT_STATE), ...initialState };
    this.commitState();
  }

  getState() {
    return this.state;
  }

  commitState() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const snapshot = clone(this.state.shapes);
    this.history.push(snapshot);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = { ...this.state, shapes: clone(this.history[this.historyIndex]), selectedIds: [] };
      this.notify();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = { ...this.state, shapes: clone(this.history[this.historyIndex]), selectedIds: [] };
      this.notify();
    }
  }

  reorderShape(shapeId: string, direction: 'forward' | 'backward' | 'front' | 'back') {
    const shape = this.state.shapes.find(s => s.id === shapeId);
    if (!shape) return;
    
    const shapes = [...this.state.shapes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const index = shapes.findIndex(s => s.id === shapeId);
    if (index === -1) return;

    if (direction === 'forward' && index < shapes.length - 1) {
      shapes[index] = shapes[index + 1];
      shapes[index + 1] = shape;
    } else if (direction === 'backward' && index > 0) {
      shapes[index] = shapes[index - 1];
      shapes[index - 1] = shape;
    } else if (direction === 'front') {
      shapes.splice(index, 1);
      shapes.push(shape);
    } else if (direction === 'back') {
      shapes.splice(index, 1);
      shapes.unshift(shape);
    }

    // Reassign sequential zIndex to enforce order
    const updated = shapes.map((s, i) => ({ ...s, zIndex: i }));
    this.state = { ...this.state, shapes: updated };
    this.notify();
  }

  subscribe(listener: (state: CanvasState) => void) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    this.subscribers.forEach((listener) => listener(this.state));
    this.bus.emit('document:changed', { state: this.state });
  }

  setState(updater: Partial<CanvasState> | ((state: CanvasState) => CanvasState)) {
    this.state = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    this.notify();
  }

  setTool(tool: string) {
    this.state = { ...this.state, activeTool: tool };
    this.notify();
    this.bus.emit('tool:changed', { tool });
  }

  setViewport(viewport: CanvasState['viewport']) {
    this.state = { ...this.state, viewport };
    this.notify();
    this.bus.emit('viewport:changed', { viewport });
  }

  addShape(shape: Shape) {
    const maxZ = this.state.shapes.reduce((max, s) => Math.max(max, s.zIndex || 0), -1);
    const newShape = { ...shape, zIndex: maxZ + 1 };
    this.state = { ...this.state, shapes: [...this.state.shapes, newShape] };
    this.notify();
    this.bus.emit('shape:created', { shape: newShape });
  }

  updateShape(shapeId: string, patch: Partial<Shape>) {
    let updatedShape: Shape | null = null;
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

  replaceShape(shapeId: string, nextShape: Shape) {
    this.state = {
      ...this.state,
      shapes: this.state.shapes.map((shape) => (shape.id === shapeId ? nextShape : shape)),
    };
    this.notify();
    this.bus.emit('shape:updated', { shape: nextShape });
  }

  deleteShape(shapeId: string) {
    this.state = {
      ...this.state,
      shapes: this.state.shapes.filter((shape) => shape.id !== shapeId),
      selectedIds: this.state.selectedIds.filter((id) => id !== shapeId),
    };
    this.notify();
    this.bus.emit('shape:deleted', { shapeId });
  }

  setSelection(ids: string[]) {
    this.state = { ...this.state, selectedIds: ids };
    this.notify();
    this.bus.emit('selection:changed', { ids });
  }

  createAPI(): ICanvasAPI {
    return {
      getState: () => this.getState(),
      setState: (updater) => this.setState(updater),
      addShape: (shape) => this.addShape(shape),
      updateShape: (id, patch) => this.updateShape(id, patch),
      replaceShape: (id, shape) => this.replaceShape(id, shape),
      deleteShape: (id) => this.deleteShape(id),
      setSelection: (ids) => this.setSelection(ids),
      setViewport: (viewport) => this.setViewport(viewport),
      setTool: (tool) => this.setTool(tool),
      reorderShape: (id, direction) => { 
        this.reorderShape(id, direction); 
        this.commitState(); 
      },
      commitState: () => this.commitState(),
      undo: () => this.undo(),
      redo: () => this.redo(),
    };
  }
}
