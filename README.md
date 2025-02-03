# Image Entropy Analyzer

A versatile JavaScript library for analyzing image entropy and intelligently positioning/cropping images based on regions of high visual interest. 

## Features

- 🔍 Analyzes image entropy to identify visually interesting regions
- 🖼️ Calculates optimal image positioning and cropping parameters
- 🔄 Automatic environment detection and appropriate resizing method selection
- 📏 Respects minimum visible image area constraints
- 🎯 Generates both CSS positioning and Sharp.js parameters
- 🔗 Supports chained API operations
- 🎨 Debug visualization mode for entropy regions

## Installation

```bash
npm install image-entropy-analyzer
```


## Usage

### Basic Usage

```javascript
const analyzer = new ImageEntropyAnalyzer();

// With direct image URL
analyzer.analyze('path/to/image.jpg', {
  containerDimensions: { width: 800, height: 600 },
  minPercentage: 60
})
.then(async analyzer => {
  // Get analysis results
  const { cssImage, resizedImage } = analyzer.analysisResult;
  
  // Apply CSS positioning
  const container = document.querySelector('.image-container');
  Object.assign(container.style, cssImage);
  
  // Get resized image
  const resizedImg = await analyzer.resize();
  document.body.appendChild(resizedImg);
});

// With DOM element (automatically gets image and dimensions)
const imageContainer = document.querySelector('.image-container');
analyzer.analyze(imageContainer)
.then(async analyzer => {
  const { cssImage } = analyzer.analysisResult;
  Object.assign(imageContainer.style, cssImage);
});


```

### Configuration Options

```javascript
const analyzer = new ImageEntropyAnalyzer({
  blockSize: 16,        // Size of blocks for entropy analysis
  highEntropyThreshold: 0.2,  // Top 20% of regions considered high entropy
  debug: true          // Enable visual debug overlay
});
```

### Analysis Options

```javascript
analyzer.analyze(imageUrl, {
  containerDimensions: {
    width: 800,    // Target container width
    height: 600    // Target container height
  },
  minPercentage: 60    // Minimum percentage of image to show (default: 50)
});
```

### Analysis Result Structure

```javascript
{
  cssImage: {
    width: "1200px",
    height: "800px",
    position: "absolute",
    left: "-200px",
    top: "-100px",
    backgroundPosition: "60% 40%",
    objectFit: "cover"
  },
  resizedImage: {
    width: 800,
    height: 600,
    fit: "cover",
    position: {
      left: 100,
      top: 50,
      width: 600,
      height: 450
    }
  },
  entropyMap: [...],  // Array of high entropy regions
  entropyCenter: { x: 320, y: 240 },  // Weighted center of entropy
  originalSize: { width: 1000, height: 750 }
}
```

## API Reference

### Constructor

```javascript
const analyzer = new ImageEntropyAnalyzer(options?)
```

Options:
- `blockSize`: Size of blocks for entropy analysis (default: 16)
- `highEntropyThreshold`: Proportion of high entropy regions to consider (default: 0.2)
- `debug`: Enable debug visualization (default: false)

### Methods

#### analyze(source, options?)

Analyzes the image and returns the analyzer instance for chaining.

Parameters:
- `source`: Can be either:
  - Path or URL to the image
  - DOM element (img tag or element with background-image)
- `options`: 
  - `containerDimensions`: Target container size (optional, automatically inferred if DOM element provided)
  - `minPercentage`: Minimum visible image percentage (default: 50)

When passing a DOM element:
- Automatically extracts image URL from src attribute or background-image
- Infers container dimensions if not explicitly provided
- Works with both <img> tags and elements using background-image

Returns: Promise<ImageEntropyAnalyzer>

#### resize()

Resizes the image based on analysis results.

Returns: Promise<Image>

## Advanced Usage Examples

### Custom Container Sizing

```javascript
const analyzer = new ImageEntropyAnalyzer();

analyzer.analyze('image.jpg', {
  containerDimensions: { width: 1200, height: 800 },
  minPercentage: 75  // Show at least 75% of the image
})
.then(async analyzer => {
  const { cssImage, resizedImage } = analyzer.analysisResult;
  
  // Apply positioning
  const container = document.querySelector('.image-container');
  Object.assign(container.style, cssImage);
  
  // Container should be positioned relative
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
});
```

### Debug Visualization

```javascript
const analyzer = new ImageEntropyAnalyzer({
  debug: true,
  blockSize: 32  // Larger blocks for visualization
});

analyzer.analyze('image.jpg')
  .then(analyzer => {
    // Debug overlay will be added to document
    // Yellow regions show high entropy areas
    // Red dot shows weighted center
  });
```

### Processing Multiple Images

```javascript
async function processImages(images) {
  const analyzer = new ImageEntropyAnalyzer();
  
  const results = await Promise.all(
    images.map(async img => {
      const instance = await analyzer.analyze(img, {
        containerDimensions: { width: 800, height: 600 }
      });
      return await instance.resize();
    })
  );
  
  return results;
}
```

## Environment Support

### Browser
- Uses Canvas API for image processing
- Returns Image instances from resize()
- Supports debug visualization
- Works with URLs and data URLs


## Error Handling

```javascript
try {
  const analyzer = new ImageEntropyAnalyzer();
  const instance = await analyzer.analyze('image.jpg');
  const result = await instance.resize();
} catch (error) {
  if (error.message.includes('Sharp operation failed')) {
    // Handle Sharp-specific errors
  } else {
    // Handle general errors
  }
}
```

## Performance Considerations

- Adjust `blockSize` based on image size and performance needs
- Larger block sizes = faster analysis but less precise
- Debug mode adds overhead - disable in production
- Consider using Web Workers for browser processing of large images

## License

MIT
