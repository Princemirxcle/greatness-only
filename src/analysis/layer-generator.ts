/**
 * Generates Figma-compatible layer descriptors from detected shapes.
 * These descriptors are sent to the main plugin thread for actual Figma node creation.
 */

import { Color, colorToFigmaRGB, colorToHex } from './color-quantizer';
import { DetectedShape } from './shape-detector';

export interface LayerDescriptor {
  type: 'RECTANGLE' | 'ELLIPSE' | 'TEXT' | 'FRAME' | 'GROUP';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: { r: number; g: number; b: number };
  opacity: number;
  cornerRadius: number;
  children: LayerDescriptor[];
  isText: boolean;
  isButton: boolean;
  isInput: boolean;
  sourceType: string;
}

/**
 * Converts a DetectedShape into a LayerDescriptor for Figma.
 */
function shapeToLayer(shape: DetectedShape): LayerDescriptor {
  const figmaColor = colorToFigmaRGB(shape.region.color);
  const opacity = shape.region.color.a / 255;

  let layerType: LayerDescriptor['type'] = 'RECTANGLE';
  let isText = false;
  let isButton = false;
  let isInput = false;

  switch (shape.type) {
    case 'circle':
    case 'ellipse':
      layerType = 'ELLIPSE';
      break;
    case 'text-block':
      layerType = 'RECTANGLE'; // Will be converted to text in Figma
      isText = true;
      break;
    case 'button':
      layerType = 'RECTANGLE';
      isButton = true;
      break;
    case 'input':
      layerType = 'RECTANGLE';
      isInput = true;
      break;
    case 'rectangle':
    case 'rounded-rectangle':
    case 'irregular':
    default:
      layerType = 'RECTANGLE';
      break;
  }

  // If shape has children, make it a frame
  if (shape.children.length > 0) {
    layerType = 'FRAME';
  }

  const children = shape.children.map(child => shapeToLayer(child));

  return {
    type: layerType,
    name: shape.label,
    x: shape.bounds.x,
    y: shape.bounds.y,
    width: Math.max(shape.bounds.width, 1),
    height: Math.max(shape.bounds.height, 1),
    fillColor: figmaColor,
    opacity: Math.max(0, Math.min(1, opacity)),
    cornerRadius: shape.cornerRadius,
    children,
    isText,
    isButton,
    isInput,
    sourceType: shape.type,
  };
}

/**
 * Generates layer descriptors from an array of detected shapes.
 */
export function generateLayers(
  shapes: DetectedShape[],
  imageWidth: number,
  imageHeight: number,
  keepOriginal: boolean
): LayerDescriptor[] {
  const layers: LayerDescriptor[] = [];

  // Optionally add a background frame for the original image
  if (keepOriginal) {
    layers.push({
      type: 'RECTANGLE',
      name: 'Original Image Background',
      x: 0,
      y: 0,
      width: imageWidth,
      height: imageHeight,
      fillColor: { r: 0.95, g: 0.95, b: 0.95 },
      opacity: 1,
      cornerRadius: 0,
      children: [],
      isText: false,
      isButton: false,
      isInput: false,
      sourceType: 'background',
    });
  }

  // Convert each shape to a layer
  for (const shape of shapes) {
    layers.push(shapeToLayer(shape));
  }

  return layers;
}

/**
 * Groups layers by spatial proximity.
 * Layers that are close to each other vertically get grouped.
 */
export function groupLayersByProximity(
  layers: LayerDescriptor[],
  proximityThreshold: number = 20
): LayerDescriptor[] {
  if (layers.length <= 1) return layers;

  // Sort by Y position
  const sorted = [...layers].sort((a, b) => a.y - b.y);
  const groups: LayerDescriptor[][] = [];
  let currentGroup: LayerDescriptor[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Check if current layer is close to the previous one
    const gap = curr.y - (prev.y + prev.height);

    if (gap <= proximityThreshold) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  // Convert groups with multiple items into GROUP layers
  const result: LayerDescriptor[] = [];
  let groupIndex = 0;

  for (const group of groups) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      // Calculate group bounds
      let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
      for (const layer of group) {
        minX = Math.min(minX, layer.x);
        minY = Math.min(minY, layer.y);
        maxX = Math.max(maxX, layer.x + layer.width);
        maxY = Math.max(maxY, layer.y + layer.height);
      }

      result.push({
        type: 'GROUP',
        name: `Group ${++groupIndex}`,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        fillColor: { r: 1, g: 1, b: 1 },
        opacity: 1,
        cornerRadius: 0,
        children: group,
        isText: false,
        isButton: false,
        isInput: false,
        sourceType: 'group',
      });
    }
  }

  return result;
}
