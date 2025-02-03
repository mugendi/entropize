/**
 * Copyright (c) 2025 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

export default class ImageEntropyAnalyzer {
  constructor(options = {}) {
    this.blockSize = options.blockSize || 16;
    this.highEntropyThreshold = options.highEntropyThreshold || 0.2;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.debug = options.debug || false;
    this.analysisResult = null;
    this.imageSource = null;
  }

  // Extract image URL from CSS background-image
  static extractImageUrl(cssValue) {
    if (!cssValue) return null;

    // Match url("...") or url('...') or url(...)
    const matches = cssValue.match(/url\(['"]?(.*?)['"]?\)/);
    if (!matches) return null;

    return matches[1];
  }

  // Get computed dimensions of an element
  static getElementDimensions(element) {
    if (!element) return null;

    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
      // Include padding and border if box-sizing is content-box
      ...(computedStyle.boxSizing === 'content-box' && {
        width:
          rect.width -
          parseFloat(computedStyle.paddingLeft) -
          parseFloat(computedStyle.paddingRight) -
          parseFloat(computedStyle.borderLeftWidth) -
          parseFloat(computedStyle.borderRightWidth),
        height:
          rect.height -
          parseFloat(computedStyle.paddingTop) -
          parseFloat(computedStyle.paddingBottom) -
          parseFloat(computedStyle.borderTopWidth) -
          parseFloat(computedStyle.borderBottomWidth),
      }),
    };
  }

  // Extract image source from DOM element
  static getImageFromElement(element) {
    if (!element) return null;

    const computedStyle = window.getComputedStyle(element);

    // Check for background-image
    const bgImage = this.extractImageUrl(computedStyle.backgroundImage);
    if (bgImage && bgImage !== 'none') return bgImage;

    // Check if element is an img tag
    if (element.tagName.toLowerCase() === 'img') {
      return element.src;
    }

    // Check for inline style background-image
    const inlineBg = this.extractImageUrl(element.style.backgroundImage);
    if (inlineBg && inlineBg !== 'none') return inlineBg;

    return null;
  }

  // Check if we're in a browser environment
  static isBrowser() {
    return (
      typeof window !== 'undefined' && typeof window.document !== 'undefined'
    );
  }

  // Create a new canvas with given dimensions
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Browser-based image resizing using canvas
  async resizeInBrowser(params) {
    const { width, height, position } = params;

    // Create source canvas for original image
    const sourceCanvas = this.createCanvas(
      this.analysisResult.originalSize.width,
      this.analysisResult.originalSize.height
    );
    const sourceCtx = sourceCanvas.getContext('2d');

    // Load original image
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = this.imageSource;
    });

    sourceCtx.drawImage(img, 0, 0);

    // Create destination canvas with target dimensions
    const destCanvas = this.createCanvas(width, height);
    const destCtx = destCanvas.getContext('2d');

    // Extract and resize the region of interest
    destCtx.drawImage(
      sourceCanvas,
      position.left,
      position.top,
      position.width,
      position.height,
      0,
      0,
      width,
      height
    );

    // Convert to image
    const resultImage = new Image();
    await new Promise((resolve, reject) => {
      resultImage.onload = resolve;
      resultImage.onerror = reject;
      resultImage.src = destCanvas.toDataURL('image/jpeg', 0.95);
    });

    return resultImage;
  }

  async analyze(source, options = {}) {
    let imageUrl;
    // Handle DOM element input
    if (source instanceof Element) {
      // Get image URL from element
      imageUrl = ImageEntropyAnalyzer.getImageFromElement(source);
      if (!imageUrl) {
        throw new Error('Could not find image source in provided element');
      }

      // Get container dimensions if not provided
      if (!options.containerDimensions) {
        options.containerDimensions =
          ImageEntropyAnalyzer.getElementDimensions(source);
      }

      this.imageSource = imageUrl;
    } else {
      // Direct image URL input
      this.imageSource = source;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        // Previous analyze code remains the same
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const imageData = this.ctx.getImageData(
          0,
          0,
          this.canvas.width,
          this.canvas.height
        );
        const entropyValues = [];

        for (let y = 0; y < this.canvas.height; y += this.blockSize) {
          for (let x = 0; x < this.canvas.width; x += this.blockSize) {
            const entropy = this.calculateEntropy(imageData, x, y);
            entropyValues.push({ x, y, entropy });
          }
        }

        const sortedRegions = entropyValues.sort(
          (a, b) => b.entropy - a.entropy
        );
        const topRegions = sortedRegions.slice(
          0,
          Math.floor(sortedRegions.length * this.highEntropyThreshold)
        );

        const totalEntropy = topRegions.reduce(
          (sum, region) => sum + region.entropy,
          0
        );
        const centerX =
          topRegions.reduce(
            (sum, region) => sum + region.x * region.entropy,
            0
          ) / totalEntropy;
        const centerY =
          topRegions.reduce(
            (sum, region) => sum + region.y * region.entropy,
            0
          ) / totalEntropy;

        const imageSize = { width: img.width, height: img.height };
        const positioning = this.calculateOptimalCrop(
          imageSize,
          options.containerDimensions,
          { x: centerX, y: centerY },
          options.minPercentage
        );

        if (this.debug) {
          this.visualizeRegions(img, topRegions, { x: centerX, y: centerY });
        }

        // Store the analysis result for chaining
        this.analysisResult = {
          ...positioning,
          entropyMap: topRegions,
          entropyCenter: { x: centerX, y: centerY },
          originalSize: imageSize,
        };

        resolve(this);
      };

      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  async resize() {
    if (!this.analysisResult) {
      throw new Error('Must call analyze() before resize()');
    }

    const params = this.analysisResult.resizedImage;

    return await this.resizeInBrowser(params);
  }

  calculateEntropy(imageData, x, y) {
    const histogram = new Array(256).fill(0);
    const width = imageData.width;

    for (let i = 0; i < this.blockSize; i++) {
      for (let j = 0; j < this.blockSize; j++) {
        if (x + i < width && y + j < imageData.height) {
          const idx = ((y + j) * width + (x + i)) * 4;
          const gray = Math.round(
            0.299 * imageData.data[idx] +
              0.587 * imageData.data[idx + 1] +
              0.114 * imageData.data[idx + 2]
          );
          histogram[gray]++;
        }
      }
    }

    let entropy = 0;
    const totalPixels = this.blockSize * this.blockSize;

    histogram.forEach((count) => {
      if (count > 0) {
        const probability = count / totalPixels;
        entropy -= probability * Math.log2(probability);
      }
    });

    return entropy;
  }

  calculateOptimalCrop(
    imageSize,
    containerSize,
    entropyCenter,
    minPercentage = 50
  ) {
    const { width: imgWidth, height: imgHeight } = imageSize;
    const { width: contWidth, height: contHeight } = containerSize || {
      width: imgWidth,
      height: imgHeight,
    };

    // Convert minPercentage to decimal
    const minPercent = minPercentage / 100;

    // Calculate minimum visible dimensions based on minPercentage
    const minVisibleWidth = imgWidth * minPercent;
    const minVisibleHeight = imgHeight * minPercent;

    // Calculate scale factors
    const scaleX = contWidth / imgWidth;
    const scaleY = contHeight / imgHeight;
    const scale = Math.max(scaleX, scaleY);

    // Calculate scaled dimensions
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;

    // Calculate maximum allowed offset to maintain minimum visible area
    const maxOffsetX = scaledWidth - contWidth;
    const maxOffsetY = scaledHeight - contHeight;

    // Calculate optimal position based on entropy center
    let offsetX = (entropyCenter.x / imgWidth) * scaledWidth - contWidth / 2;
    let offsetY = (entropyCenter.y / imgHeight) * scaledHeight - contHeight / 2;

    // Clamp offsets to ensure minimum visible area
    offsetX = Math.max(0, Math.min(maxOffsetX, offsetX));
    offsetY = Math.max(0, Math.min(maxOffsetY, offsetY));

    // Calculate percentages for CSS background-position
    const percentX = (offsetX / maxOffsetX) * 100 || 50;
    const percentY = (offsetY / maxOffsetY) * 100 || 50;

    // Calculate Sharp.js parameters
    const sharpParams = {
      width: contWidth,
      height: contHeight,
      fit: 'cover',
      position: {
        left: Math.round((offsetX / scaledWidth) * imgWidth),
        top: Math.round((offsetY / scaledHeight) * imgHeight),
        width: Math.round((contWidth / scaledWidth) * imgWidth),
        height: Math.round((contHeight / scaledHeight) * imgHeight),
      },
    };

    return {
      cssImage: {
        backgroundPosition: `${percentX}% ${percentY}%`,
        objectFit: 'cover',
        backgroundSize: 'cover',
      },
      resizedImage: sharpParams,
    };
  }

  visualizeRegions(img, regions, center) {
    const debugCanvas = document.createElement('canvas');
    const debugCtx = debugCanvas.getContext('2d');

    debugCanvas.width = this.canvas.width;
    debugCanvas.height = this.canvas.height;

    debugCtx.drawImage(img, 0, 0);

    // Draw entropy regions
    debugCtx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    regions.forEach((region) => {
      debugCtx.fillRect(region.x, region.y, this.blockSize, this.blockSize);
    });

    // Draw center point
    debugCtx.fillStyle = 'red';
    debugCtx.beginPath();
    debugCtx.arc(center.x, center.y, 5, 0, Math.PI * 2);
    debugCtx.fill();

    debugCanvas.style.position = 'fixed';
    debugCanvas.style.top = '10px';
    debugCanvas.style.right = '10px';
    debugCanvas.style.border = '2px solid red';
    debugCanvas.style.maxWidth = '300px';
    document.body.appendChild(debugCanvas);
  }
}
