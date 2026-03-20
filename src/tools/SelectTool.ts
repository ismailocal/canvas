import type { ICanvasAPI, PointerPayload, ToolDefinition, Shape } from '../core/types';
import { getTopShapeAtPoint, getHandleAtPoint, getShapeBounds } from '../core/Geometry';
import type { HandleType } from '../core/Geometry';
import { updateBoundArrows } from '../core/Utils';

export class SelectTool implements ToolDefinition {
  private dragStartWorld: { x: number; y: number } | null = null;
  private initialSnapshot: Shape[] = [];
  private activeHandle: HandleType | null = null;
  private activeShapeId: string | null = null;
  private isBoxSelecting = false;

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const hit = getTopShapeAtPoint(state.shapes, payload.world);
    
    // Check if dragging a handle of an already selected shape
    if (state.selectedIds.length === 1) {
      const selectedObj = state.shapes.find((s) => s.id === state.selectedIds[0]);
      if (selectedObj) {
        const handle = getHandleAtPoint(selectedObj, payload.world, state.shapes);
        if (handle) {
          this.activeHandle = handle;
          this.activeShapeId = selectedObj.id;
          this.dragStartWorld = payload.world;
          this.initialSnapshot = [{ ...selectedObj }];
          api.setState({ isDraggingSelection: true });
          return;
        }
      }
    }

    if (hit) {
      let ids = state.selectedIds;
      if (payload.shiftKey) {
        if (ids.includes(hit.id)) {
          ids = ids.filter(id => id !== hit.id);
        } else {
          ids = [...ids, hit.id];
        }
      } else {
        ids = ids.includes(hit.id) ? ids : [hit.id];
      }
      
      api.setSelection(ids);
      this.dragStartWorld = payload.world;
      this.initialSnapshot = state.shapes.filter(s => ids.includes(s.id)).map(s => ({ ...s }));
      api.setState({ isDraggingSelection: true });
    } else {
      if (!payload.shiftKey) {
        api.setSelection([]);
      }
      this.isBoxSelecting = true;
      this.dragStartWorld = payload.world;
      api.setState({ selectionBox: { x: payload.world.x, y: payload.world.y, width: 0, height: 0 } });
    }
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    const state = api.getState();
    const hovered = getTopShapeAtPoint(state.shapes, payload.world);
    const hoveredId = hovered?.id || null;
    if (hoveredId !== state.hoveredShapeId) {
      api.setState({ hoveredShapeId: hoveredId });
    }

    if (this.isBoxSelecting && this.dragStartWorld) {
      const box = {
        x: Math.min(this.dragStartWorld.x, payload.world.x),
        y: Math.min(this.dragStartWorld.y, payload.world.y),
        width: Math.abs(payload.world.x - this.dragStartWorld.x),
        height: Math.abs(payload.world.y - this.dragStartWorld.y)
      };
      api.setState({ selectionBox: box });

      const hitIds = state.shapes.filter(s => {
        const sb = getShapeBounds(s);
        return !(sb.x > box.x + box.width || sb.x + sb.width < box.x || sb.y > box.y + box.height || sb.y + sb.height < box.y);
      }).map(s => s.id);

      api.setSelection(hitIds);
      return;
    }

    if (!state.isDraggingSelection || !this.dragStartWorld) return;
    const dx = payload.world.x - this.dragStartWorld.x;
    const dy = payload.world.y - this.dragStartWorld.y;

    if (this.activeHandle && this.activeShapeId) {
      const shape = this.initialSnapshot[0];
      if (!shape) return;
      
      const patch: Partial<Shape> = {};
      
      if (shape.type === 'rectangle' || shape.type === 'ellipse') {
        let { x, y } = shape;
        let w = shape.width || 0;
        let h = shape.height || 0;

        if (this.activeHandle.includes('n')) { y += dy; h -= dy; }
        if (this.activeHandle.includes('s')) { h += dy; }
        if (this.activeHandle.includes('w')) { x += dx; w -= dx; }
        if (this.activeHandle.includes('e')) { w += dx; }
        
        // Prevent negative dimensions while staying visually correct
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }

        Object.assign(patch, { x, y, width: w, height: h });
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        const p2 = { x: shape.x + shape.points![1].x, y: shape.y + shape.points![1].y };
        if (this.activeHandle === 'start') {
          Object.assign(patch, { x: payload.world.x, y: payload.world.y, points: [{x:0,y:0}, {x: p2.x - payload.world.x, y: p2.y - payload.world.y}], startBinding: null });
        } else if (this.activeHandle === 'end') {
          Object.assign(patch, { points: [{x:0,y:0}, {x: payload.world.x - shape.x, y: payload.world.y - shape.y}], endBinding: null });
        }
      }

      api.updateShape(this.activeShapeId, patch);
      updateBoundArrows(api.getState(), api, [this.activeShapeId]);
      return;
    }

    this.initialSnapshot.forEach(shape => {
      api.updateShape(shape.id, { x: shape.x + dx, y: shape.y + dy });
    });

    updateBoundArrows(api.getState(), api, this.initialSnapshot.map(s => s.id));
  }

  onPointerUp(_payload: PointerPayload, api: ICanvasAPI) {
    if (this.isBoxSelecting) {
      api.setState({ selectionBox: null });
      this.isBoxSelecting = false;
    }

    if (api.getState().isDraggingSelection) {
      api.setState({ isDraggingSelection: false });
      if (this.dragStartWorld) {
        api.commitState();
      }
    }
    this.dragStartWorld = null;
    this.initialSnapshot = [];
    this.activeHandle = null;
    this.activeShapeId = null;
  }

  onKeyDown(event: KeyboardEvent, api: ICanvasAPI) {
    const state = api.getState();
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedIds.length) {
      [...state.selectedIds].forEach((id) => api.deleteShape(id));
      api.setSelection([]);
      api.commitState();
    }
  }
}
