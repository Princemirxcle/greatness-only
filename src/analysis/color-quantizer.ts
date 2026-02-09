/**
 * Color quantization and segmentation engine.
 * Groups pixels into regions of similar color using flood-fill based segmentation.
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Region {
  id: number;
  color: Color;
  pixels: number[];  // flat array of pixel indices
  bounds: { x: number; y: number; width: number; height: number };
  pixelCount: number;
}

/**
 * Computes the Euclidean distance between two colors in RGB space.
 */
export function colorDistance(c1: Color, c2: Color): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Gets the color at a given pixel index from raw image data.
 */
export function getPixelColor(data: Uint8ClampedArray, index: number): Color {
  const offset = index * 4;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  };
}

/**
 * Converts a Color to a hex string.
 */
export function colorToHex(c: Color): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

/**
 * Converts a Color to Figma's RGB format (0-1 range).
 */
export function colorToFigmaRGB(c: Color): { r: number; g: number; b: number } {
  return {
    r: c.r / 255,
    g: c.g / 255,
    b: c.b / 255,
  };
}

/**
 * Averages an array of colors.
 */
export function averageColor(colors: Color[]): Color {
  if (colors.length === 0) return { r: 0, g: 0, b: 0, a: 255 };
  let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
  for (const c of colors) {
    rSum += c.r;
    gSum += c.g;
    bSum += c.b;
    aSum += c.a;
  }
  const len = colors.length;
  return {
    r: Math.round(rSum / len),
    g: Math.round(gSum / len),
    b: Math.round(bSum / len),
    a: Math.round(aSum / len),
  };
}

/**
 * Performs flood-fill based color segmentation on the image.
 * Returns an array of Regions, each representing a contiguous area of similar color.
 */
export function segmentImage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
  minRegionSize: number
): Region[] {
  const totalPixels = width * height;
  const visited = new Int32Array(totalPixels).fill(-1); // region ID per pixel
  const regions: Region[] = [];
  let regionId = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (visited[i] !== -1) continue;

    const seedColor = getPixelColor(data, i);

    // Skip fully transparent pixels
    if (seedColor.a < 10) {
      visited[i] = -2;
      continue;
    }

    // Flood fill from this pixel
    const queue: number[] = [i];
    const regionPixels: number[] = [];
    let minX = width, minY = height, maxX = 0, maxY = 0;
    const colors: Color[] = [];

    visited[i] = regionId;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      regionPixels.push(idx);

      const px = idx % width;
      const py = Math.floor(idx / width);
      const pixelColor = getPixelColor(data, idx);
      colors.push(pixelColor);

      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);

      // Check 4-connected neighbors
      const neighbors = [
        py > 0 ? idx - width : -1,           // up
        py < height - 1 ? idx + width : -1,   // down
        px > 0 ? idx - 1 : -1,               // left
        px < width - 1 ? idx + 1 : -1,        // right
      ];

      for (const ni of neighbors) {
        if (ni < 0 || ni >= totalPixels || visited[ni] !== -1) continue;

        const nc = getPixelColor(data, ni);
        if (nc.a < 10) {
          visited[ni] = -2;
          continue;
        }

        if (colorDistance(seedColor, nc) <= tolerance) {
          visited[ni] = regionId;
          queue.push(ni);
        }
      }
    }

    if (regionPixels.length >= minRegionSize) {
      regions.push({
        id: regionId,
        color: averageColor(colors),
        pixels: regionPixels,
        bounds: {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        },
        pixelCount: regionPixels.length,
      });
    }

    regionId++;
  }

  // Sort by area (largest first)
  regions.sort((a, b) => b.pixelCount - a.pixelCount);

  return regions;
}

/**
 * Reduces the number of regions by merging small neighboring regions
 * with similar colors into larger ones.
 */
export function mergeSmallRegions(
  regions: Region[],
  maxRegions: number,
  tolerance: number
): Region[] {
  if (regions.length <= maxRegions) return regions;

  // Sort by pixel count ascending (smallest first for merging)
  const sorted = [...regions].sort((a, b) => a.pixelCount - b.pixelCount);
  const merged = new Set<number>();
  const result: Region[] = [];

  for (const region of sorted) {
    if (merged.has(region.id)) continue;

    // Try to find a larger region with similar color to merge into
    let bestMatch: Region | null = null;
    let bestDist = Infinity;

    for (const candidate of sorted) {
      if (candidate.id === region.id || merged.has(candidate.id)) continue;
      if (candidate.pixelCount < region.pixelCount) continue;

      // Check if bounds overlap or are adjacent
      const boundsOverlap =
        region.bounds.x <= candidate.bounds.x + candidate.bounds.width + 2 &&
        region.bounds.x + region.bounds.width >= candidate.bounds.x - 2 &&
        region.bounds.y <= candidate.bounds.y + candidate.bounds.height + 2 &&
        region.bounds.y + region.bounds.height >= candidate.bounds.y - 2;

      if (!boundsOverlap) continue;

      const dist = colorDistance(region.color, candidate.color);
      if (dist < bestDist && dist <= tolerance * 1.5) {
        bestDist = dist;
        bestMatch = candidate;
      }
    }

    if (bestMatch && result.length + (sorted.length - Array.from(merged).length) > maxRegions) {
      // Merge into bestMatch
      bestMatch.pixels = bestMatch.pixels.concat(region.pixels);
      bestMatch.pixelCount += region.pixelCount;
      bestMatch.bounds = {
        x: Math.min(bestMatch.bounds.x, region.bounds.x),
        y: Math.min(bestMatch.bounds.y, region.bounds.y),
        width: Math.max(
          bestMatch.bounds.x + bestMatch.bounds.width,
          region.bounds.x + region.bounds.width
        ) - Math.min(bestMatch.bounds.x, region.bounds.x),
        height: Math.max(
          bestMatch.bounds.y + bestMatch.bounds.height,
          region.bounds.y + region.bounds.height
        ) - Math.min(bestMatch.bounds.y, region.bounds.y),
      };
      bestMatch.color = averageColor([bestMatch.color, region.color]);
      merged.add(region.id);
    } else {
      result.push(region);
    }
  }

  // Take top maxRegions by size
  result.sort((a, b) => b.pixelCount - a.pixelCount);
  return result.slice(0, maxRegions);
}
