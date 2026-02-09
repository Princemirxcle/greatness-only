/**
 * Shape and feature detection for image regions.
 * Detects rectangles, rounded corners, circles, and text-like regions.
 */

import { Region, Color, colorDistance } from './color-quantizer';

export interface DetectedShape {
  type: 'rectangle' | 'rounded-rectangle' | 'circle' | 'ellipse' | 'text-block' | 'button' | 'input' | 'irregular';
  region: Region;
  bounds: { x: number; y: number; width: number; height: number };
  cornerRadius: number;
  confidence: number;
  isContainer: boolean;
  children: DetectedShape[];
  label: string;
}

/**
 * Analyzes a region's pixel distribution to determine if it's rectangular.
 * Computes the fill ratio of the bounding box.
 */
function computeFillRatio(region: Region, width: number): number {
  const { bounds } = region;
  const expectedPixels = bounds.width * bounds.height;
  if (expectedPixels === 0) return 0;
  return region.pixelCount / expectedPixels;
}

/**
 * Checks if a region has rounded corners by sampling corner pixels.
 */
function detectCornerRadius(
  region: Region,
  imageWidth: number
): number {
  const { bounds } = region;
  if (bounds.width < 8 || bounds.height < 8) return 0;

  const pixelSet = new Set(region.pixels);
  const maxRadius = Math.min(Math.floor(bounds.width / 3), Math.floor(bounds.height / 3), 20);

  for (let r = maxRadius; r >= 2; r--) {
    let cornerMisses = 0;
    let cornerChecks = 0;

    // Check all 4 corners
    const corners = [
      { cx: bounds.x + r, cy: bounds.y + r },                                         // top-left
      { cx: bounds.x + bounds.width - 1 - r, cy: bounds.y + r },                      // top-right
      { cx: bounds.x + r, cy: bounds.y + bounds.height - 1 - r },                     // bottom-left
      { cx: bounds.x + bounds.width - 1 - r, cy: bounds.y + bounds.height - 1 - r },  // bottom-right
    ];

    for (const corner of corners) {
      // Sample points in the corner area that should be empty for a rounded corner
      for (let dx = 0; dx < r; dx++) {
        for (let dy = 0; dy < r; dy++) {
          const distFromCorner = Math.sqrt(dx * dx + dy * dy);
          if (distFromCorner > r && distFromCorner < r + 2) {
            // Points just outside the radius - these should be filled for a rounded rect
            cornerChecks++;
          } else if (distFromCorner < r * 0.5) {
            // Points well inside the corner area
            const px = corner.cx + (corner === corners[0] || corner === corners[2] ? -dx : dx);
            const py = corner.cy + (corner === corners[0] || corner === corners[1] ? -dy : dy);
            const idx = py * imageWidth + px;
            if (!pixelSet.has(idx)) {
              cornerMisses++;
            }
            cornerChecks++;
          }
        }
      }
    }

    if (cornerChecks > 0 && cornerMisses / cornerChecks > 0.3) {
      return r;
    }
  }

  return 0;
}

/**
 * Detects if a region looks like a text block based on its characteristics.
 */
function isTextLikeRegion(region: Region, imageWidth: number): boolean {
  const { bounds } = region;
  const fillRatio = computeFillRatio(region, imageWidth);
  const aspectRatio = bounds.width / Math.max(bounds.height, 1);

  // Text regions tend to be:
  // - Wide and short (aspect ratio > 2)
  // - Have low fill ratio (lots of gaps between characters)
  // - Have moderate size
  if (fillRatio < 0.5 && aspectRatio > 1.5 && bounds.height < 60 && bounds.height > 6) {
    return true;
  }

  // Single line of text
  if (fillRatio < 0.4 && bounds.height >= 8 && bounds.height <= 40 && bounds.width > bounds.height * 2) {
    return true;
  }

  return false;
}

/**
 * Detects if a region looks like a button.
 */
function isButtonLikeRegion(region: Region, imageWidth: number): boolean {
  const { bounds } = region;
  const fillRatio = computeFillRatio(region, imageWidth);
  const aspectRatio = bounds.width / Math.max(bounds.height, 1);

  // Buttons tend to be:
  // - Rectangular with high fill ratio
  // - Wider than tall but not extremely wide
  // - Medium sized
  return (
    fillRatio > 0.85 &&
    aspectRatio > 1.5 &&
    aspectRatio < 8 &&
    bounds.height >= 24 &&
    bounds.height <= 80 &&
    bounds.width >= 60 &&
    bounds.width <= 400
  );
}

/**
 * Detects if a region looks like an input field.
 */
