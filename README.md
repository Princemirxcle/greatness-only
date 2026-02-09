# Image to Layers — Figma Plugin

Converts images and screenshots into editable Figma layers. Drop in a screenshot and get back structured, editable rectangles, ellipses, text placeholders, buttons, and input fields — all as native Figma nodes you can select, recolor, resize, and restyle.

## Features

- **Color segmentation** — groups pixels into regions of similar color using flood-fill analysis
- **Shape detection** — classifies regions as rectangles, rounded rectangles, circles, ellipses, or irregular shapes
- **UI component detection** — identifies buttons, input fields, and text blocks based on shape heuristics
- **Rounded corner detection** — samples corner pixels to detect and preserve border-radius
- **Layer hierarchy** — automatically nests child shapes inside parent containers
- **Proximity grouping** — groups nearby layers together for cleaner organization
- **Configurable settings** — color tolerance, minimum region size, max layer count, and conversion mode

## Conversion Modes

| Mode | Description |
|------|-------------|
| **Auto Detect** | Balanced defaults for general images |
| **UI Components** | Optimized for screenshots of user interfaces — higher tolerance, larger minimum regions |
| **Shapes & Icons** | Lower tolerance for crisp icon/shape extraction |
| **Detailed** | More layers, finer segmentation for complex images |

## Getting Started

### Prerequisites

- Node.js 18+
- Figma desktop app

### Install & Build

```bash
npm install
npm run build
```

### Load in Figma

1. Open the Figma desktop app
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select the `manifest.json` file from this repo
4. The plugin appears under **Plugins → Development → Image to Layers**

### Usage

1. Run the plugin from the Figma menu
2. Drop or upload a PNG/JPG/SVG image
3. Adjust conversion settings (mode, color tolerance, layer count)
4. Toggle detection options (text, buttons, rounded corners, grouping)
5. Click **Convert to Layers**
6. Edit the generated layers directly in Figma

## Project Structure

```
├── manifest.json              # Figma plugin manifest
├── package.json
├── tsconfig.json
├── webpack.config.js
├── src/
│   ├── main.ts                # Plugin controller (Figma API thread)
│   ├── ui/
│   │   ├── ui.html            # Plugin UI (drop zone, settings, progress)
│   │   └── ui-entry.ts        # Webpack entry for UI bundle
│   └── analysis/
│       ├── color-quantizer.ts # Color segmentation & region merging
│       ├── shape-detector.ts  # Shape classification & hierarchy
│       └── layer-generator.ts # Figma layer descriptor generation
└── dist/                      # Built output (main.js, ui.html)
```

## Development

```bash
npm run watch   # Rebuild on file changes
npm run build   # Production build
```
