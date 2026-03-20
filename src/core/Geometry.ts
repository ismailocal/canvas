import type { Point, Shape, CanvasState } from './types';
import { clamp, getTextMetrics } from './Utils';

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const screenToWorld = (screen: Point, viewport: CanvasState['viewport']): Point => ({
  x: (screen.x - viewport.x) / viewport.zoom,
  y: (screen.y - viewport.y) / viewport.zoom,
});

export function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
  const clampedT = clamp(t, 0, 1);
  return distance(point, { x: a.x + clampedT * dx, y: a.y + clampedT * dy });
}

export function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const num = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
  const den = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (den === 0) return null;
  const uA = num / den;
  const numB = (p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x);
  const uB = numB / den;
  
  if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
    return { x: p1.x + uA * (p2.x - p1.x), y: p1.y + uA * (p2.y - p1.y) };
  }
  return null;
}

export function getRayBoxIntersection(p1: Point, p2: Point, rect: { x: number, y: number, w: number, h: number }): Point {
  const tl = { x: rect.x, y: rect.y };
  const tr = { x: rect.x + rect.w, y: rect.y };
  const bl = { x: rect.x, y: rect.y + rect.h };
  const br = { x: rect.x + rect.w, y: rect.y + rect.h };
  
  const pts = [
    lineIntersection(p1, p2, tl, tr),
    lineIntersection(p1, p2, tr, br),
    lineIntersection(p1, p2, br, bl),
    lineIntersection(p1, p2, bl, tl)
  ].filter((p): p is Point => p !== null);

  if (pts.length === 0) return p2; // Fallback
  
  let closest = pts[0];
  let minD = distance(closest, p1);
  for(let i=1; i<pts.length; i++) {
    const d = distance(pts[i], p1);
    if (d < minD) {
      minD = d;
      closest = pts[i];
    }
  }
  return closest;
}

export function getRayEllipseIntersection(p1: Point, p2: Point, cx: number, cy: number, rx: number, ry: number): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) return p2;

  const x1 = p1.x - cx;
  const y1 = p1.y - cy;
  
  const a = (dx*dx) / (rx*rx) + (dy*dy) / (ry*ry);
  const b = 2 * ((x1*dx) / (rx*rx) + (y1*dy) / (ry*ry));
  const c = (x1*x1) / (rx*rx) + (y1*y1) / (ry*ry) - 1;
  const det = b*b - 4*a*c;
  if (det < 0) return p2;
  
  const t1 = (-b + Math.sqrt(det)) / (2*a);
  const t2 = (-b - Math.sqrt(det)) / (2*a);
  
  const validT = [t1, t2].filter(t => t >= 0 && t <= 1);
  if (validT.length === 0) return p2;
  
  const t = Math.min(...validT); // Closest to p1 (where finding clipping boundary)
  return { x: p1.x + t * dx, y: p1.y + t * dy };
}

export function getArrowClippedEndpoints(shape: Shape, allShapes: Shape[]): { p1: Point, p2: Point } {
  let p1 = { x: shape.x + (shape.points?.[0]?.x || 0), y: shape.y + (shape.points?.[0]?.y || 0) };
  let p2 = { x: shape.x + (shape.points?.[shape.points!.length - 1]?.x || 0), y: shape.y + (shape.points?.[shape.points!.length - 1]?.y || 0) };

  if (shape.startBinding) {
    const bShape = allShapes.find(s => s.id === shape.startBinding!.elementId);
    if (bShape) {
      if (bShape.type === 'ellipse') {
        p1 = getRayEllipseIntersection(p1, p2, bShape.x + Math.abs(bShape.width||0)/2, bShape.y + Math.abs(bShape.height||0)/2, Math.abs(bShape.width||0)/2 + 4, Math.abs(bShape.height||0)/2 + 4);
      } else {
        p1 = getRayBoxIntersection(p1, p2, { x: bShape.x - 4, y: bShape.y - 4, w: Math.abs(bShape.width||0) + 8, h: Math.abs(bShape.height||0) + 8 });
      }
    }
  }

  if (shape.endBinding) {
    const bShape = allShapes.find(s => s.id === shape.endBinding!.elementId);
    if (bShape) {
      if (bShape.type === 'ellipse') {
        p2 = getRayEllipseIntersection(p2, p1, bShape.x + Math.abs(bShape.width||0)/2, bShape.y + Math.abs(bShape.height||0)/2, Math.abs(bShape.width||0)/2 + 4, Math.abs(bShape.height||0)/2 + 4);
      } else {
        p2 = getRayBoxIntersection(p2, p1, { x: bShape.x - 4, y: bShape.y - 4, w: Math.abs(bShape.width||0) + 8, h: Math.abs(bShape.height||0) + 8 });
      }
    }
  }

  return { p1, p2 };
}

