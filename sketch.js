let img, detector, isModelLoaded = false;
let statusElement, resultsElement, dropArea, fileInput, fileButton, canvasContainer;
let currentP5Instance = null;

// Cache DOM elements once they're available
document.addEventListener('DOMContentLoaded', function() {
  statusElement = document.getElementById('status');
  resultsElement = document.getElementById('results');
  dropArea = document.getElementById('drop-area');
  fileInput = document.getElementById('file-input');
  fileButton = document.getElementById('file-button');
  canvasContainer = document.getElementById('canvas-container');
  
  // Set up event listeners for drag and drop
  setupDragAndDrop();
  
  // Set up file input button
  fileButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  });
  
  // Load the COCO-SSD model
  loadModel();
  
  // Create an initial empty canvas
  createEmptyCanvas();
});

function createEmptyCanvas() {
  // Remove any existing canvas
  while (canvasContainer.firstChild) {
    canvasContainer.removeChild(canvasContainer.firstChild);
  }
  
  // Create an empty div to hold the canvas
  const canvasHolder = document.createElement('div');
  canvasHolder.id = 'p5-canvas-holder';
  canvasHolder.style.width = '100%';
  canvasHolder.style.height = '100%';
  canvasContainer.appendChild(canvasHolder);
}

function loadModel() {
  statusElement.textContent = "Loading model...";
  // Initialize ml5 object detector
  detector = ml5.objectDetector('cocossd', modelReady);
}

function modelReady() {
  isModelLoaded = true;
  statusElement.textContent = "Model loaded! Drop an image or select one to detect objects.";
}

function setupDragAndDrop() {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop area when dragging over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  // Handle dropped files
  dropArea.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropArea.classList.add('highlight');
}

function unhighlight() {
  dropArea.classList.remove('highlight');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const file = dt.files[0];
  
  if (file && file.type.startsWith('image/')) {
    handleFile(file);
  } else {
    statusElement.textContent = "Please drop an image file.";
  }
}

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    statusElement.textContent = "Selected file is not an image.";
    return;
  }
  
  // Show loading status
  statusElement.textContent = "Loading image...";
  
  // Clean up any existing p5 instance
  if (currentP5Instance) {
    currentP5Instance.remove();
    currentP5Instance = null;
  }
  
  // Create a new canvas holder
  createEmptyCanvas();
  
  // Read the file
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageDataUrl = e.target.result;
    
    // Create a temporary image to get dimensions
    const tempImg = new Image();
    tempImg.onload = function() {
      // Initialize a new p5 instance
      currentP5Instance = new p5(function(p) {
        let loadedImage = null;
        
        p.preload = function() {
          loadedImage = p.loadImage(imageDataUrl);
        };
        
        p.setup = function() {
          // Get container dimensions
          const containerWidth = document.getElementById('p5-canvas-holder').offsetWidth;
          let canvasHeight = Math.min(600, containerWidth * 0.75);
          
          // Create canvas
          const canvas = p.createCanvas(containerWidth, canvasHeight);
          canvas.parent('p5-canvas-holder');
          
          // Set initial background
          p.background(240);
          
          // Process the image once it's loaded
          if (loadedImage) {
            processLoadedImage(p, loadedImage);
          } else {
            statusElement.textContent = "Error loading image.";
          }
        };
        
        function processLoadedImage(p, loadedImg) {
          img = loadedImg;
          
          // Calculate scaling factor to fit canvas
          const scaleWidth = p.width / img.width;
          const scaleHeight = p.height / img.height;
          const scale = Math.min(scaleWidth, scaleHeight, 1.0); // Don't upscale images
          
          // Calculate display dimensions
          const displayWidth = img.width * scale;
          const displayHeight = img.height * scale;
          
          // Center image on canvas
          const xOffset = (p.width - displayWidth) / 2;
          const yOffset = (p.height - displayHeight) / 2;
          
          // Draw the image
          p.clear();
          p.background(240);
          p.image(img, xOffset, yOffset, displayWidth, displayHeight);
          
          // Store these values for detection drawing
          img.displayWidth = displayWidth;
          img.displayHeight = displayHeight;
          img.xOffset = xOffset;
          img.yOffset = yOffset;
          
          // Perform object detection if model is loaded
          if (isModelLoaded) {
            statusElement.textContent = "Detecting objects...";
            detector.detect(img, function(err, results) {
              if (err) {
                console.error("Detection error:", err);
                statusElement.textContent = "Error detecting objects.";
                return;
              }
              
              // Draw detection boxes
              drawDetections(p, results);
              
              // Display results in text form
              displayResults(results);
            });
          } else {
            statusElement.textContent = "Model not loaded yet. Please wait and try again.";
          }
        }
      }, 'p5-canvas-holder');
    };
    
    tempImg.src = imageDataUrl;
  };
  
  reader.onerror = function() {
    statusElement.textContent = "Error reading the file.";
  };
  
  reader.readAsDataURL(file);
}

function drawDetections(p, results) {
  if (!img || !results) return;
  
  if (results.length > 0) {
    statusElement.textContent = `Detected ${results.length} object(s)!`;
    
    // Calculate scaling factors
    const scaleX = img.displayWidth / img.width;
    const scaleY = img.displayHeight / img.height;
    
    results.forEach(detection => {
      // Scale the detection box coordinates
      const x = detection.x * scaleX + img.xOffset;
      const y = detection.y * scaleY + img.yOffset;
      const w = detection.width * scaleX;
      const h = detection.height * scaleY;
      
      // Draw bounding box
      p.push();
      p.noFill();
      p.strokeWeight(3);
      p.stroke(255, 0, 0);
      p.rect(x, y, w, h);
      
      // Background for text
      p.fill(0, 0, 0, 200);
      p.noStroke();
      p.rect(x, y - 25, w, 25);
      
      // Label text
      p.fill(255);
      p.textSize(16);
      p.textAlign(p.LEFT, p.CENTER);
      p.text(
        `${detection.label} (${Math.round(detection.confidence * 100)}%)`, 
        x + 5, 
        y - 12
      );
      p.pop();
    });
  } else {
    statusElement.textContent = "No objects detected in this image.";
  }
}

function displayResults(results) {
  resultsElement.innerHTML = "";
  
  if (!results || results.length === 0) {
    resultsElement.textContent = "No objects were detected in this image.";
    return;
  }
  
  const heading = document.createElement('h3');
  heading.textContent = "Detection Results:";
  resultsElement.appendChild(heading);
  
  const list = document.createElement('ul');
  results.forEach(detection => {
    const item = document.createElement('li');
    item.textContent = `${detection.label}: ${Math.round(detection.confidence * 100)}% confidence`;
    list.appendChild(item);
  });
  
  resultsElement.appendChild(list);
}

// Handle window resize
window.addEventListener('resize', function() {
  if (img && fileInput.files.length > 0) {
    // Re-process the current file on window resize
    setTimeout(() => handleFile(fileInput.files[0]), 300);
  }
});
