import type { Shape, CanvasState, ICanvasAPI } from './types';

export const createId = () => Math.random().toString(36).slice(2, 10);

export function hexToRgba(hex: string, alpha = 1): string {
  const safe = hex.replace('#', '');
  const [r, g, b] = safe.length === 3
    ? safe.split('').map((item) => parseInt(item + item, 16))
    : [safe.slice(0, 2), safe.slice(2, 4), safe.slice(4, 6)].map((item) => parseInt(item, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function rgbaToHex(color?: string): string {
  if (!color || color === 'transparent') return '#ffffff';
  if (color.startsWith('#')) return color;
  const values = color.match(/\d+/g);
  if (!values || values.length < 3) return '#ffffff';
  return `#${values.slice(0, 3).map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getOpacityFromColor(color?: string): number {
  if (!color || color === 'transparent') return 0;
  const values = color.match(/[\d.]+/g);
  if (!values || values.length < 4) return 1;
  return clamp(Number(values[3]), 0, 1);
}

export function getTextMetrics(shape: Shape) {
  const lines = (shape.text || '').split('\n');
  const fontSize = shape.fontSize || 20;
  return {
    lines,
    width: Math.max(40, Math.max(...lines.map((line) => line.length || 1)) * fontSize * 0.62),
    height: Math.max(fontSize, lines.length * fontSize * 1.25),
  };
}

export function updateBoundArrows(state: CanvasState, api: ICanvasAPI, movingShapeIds: string[]) {
  state.shapes.forEach((arrow) => {
    if (arrow.type === 'arrow' || arrow.type === 'line') {
      const startId = arrow.startBinding?.elementId;
      const endId = arrow.endBinding?.elementId;
      if (!startId && !endId) return;

      if ((startId && movingShapeIds.includes(startId)) || (endId && movingShapeIds.includes(endId))) {
        let p1 = { x: arrow.x, y: arrow.y };
        let p2 = { x: arrow.x + (arrow.points?.[1]?.x || 0), y: arrow.y + (arrow.points?.[1]?.y || 0) };

        if (startId) {
          const sShape = state.shapes.find(s => s.id === startId);
          if (sShape) p1 = { x: sShape.x + (sShape.width||0)/2, y: sShape.y + (sShape.height||0)/2 };
        }
        if (endId) {
          const eShape = state.shapes.find(s => s.id === endId);
          if (eShape) p2 = { x: eShape.x + (eShape.width||0)/2, y: eShape.y + (eShape.height||0)/2 };
        }

        api.updateShape(arrow.id, {
          x: p1.x, y: p1.y,
          points: [{x:0, y:0}, { x: p2.x - p1.x, y: p2.y - p1.y }]
        });
      }
    }
  });
}
