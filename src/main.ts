/**
 * Figma Plugin Main Controller
 *
 * This runs in Figma's main thread and has access to the Figma API.
 * It receives analyzed image data from the UI and creates actual Figma nodes.
 */

import { segmentImage, mergeSmallRegions } from './analysis/color-quantizer';
import { detectShapes, buildHierarchy } from './analysis/shape-detector';
import { generateLayers, groupLayersByProximity, LayerDescriptor } from './analysis/layer-generator';

// Show the plugin UI
figma.showUI(__html__, {
  width: 340,
  height: 640,
  themeColors: true,
});

/**
 * Sends a progress update to the UI.
 */
function sendProgress(percent: number, text: string) {
  figma.ui.postMessage({ type: 'progress', percent, text });
}

/**
 * Creates a Figma rectangle node from a layer descriptor.
 */
function createRectangleNode(layer: LayerDescriptor): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = layer.name;
  rect.x = layer.x;
  rect.y = layer.y;
  rect.resize(layer.width, layer.height);
  rect.fills = [{ type: 'SOLID', color: layer.fillColor }];
  rect.opacity = layer.opacity;

  if (layer.cornerRadius > 0) {
    rect.cornerRadius = layer.cornerRadius;
  }

  return rect;
}

/**
 * Creates a Figma ellipse node from a layer descriptor.
 */
function createEllipseNode(layer: LayerDescriptor): EllipseNode {
  const ellipse = figma.createEllipse();
  ellipse.name = layer.name;
  ellipse.x = layer.x;
  ellipse.y = layer.y;
  ellipse.resize(layer.width, layer.height);
  ellipse.fills = [{ type: 'SOLID', color: layer.fillColor }];
  ellipse.opacity = layer.opacity;

  return ellipse;
}

/**
 * Creates a Figma text node placeholder (rectangle with text-like styling).
 * Since we can't detect actual text content from pixels, we create a styled placeholder.
 */
function createTextPlaceholder(layer: LayerDescriptor): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = layer.name;
  rect.x = layer.x;
  rect.y = layer.y;
  rect.resize(layer.width, layer.height);
  rect.fills = [{ type: 'SOLID', color: layer.fillColor }];
  rect.opacity = layer.opacity;
  rect.cornerRadius = 2;

  return rect;
}

/**
 * Creates a button-styled node.
 */
function createButtonNode(layer: LayerDescriptor): FrameNode {
  const frame = figma.createFrame();
  frame.name = layer.name;
  frame.x = layer.x;
  frame.y = layer.y;
  frame.resize(layer.width, layer.height);
  frame.fills = [{ type: 'SOLID', color: layer.fillColor }];
  frame.opacity = layer.opacity;
  frame.cornerRadius = layer.cornerRadius || 4;

  // Add layout properties for button-like behavior
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.paddingLeft = 12;
  frame.paddingRight = 12;
  frame.paddingTop = 8;
  frame.paddingBottom = 8;

  // Add a text placeholder inside the button
  const text = figma.createText();
  text.name = 'Button Label';
  text.characters = 'Button';
  text.fontSize = Math.min(14, Math.max(10, Math.floor(layer.height * 0.45)));

  // Determine text color based on background brightness
  const brightness = layer.fillColor.r * 0.299 + layer.fillColor.g * 0.587 + layer.fillColor.b * 0.114;
  const textColor = brightness > 0.5 ? { r: 0.1, g: 0.1, b: 0.1 } : { r: 1, g: 1, b: 1 };
  text.fills = [{ type: 'SOLID', color: textColor }];

  frame.appendChild(text);
  return frame;
}

/**
 * Creates an input field styled node.
 */
function createInputNode(layer: LayerDescriptor): FrameNode {
  const frame = figma.createFrame();
  frame.name = layer.name;
  frame.x = layer.x;
  frame.y = layer.y;
  frame.resize(layer.width, layer.height);
  frame.fills = [{ type: 'SOLID', color: layer.fillColor }];
  frame.opacity = layer.opacity;
  frame.cornerRadius = layer.cornerRadius || 4;
  frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  frame.strokeWeight = 1;

  // Add layout
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'CENTER';
  frame.paddingLeft = 12;
  frame.paddingRight = 12;
  frame.paddingTop = 8;
  frame.paddingBottom = 8;

  // Add placeholder text
  const text = figma.createText();
  text.name = 'Placeholder';
  text.characters = 'Input text...';
  text.fontSize = Math.min(14, Math.max(10, Math.floor(layer.height * 0.4)));
  text.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];

  frame.appendChild(text);
  return frame;
}

/**
 * Creates a Figma frame node from a layer descriptor (for containers).
 */
function createFrameNode(layer: LayerDescriptor): FrameNode {
  const frame = figma.createFrame();
  frame.name = layer.name;
  frame.x = layer.x;
  frame.y = layer.y;
  frame.resize(layer.width, layer.height);
  frame.fills = [{ type: 'SOLID', color: layer.fillColor }];
  frame.opacity = layer.opacity;

  if (layer.cornerRadius > 0) {
    frame.cornerRadius = layer.cornerRadius;
  }

  // Recursively create children
  for (const child of layer.children) {
    const childNode = createNode(child);
    if (childNode) {
      // Adjust child position relative to frame
      childNode.x = child.x - layer.x;
      childNode.y = child.y - layer.y;
      frame.appendChild(childNode);
    }
  }

  return frame;
}

/**
 * Creates a Figma group from child layers.
 */
