import type { ICanvasAPI, PointerPayload, ToolDefinition, ShapeType, Shape } from '../core/types';
import { STYLE_PRESETS } from '../core/constants';
import { createId } from '../core/Utils';
import { getTopShapeAtPoint } from '../core/Geometry';

export class ShapeTool implements ToolDefinition {
  private drawStartWorld: { x: number; y: number } | null = null;
  private currentShapeId: string | null = null;
  private type: ShapeType;

  constructor(type: ShapeType) {
    this.type = type;
  }

  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    this.drawStartWorld = payload.world;
    const preset = STYLE_PRESETS[this.type];
    let startBinding;
    if (this.type === 'arrow' || this.type === 'line') {
      const state = api.getState();
      const hitShape = getTopShapeAtPoint(
        state.shapes.filter(s => s.type !== 'arrow' && s.type !== 'line' && s.type !== 'freehand'),
        payload.world
      );
      if (hitShape) startBinding = { elementId: hitShape.id };
    }

    const common: Partial<Shape> = {
      id: createId(),
      x: payload.world.x,
      y: payload.world.y,
      stroke: preset?.stroke,
      fill: preset?.fill,
      strokeWidth: preset?.strokeWidth,
      opacity: preset?.opacity,
      startBinding
    };

    let shape: Shape;
    if (this.type === 'rectangle' || this.type === 'ellipse') {
      shape = { ...common, type: this.type, width: 1, height: 1 } as Shape;
    } else if (this.type === 'line' || this.type === 'arrow') {
      shape = { ...common, type: this.type, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } as Shape;
    } else {
      shape = { ...common, type: 'freehand', points: [{ x: 0, y: 0 }] } as Shape;
    }

    this.currentShapeId = shape.id;
    api.addShape(shape);
    api.setSelection([shape.id]);
    api.setState({ drawingShapeId: shape.id });
  }

  onPointerMove(payload: PointerPayload, api: ICanvasAPI) {
    if (this.type === 'arrow' || this.type === 'line') {
      const state = api.getState();
      const hitShape = getTopShapeAtPoint(
        state.shapes.filter(s => s.type !== 'arrow' && s.type !== 'line' && s.type !== 'freehand'),
        payload.world
      );
      if (hitShape?.id !== state.hoveredShapeId) {
        api.setState({ hoveredShapeId: hitShape?.id || null });
      }
    }

    if (!this.drawStartWorld || !this.currentShapeId) return;

    if (this.type === 'rectangle' || this.type === 'ellipse') {
      api.updateShape(this.currentShapeId, {
        x: Math.min(this.drawStartWorld.x, payload.world.x),
        y: Math.min(this.drawStartWorld.y, payload.world.y),
        width: Math.abs(payload.world.x - this.drawStartWorld.x),
        height: Math.abs(payload.world.y - this.drawStartWorld.y),
      });
    } else if (this.type === 'line' || this.type === 'arrow') {
      api.updateShape(this.currentShapeId, {
        points: [{ x: 0, y: 0 }, { x: payload.world.x - this.drawStartWorld.x, y: payload.world.y - this.drawStartWorld.y }],
      });
    } else if (this.type === 'freehand') {
      const state = api.getState();
      const shape = state.shapes.find(s => s.id === this.currentShapeId);
      if (shape && shape.points) {
        api.replaceShape(this.currentShapeId, {
          ...shape,
          points: [...shape.points, { x: payload.world.x - this.drawStartWorld.x, y: payload.world.y - this.drawStartWorld.y }],
        });
      }
    }
  }

  onPointerUp(payload: PointerPayload, api: ICanvasAPI) {
    if (this.currentShapeId && this.drawStartWorld) {
      if (this.type === 'arrow' || this.type === 'line') {
        const state = api.getState();
        const hitShape = getTopShapeAtPoint(
          state.shapes.filter(s => s.type !== 'arrow' && s.type !== 'line' && s.type !== 'freehand'),
          payload.world
        );
        if (hitShape) {
          api.updateShape(this.currentShapeId, { endBinding: { elementId: hitShape.id } });
        }
      }

      const dx = payload.world.x - this.drawStartWorld.x;
      const dy = payload.world.y - this.drawStartWorld.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (this.type !== 'freehand' && distance < 2) {
        api.deleteShape(this.currentShapeId);
        api.setSelection([]);
      } else {
        api.commitState();
      }
    }
    this.drawStartWorld = null;
    this.currentShapeId = null;
    api.setState({ drawingShapeId: null });
  }
}