export function getShapeBounds(shape: Shape) {
  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
      return { x: shape.x, y: shape.y, width: shape.width || 0, height: shape.height || 0 };
    case 'text': {
      const metrics = getTextMetrics(shape);
      return { x: shape.x, y: shape.y - (shape.fontSize || 20), width: metrics.width, height: metrics.height };
    }
    case 'line':
    case 'arrow':
    case 'freehand': {
      const pts = shape.points || [];
      const absolute = pts.map((point) => ({ x: point.x + shape.x, y: point.y + shape.y }));
      if (absolute.length === 0) return { x: shape.x, y: shape.y, width: 0, height: 0 };
      
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

export function isPointInsideShape(point: Point, shape: Shape): boolean {
  if (shape.text) {
    const fontSize = shape.fontSize || 20;
    const lines = shape.text.split('\n');
    let cx = shape.x;
    let cy = shape.y;
    
    if (shape.type === 'rectangle' || shape.type === 'ellipse') {
      const bounds = getShapeBounds(shape);
      cx = bounds.x + bounds.width / 2;
      cy = bounds.y + bounds.height / 2;
    } else if (shape.type === 'arrow' || shape.type === 'line' || shape.type === 'freehand') {
      const pts = shape.points || [];
      if (pts.length > 1) {
        const p1 = { x: shape.x + pts[0].x, y: shape.y + pts[0].y };
        const p2 = { x: shape.x + pts[pts.length - 1].x, y: shape.y + pts[pts.length - 1].y };
        cx = (p1.x + p2.x) / 2;
        cy = (p1.y + p2.y) / 2;
      }
    }
    
    const h = lines.length * fontSize * 1.25;
    const w = Math.max(40, ...lines.map(line => line.length * fontSize * 0.62));
    
    if (shape.type === 'text') {
      if (point.x >= shape.x && point.x <= shape.x + w && point.y >= shape.y - fontSize && point.y <= shape.y + h - fontSize) {
        return true;
      }
    } else {
      if (point.x >= cx - w/2 && point.x <= cx + w/2 && point.y >= cy - h/2 && point.y <= cy + h/2) {
        return true;
      }
    }
  }

  if (shape.type === 'rectangle') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    return point.x >= shape.x && point.x <= shape.x + w && point.y >= shape.y && point.y <= shape.y + h;
  }

  if (shape.type === 'ellipse') {
    const w = shape.width || 0;
    const h = shape.height || 0;
    const radiusX = w / 2;
    const radiusY = h / 2;
    if (!radiusX || !radiusY) return false;
    const centerX = shape.x + radiusX;
    const centerY = shape.y + radiusY;
    return (((point.x - centerX) ** 2) / (radiusX ** 2)) + (((point.y - centerY) ** 2) / (radiusY ** 2)) <= 1;
  }

  if (shape.type === 'text') {
    const metrics = getTextMetrics(shape);
    return point.x >= shape.x && point.x <= shape.x + metrics.width && point.y >= shape.y - (shape.fontSize || 20) && point.y <= shape.y + metrics.height;
  }

  if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
    const pts = shape.points || [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = { x: shape.x + pts[i].x, y: shape.y + pts[i].y };
      const b = { x: shape.x + pts[i + 1].x, y: shape.y + pts[i + 1].y };
      if (pointToSegmentDistance(point, a, b) <= Math.max(8, (shape.strokeWidth || 2) + 4)) return true;
    }
  }

  return false;
}

export type HandleType = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'start' | 'end';

export function getHandleAtPoint(shape: Shape, point: Point, allShapes: Shape[] = []): HandleType | null {
  const d = 6;
  if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
    const pts = shape.points || [];
    if (pts.length > 1) {
      let p1, p2;
      if (shape.type === 'freehand') {
        p1 = { x: shape.x + pts[0].x, y: shape.y + pts[0].y };
        p2 = { x: shape.x + pts[pts.length - 1].x, y: shape.y + pts[pts.length - 1].y };
      } else {
        const clipped = getArrowClippedEndpoints(shape, allShapes);
        p1 = clipped.p1;
        p2 = clipped.p2;
      }
      if (Math.abs(point.x - p1.x) <= d && Math.abs(point.y - p1.y) <= d) return 'start';
      if (Math.abs(point.x - p2.x) <= d && Math.abs(point.y - p2.y) <= d) return 'end';
      return null;
    }
  }

  const bounds = getShapeBounds(shape);
  const b = { x: bounds.x - 6, y: bounds.y - 6, w: bounds.width + 12, h: bounds.height + 12 };
  
  if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - b.y) <= d) return 'nw';
  if (Math.abs(point.x - (b.x + b.w / 2)) <= d && Math.abs(point.y - b.y) <= d) return 'n';
  if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - b.y) <= d) return 'ne';
  if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - (b.y + b.h / 2)) <= d) return 'w';
  if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - (b.y + b.h / 2)) <= d) return 'e';
  if (Math.abs(point.x - b.x) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 'sw';
  if (Math.abs(point.x - (b.x + b.w / 2)) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 's';
  if (Math.abs(point.x - (b.x + b.w)) <= d && Math.abs(point.y - (b.y + b.h)) <= d) return 'se';
  
  return null;
}

export function getTopShapeAtPoint(shapes: Shape[], point: Point): Shape | null {
  return [...shapes]
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    .find((shape) => isPointInsideShape(point, shape)) || null;
}