function createGroupNode(layer: LayerDescriptor): GroupNode | null {
  const children: SceneNode[] = [];

  for (const child of layer.children) {
    const childNode = createNode(child);
    if (childNode) {
      figma.currentPage.appendChild(childNode);
      children.push(childNode);
    }
  }

  if (children.length === 0) return null;

  const group = figma.group(children, figma.currentPage);
  group.name = layer.name;
  return group;
}

/**
 * Creates the appropriate Figma node based on the layer type.
 */
function createNode(layer: LayerDescriptor): SceneNode | null {
  try {
    if (layer.isButton) {
      return createButtonNode(layer);
    }

    if (layer.isInput) {
      return createInputNode(layer);
    }

    if (layer.isText) {
      return createTextPlaceholder(layer);
    }

    switch (layer.type) {
      case 'RECTANGLE':
        return createRectangleNode(layer);
      case 'ELLIPSE':
        return createEllipseNode(layer);
      case 'FRAME':
        return createFrameNode(layer);
      case 'GROUP':
        return createGroupNode(layer);
      default:
        return createRectangleNode(layer);
    }
  } catch (err) {
    console.error(`Failed to create node: ${layer.name}`, err);
    return null;
  }
}

/**
 * Main conversion pipeline.
 * Receives raw image data, analyzes it, and creates Figma layers.
 */
async function convertImage(
  rawData: number[],
  width: number,
  height: number,
  settings: {
    mode: string;
    colorTolerance: number;
    minRegionSize: number;
    maxLayers: number;
    detectText: boolean;
    detectButtons: boolean;
    roundCorners: boolean;
    groupLayers: boolean;
    keepOriginal: boolean;
  }
) {
  try {
    const imageData = new Uint8ClampedArray(rawData);

    // Adjust settings based on mode
    let tolerance = settings.colorTolerance;
    let minSize = settings.minRegionSize;
    let maxLayers = settings.maxLayers;

    switch (settings.mode) {
      case 'ui':
        tolerance = Math.max(tolerance, 25);
        minSize = Math.max(minSize, 30);
        break;
      case 'shapes':
        tolerance = Math.min(tolerance, 20);
        minSize = Math.max(minSize, 15);
        break;
      case 'detailed':
        tolerance = Math.max(10, tolerance - 10);
        minSize = Math.max(4, minSize - 10);
        maxLayers = Math.min(500, maxLayers * 2);
        break;
    }

    // Step 1: Segment the image into color regions
    sendProgress(10, 'Segmenting image by color...');
    const regions = segmentImage(imageData, width, height, tolerance, minSize);
    sendProgress(30, `Found ${regions.length} color regions`);

    // Step 2: Merge small regions to reduce layer count
    sendProgress(35, 'Optimizing regions...');
    const mergedRegions = mergeSmallRegions(regions, maxLayers, tolerance);
    sendProgress(45, `Optimized to ${mergedRegions.length} regions`);

    // Step 3: Detect shapes and classify regions
    sendProgress(50, 'Detecting shapes...');
    const shapes = detectShapes(mergedRegions, width, height, {
      detectText: settings.detectText,
      detectButtons: settings.detectButtons,
      roundCorners: settings.roundCorners,
    });
    sendProgress(60, `Classified ${shapes.length} shapes`);

    // Step 4: Build containment hierarchy
    sendProgress(65, 'Building layer hierarchy...');
    const hierarchy = buildHierarchy(shapes);
    sendProgress(70, 'Hierarchy built');

    // Step 5: Generate layer descriptors
    sendProgress(75, 'Generating layers...');
    let layers = generateLayers(hierarchy, width, height, settings.keepOriginal);

    // Step 6: Group layers by proximity if enabled
    if (settings.groupLayers) {
      sendProgress(80, 'Grouping related layers...');
      layers = groupLayersByProximity(layers);
    }

    sendProgress(85, 'Creating Figma nodes...');

    // Step 7: Load fonts (needed for text nodes)
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

    // Step 8: Create the parent frame
    const parentFrame = figma.createFrame();
    parentFrame.name = 'Image to Layers';
    parentFrame.resize(width, height);
    parentFrame.fills = [];

    // Position near current viewport
    const center = figma.viewport.center;
    parentFrame.x = Math.round(center.x - width / 2);
    parentFrame.y = Math.round(center.y - height / 2);

    // Step 9: Create all nodes
    let nodeCount = 0;
    const totalLayers = layers.length;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const node = createNode(layer);

      if (node) {
        // Adjust position relative to parent frame
        if (node.type !== 'GROUP') {
          node.x = layer.x;
          node.y = layer.y;
        }

        parentFrame.appendChild(node);
        nodeCount++;
      }

      // Update progress
      const progressPercent = 85 + (i / totalLayers) * 13;
      sendProgress(Math.round(progressPercent), `Creating layer ${i + 1} of ${totalLayers}...`);
    }

    // Add to page
    figma.currentPage.appendChild(parentFrame);

    // Select the created frame
    figma.currentPage.selection = [parentFrame];
    figma.viewport.scrollAndZoomIntoView([parentFrame]);

    sendProgress(100, 'Done!');

    figma.ui.postMessage({
      type: 'complete',
      layerCount: nodeCount,
    });

  } catch (error: any) {
    console.error('Conversion error:', error);
    figma.ui.postMessage({
      type: 'error',
      message: error.message || 'An unexpected error occurred during conversion',
    });
  }
}

// Listen for messages from the UI
figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'convert-image') {
    await convertImage(
      msg.imageData,
      msg.width,
      msg.height,
      msg.settings
    );
  }
};