function isInputLikeRegion(region: Region, imageWidth: number): boolean {
  const { bounds } = region;
  const fillRatio = computeFillRatio(region, imageWidth);
  const aspectRatio = bounds.width / Math.max(bounds.height, 1);

  // Input fields tend to be:
  // - Very rectangular
  // - Wide
  // - High fill ratio (solid background)
  // - Specific height range
  return (
    fillRatio > 0.9 &&
    aspectRatio > 3 &&
    bounds.height >= 28 &&
    bounds.height <= 60 &&
    bounds.width >= 100
  );
}

/**
 * Checks if a region is circular/elliptical.
 */
function isCircularRegion(region: Region, imageWidth: number): { isCircle: boolean; isEllipse: boolean } {
  const { bounds } = region;
  const fillRatio = computeFillRatio(region, imageWidth);
  const aspectRatio = bounds.width / Math.max(bounds.height, 1);
  const expectedCircleFill = Math.PI / 4; // ~0.785

  const isCircle = (
    Math.abs(aspectRatio - 1) < 0.15 &&
    Math.abs(fillRatio - expectedCircleFill) < 0.15 &&
    bounds.width >= 8
  );

  const isEllipse = (
    !isCircle &&
    Math.abs(fillRatio - expectedCircleFill) < 0.2 &&
    bounds.width >= 8 &&
    bounds.height >= 8
  );

  return { isCircle, isEllipse };
}

/**
 * Main shape detection function. Analyzes all regions and classifies them.
 */
export function detectShapes(
  regions: Region[],
  imageWidth: number,
  imageHeight: number,
  options: {
    detectText: boolean;
    detectButtons: boolean;
    roundCorners: boolean;
  }
): DetectedShape[] {
  const shapes: DetectedShape[] = [];

  for (const region of regions) {
    const fillRatio = computeFillRatio(region, imageWidth);
    const { isCircle, isEllipse } = isCircularRegion(region, imageWidth);

    let type: DetectedShape['type'] = 'rectangle';
    let cornerRadius = 0;
    let confidence = fillRatio;
    let label = `Layer ${region.id}`;

    if (isCircle) {
      type = 'circle';
      confidence = 0.9;
      label = `Circle ${region.id}`;
    } else if (isEllipse) {
      type = 'ellipse';
      confidence = 0.85;
      label = `Ellipse ${region.id}`;
    } else if (options.detectText && isTextLikeRegion(region, imageWidth)) {
      type = 'text-block';
      confidence = 0.7;
      label = `Text ${region.id}`;
    } else if (options.detectButtons && isButtonLikeRegion(region, imageWidth)) {
      type = 'button';
      confidence = 0.75;
      label = `Button ${region.id}`;
      if (options.roundCorners) {
        cornerRadius = detectCornerRadius(region, imageWidth);
        if (cornerRadius === 0) cornerRadius = 4; // Default button corner radius
      }
    } else if (options.detectButtons && isInputLikeRegion(region, imageWidth)) {
      type = 'input';
      confidence = 0.7;
      label = `Input ${region.id}`;
      if (options.roundCorners) {
        cornerRadius = detectCornerRadius(region, imageWidth);
        if (cornerRadius === 0) cornerRadius = 4;
      }
    } else if (fillRatio > 0.8) {
      // Solid rectangle
      if (options.roundCorners) {
        cornerRadius = detectCornerRadius(region, imageWidth);
        type = cornerRadius > 0 ? 'rounded-rectangle' : 'rectangle';
      }
      label = `Rect ${region.id}`;
    } else if (fillRatio < 0.5) {
      type = 'irregular';
      label = `Shape ${region.id}`;
    }

    shapes.push({
      type,
      region,
      bounds: { ...region.bounds },
      cornerRadius,
      confidence,
      isContainer: false,
      children: [],
      label,
    });
  }

  return shapes;
}

/**
 * Builds a containment hierarchy: shapes that are fully inside other shapes
 * become children of those shapes.
 */
export function buildHierarchy(shapes: DetectedShape[]): DetectedShape[] {
  // Sort by area descending
  const sorted = [...shapes].sort(
    (a, b) => (b.bounds.width * b.bounds.height) - (a.bounds.width * a.bounds.height)
  );

  const roots: DetectedShape[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const shape = sorted[i];
    if (assigned.has(shape.region.id)) continue;

    let foundParent = false;

    for (let j = 0; j < i; j++) {
      const parent = sorted[j];
      if (assigned.has(parent.region.id)) continue;

      // Check if shape is inside parent
      if (
        shape.bounds.x >= parent.bounds.x &&
        shape.bounds.y >= parent.bounds.y &&
        shape.bounds.x + shape.bounds.width <= parent.bounds.x + parent.bounds.width &&
        shape.bounds.y + shape.bounds.height <= parent.bounds.y + parent.bounds.height &&
        shape.region.id !== parent.region.id
      ) {
        parent.children.push(shape);
        parent.isContainer = true;
        foundParent = true;
        break;
      }
    }

    if (!foundParent) {
      roots.push(shape);
    }
  }

  return roots;
}
