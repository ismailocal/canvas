import type { ICanvasAPI, PointerPayload, ToolDefinition } from '../core/types';
import { STYLE_PRESETS } from '../core/constants';
import { createId } from '../core/Utils';

export class TextTool implements ToolDefinition {
  onPointerDown(payload: PointerPayload, api: ICanvasAPI) {
    const text = window.prompt('Metin girin', 'Yeni metin');
    if (!text) return;
    
    const preset = STYLE_PRESETS.text;
    const shape = {
      id: createId(),
      type: 'text' as const,
      x: payload.world.x,
      y: payload.world.y,
      text,
      fontSize: preset.fontSize,
      fontFamily: 'Inter, Arial, sans-serif',
      stroke: preset.stroke,
      opacity: preset.opacity,
    };
    
    api.addShape(shape);
    api.setSelection([shape.id]);
    api.commitState();
  }
}
