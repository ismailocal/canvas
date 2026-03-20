import rough from 'roughjs';
import type { Shape, CanvasState } from './types';
import { getShapeBounds, getArrowClippedEndpoints } from './Geometry';

function getRoundRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${h - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z`;
}

export function renderShape(rc: any, ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean, isErasing: boolean = false, allShapes: Shape[] = []) {
  ctx.save();
  ctx.globalAlpha = isErasing ? 0.3 : (shape.opacity ?? 1);

  const w = shape.width || 0;
  const h = shape.height || 0;
  const options: any = {
    stroke: shape.stroke || '#f8fafc',
    fill: shape.fill && shape.fill !== 'transparent' ? shape.fill : undefined,
    strokeWidth: shape.strokeWidth || 2,
    roughness: shape.roughness ?? 1,
    fillStyle: shape.fillStyle || 'hachure',
  };

  if (shape.strokeStyle === 'dashed') {
    options.strokeLineDash = [8, 8];
  } else if (shape.strokeStyle === 'dotted') {
    options.strokeLineDash = [2, 6];
  }

  switch (shape.type) {
    case 'rectangle':
      if (shape.roundness === 'round') {
        const r = Math.min(16, Math.abs(w) / 2, Math.abs(h) / 2);
        rc.path(getRoundRectPath(shape.x, shape.y, w, h, r), options);
      } else {
        rc.rectangle(shape.x, shape.y, w, h, options);
      }
      break;
    case 'ellipse':
      rc.ellipse(shape.x + w / 2, shape.y + h / 2, Math.abs(w), Math.abs(h), options);
      break;
    case 'line':
    case 'arrow':
    case 'freehand': {
      const pts = shape.points || [];
      if (pts.length > 1) {
        if (shape.type === 'line' || shape.type === 'arrow') {
          const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);

          rc.line(p1.x, p1.y, p2.x, p2.y, options);
          
          if (shape.type === 'arrow') {
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const size = 20;
            const arrowP1 = { x: p2.x - size * Math.cos(angle - Math.PI / 6), y: p2.y - size * Math.sin(angle - Math.PI / 6) };
            const arrowP2 = { x: p2.x - size * Math.cos(angle + Math.PI / 6), y: p2.y - size * Math.sin(angle + Math.PI / 6) };
            rc.line(p2.x, p2.y, arrowP1.x, arrowP1.y, options);
            rc.line(p2.x, p2.y, arrowP2.x, arrowP2.y, options);
          }
        } else {
          rc.curve(pts.map(p => [shape.x + p.x, shape.y + p.y]), options);
        }
      }
      break;
    }
    default:
      break;
  }

  if (shape.text && shape.type !== 'text') {
    const fontSize = shape.fontSize || 20;
    ctx.font = `${fontSize}px ${shape.fontFamily || 'Inter, Arial, sans-serif'}`;
    ctx.fillStyle = shape.stroke || '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let cx = shape.x;
    let cy = shape.y;
    
    if (shape.type === 'rectangle' || shape.type === 'ellipse') {
      const bounds = getShapeBounds(shape);
      cx = bounds.x + bounds.width / 2;
      cy = bounds.y + bounds.height / 2;
    } else if (shape.type === 'arrow' || shape.type === 'line' || shape.type === 'freehand') {
      const pts = shape.points || [];
      if (pts.length > 1) {
        if (shape.type === 'freehand') {
          const p1 = { x: shape.x + pts[0].x, y: shape.y + pts[0].y };
          const p2 = { x: shape.x + pts[pts.length - 1].x, y: shape.y + pts[pts.length - 1].y };
          cx = (p1.x + p2.x) / 2;
          cy = (p1.y + p2.y) / 2;
        } else {
          const { p1, p2 } = getArrowClippedEndpoints(shape, allShapes);
          cx = (p1.x + p2.x) / 2;
          cy = (p1.y + p2.y) / 2;
        }
      }
    }
    
    const lines = shape.text.split('\n');
    const totalHeight = lines.length * fontSize * 1.2;
    const maxW = Math.max(...lines.map(line => ctx.measureText(line).width));
    const startY = cy - totalHeight / 2 + fontSize / 2;

    if (shape.type === 'arrow' || shape.type === 'line') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - maxW / 2 - 8, cy - totalHeight / 2 - 4, maxW + 16, totalHeight + 8);
      ctx.restore();
    }

    lines.forEach((line, index) => ctx.fillText(line, cx, startY + index * fontSize * 1.2));
  } else if (shape.text && shape.type === 'text') {
    const fontSize = shape.fontSize || 20;
    ctx.fillStyle = shape.stroke || '#f8fafc';
    ctx.font = `${fontSize}px ${shape.fontFamily || 'Inter, Arial, sans-serif'}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    shape.text.split('\n').forEach((line, index) => ctx.fillText(line, shape.x, shape.y + index * fontSize * 1.25));
  }

  if (isSelected) {
    if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freehand') {
      const pts = shape.points || [];
      if (pts.length > 1) {
        ctx.fillStyle = '#1e1e24';
        ctx.strokeStyle = '#8b5cf6';
        const hw = 4;
        let p1, p2;
        if (shape.type === 'freehand') {
          p1 = { x: shape.x + pts[0].x, y: shape.y + pts[0].y };
          p2 = { x: shape.x + pts[pts.length - 1].x, y: shape.y + pts[pts.length - 1].y };
        } else {
          const clipped = getArrowClippedEndpoints(shape, allShapes);
          p1 = clipped.p1;
          p2 = clipped.p2;
        }
        ctx.fillRect(p1.x - hw, p1.y - hw, hw * 2, hw * 2);
        ctx.strokeRect(p1.x - hw, p1.y - hw, hw * 2, hw * 2);
        ctx.fillRect(p2.x - hw, p2.y - hw, hw * 2, hw * 2);
        ctx.strokeRect(p2.x - hw, p2.y - hw, hw * 2, hw * 2);
      }
    } else {
      const bounds = getShapeBounds(shape);
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12);

      ctx.setLineDash([]);
      ctx.fillStyle = '#1e1e24';
      ctx.strokeStyle = '#8b5cf6';
      const hw = 4;
      const drawHandle = (hx: number, hy: number) => {
        ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
        ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
      };

      const b = { x: bounds.x - 6, y: bounds.y - 6, w: bounds.width + 12, h: bounds.height + 12 };
    drawHandle(b.x, b.y); // nw
    drawHandle(b.x + b.w / 2, b.y); // n
    drawHandle(b.x + b.w, b.y); // ne
    drawHandle(b.x, b.y + b.h / 2); // w
    drawHandle(b.x + b.w, b.y + b.h / 2); // e
    drawHandle(b.x, b.y + b.h); // sw
    drawHandle(b.x + b.w / 2, b.y + b.h); // s
    drawHandle(b.x + b.w, b.y + b.h); // se
  }
}

  ctx.restore();
}

export function renderWelcome(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
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

function renderGrid(ctx: CanvasRenderingContext2D, state: CanvasState, width: number, height: number) {
  if (!state.showGrid || !state.gridSize) return;
  const size = state.gridSize * state.viewport.zoom;
  const dx = state.viewport.x % size;
  const dy = state.viewport.y % size;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = dx; x < width; x += size) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = dy; y < height; y += size) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

export function renderScene(canvas: HTMLCanvasElement, state: CanvasState) {
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

  const rc = rough.canvas(canvas);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#131316';
  ctx.fillRect(0, 0, rect.width, rect.height);

  renderGrid(ctx, state, rect.width, rect.height);

  if (!state.shapes.length) {
    renderWelcome(canvas, ctx);
  }

  ctx.save();
  ctx.translate(state.viewport.x, state.viewport.y);
  ctx.scale(state.viewport.zoom, state.viewport.zoom);
  [...state.shapes]
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .forEach((shape) => {
      const isErasing = state.erasingShapeIds?.includes(shape.id) || false;
      renderShape(rc, ctx, shape, state.selectedIds.includes(shape.id), isErasing, state.shapes);
    });

  if (state.hoveredShapeId && (state.activeTool === 'arrow' || state.activeTool === 'line')) {
    const shape = state.shapes.find(s => s.id === state.hoveredShapeId);
    if (shape && shape.type !== 'arrow' && shape.type !== 'line' && shape.type !== 'freehand') {
      ctx.save();
      const bounds = getShapeBounds(shape);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
      ctx.restore();
    }
  }

  if (state.erasingPath && state.erasingPath.length > 0) {
    const path = state.erasingPath;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    
    // Calculate a good alpha per overlapping stroke so the head reaches ~0.6 opacity
    // rgba(139, 147, 158) is a nice neutral grayish/zinc color
    const alpha = 0.8 / Math.max(path.length, 1);

    for (let i = 0; i < path.length - 1; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(139, 147, 158, ${alpha})`;
      ctx.moveTo(path[i].x, path[i].y);
      let j;
      for (j = i + 1; j < path.length - 1; j++) {
        const xc = (path[j].x + path[j + 1].x) / 2;
        const yc = (path[j].y + path[j + 1].y) / 2;
        ctx.quadraticCurveTo(path[j].x, path[j].y, xc, yc);
      }
      if (j < path.length) {
        ctx.lineTo(path[j].x, path[j].y);
      }
      ctx.stroke();
    }
  }

  if (state.selectionBox) {
    ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(state.selectionBox.x, state.selectionBox.y, state.selectionBox.width, state.selectionBox.height);
    ctx.strokeRect(state.selectionBox.x, state.selectionBox.y, state.selectionBox.width, state.selectionBox.height);
  }

  ctx.restore();
}
