const $ = (s) => document.querySelector(s);

// --- Hero Grid Background ---
const heroGrid = $("#heroGrid");
if (heroGrid) {
  const pattern = [
    0,0,1,1,1,0,0,0,
    0,1,1,0,0,1,0,0,
    0,0,0,0,1,1,0,0,
    0,0,0,1,1,0,0,0,
    0,0,1,1,0,0,0,0,
    0,1,1,0,0,0,0,0,
    0,1,0,0,0,0,0,0,
    0,1,1,1,1,1,1,0
  ];
  pattern.forEach(v => {
    const i = document.createElement("i");
    if (v) i.className = "on";
    heroGrid.appendChild(i);
  });
}

// --- Validation Accuracy Chart ---
let accuracyChart;
const ctx = $("#accuracyChart");
if (ctx && window.Chart) {
  accuracyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["1", "2", "3", "4", "5"],
      datasets: [
        { label: "Perceptron", data: [0.83, 0.86, 0.87, 0.87, 0.87], borderColor: "#ff8f9f", backgroundColor: "transparent", tension: 0.35, pointRadius: 2 },
        { label: "ANN", data: [0.93, 0.96, 0.97, 0.97, 0.98], borderColor: "#66b3ff", backgroundColor: "transparent", tension: 0.35, pointRadius: 2 },
        { label: "CNN", data: [0.96, 0.98, 0.99, 0.99, 0.99], borderColor: "#a9ff68", backgroundColor: "transparent", tension: 0.35, pointRadius: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,.045)" }, ticks: { color: "#686f80", font: { size: 9 } } },
        y: { min: 0.75, max: 1, grid: { color: "rgba(255,255,255,.045)" }, ticks: { color: "#686f80", font: { size: 9 }, callback: v => Math.round(v * 100) + "%" } }
      }
    }
  });
}

// --- DOM References ---
const fileInput = $("#fileInput");
const dropZone = $("#dropZone");
const browseBtn = $("#browseBtn");
const clearBtn = $("#clearBtn");
const predictBtn = $("#predictBtn");
const canvas = $("#previewCanvas");
const emptyPreview = $("#emptyPreview");
const ctx2 = canvas ? canvas.getContext("2d") : null;

// --- Image Loading & File Handlers ---

// 1. "Choose Image" Button Handler
if (browseBtn && fileInput) {
  browseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevents double trigger from parent dropZone click
    fileInput.click();
  });
}

// 2. Drop Zone Click & Drag-and-Drop Handlers
if (dropZone && fileInput) {
  dropZone.addEventListener("click", () => fileInput.click());

  ["dragenter", "dragover"].forEach(ev => dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  }));

  ["dragleave", "drop"].forEach(ev => dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  }));

  dropZone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImage(file);
  });
}

// 3. File Input Change Handler
if (fileInput) {
  fileInput.addEventListener("change", e => {
    if (e.target.files && e.target.files[0]) {
      loadImage(e.target.files[0]);
    }
  });
}

/**
 * Loads an image file onto the preview canvas
 */
function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2;
    const sy = (img.height - size) / 2;

    // Reset canvas dimensions
    canvas.width = 280;
    canvas.height = 280;

    // Fill white background first
    ctx2.fillStyle = "#ffffff";
    ctx2.fillRect(0, 0, 280, 280);

    // Draw centered image square
    ctx2.drawImage(img, sx, sy, size, size, 0, 0, 280, 280);

    // Update UI visibility
    canvas.style.display = "block";
    if (emptyPreview) emptyPreview.style.display = "none";

    updateStatus("IMAGE READY");
    resetPredictionUI();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// 4. Clear Button Handler
if (clearBtn) {
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (ctx2) ctx2.clearRect(0, 0, 280, 280);
    if (canvas) canvas.style.display = "none";
    if (emptyPreview) emptyPreview.style.display = "flex";

    updateStatus("DEMO MODE");
    resetPredictionUI();
    if (fileInput) fileInput.value = "";
  });
}

/**
 * Renders probability bars/percentages for digits 0-9
 */
function buildProbabilities(probs) {
  const el = $("#probabilityList");
  if (!el) return;
  el.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const d = document.createElement("div");
    const p = probs[i] ?? 0;
    d.innerHTML = `<b>${i}</b>${p ? (p * 100).toFixed(0) + "%" : "—"}`;
    el.appendChild(d);
  }
}
buildProbabilities([]);

// --- Prediction Trigger ---
if (predictBtn) {
  predictBtn.addEventListener("click", async () => {
    if (!canvas || canvas.style.display === "none") {
      updateStatus("ADD IMAGE");
      return;
    }

    updateStatus("PREDICTING...");

    // Convert Canvas to Blob
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    const form = new FormData();
    form.append("file", blob, "digit.png");
    form.append("image", blob, "digit.png");

    // Dynamic Endpoint Resolution:
    // If testing on VS Code Live Server (port 5500/5501), target localhost:5000.
    // When served via Flask directly or on Render, use relative path '/predict'.
    const isLiveServer = window.location.port === "5500" || window.location.port === "5501";
    const API_ENDPOINT = isLiveServer ? "http://127.0.0.1:5000/predict" : "/predict";

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        throw new Error(`Server status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const probs = Array.isArray(data.probabilities) ? data.probabilities : [];
      const digit = Number.isFinite(data.prediction)
        ? data.prediction
        : probs.length
        ? probs.indexOf(Math.max(...probs))
        : "—";
      const confidence = probs.length
        ? Math.max(...probs)
        : Number(data.confidence || 0);

      showResult(digit, confidence, probs);
      updateStatus("LIVE MODEL");

    } catch (err) {
      console.warn("Prediction endpoint request failed:", err);
      demoPrediction();
    }
  });
}

// --- UI Output Functions ---
function demoPrediction() {
  updateStatus("DEMO ONLY");
  if ($("#predictedDigit")) $("#predictedDigit").textContent = "?";
  if ($("#confidenceValue")) $("#confidenceValue").textContent = "Connect /predict";
  if ($("#confidenceBar")) $("#confidenceBar").style.width = "0%";
  buildProbabilities([]);
}

function showResult(digit, confidence, probs) {
  if ($("#predictedDigit")) $("#predictedDigit").textContent = digit;
  if ($("#confidenceValue")) $("#confidenceValue").textContent = (confidence * 100).toFixed(1) + "%";
  if ($("#confidenceBar")) $("#confidenceBar").style.width = Math.min(100, confidence * 100) + "%";
  buildProbabilities(probs);
}

function resetPredictionUI() {
  if ($("#predictedDigit")) $("#predictedDigit").textContent = "—";
  if ($("#confidenceValue")) $("#confidenceValue").textContent = "—";
  if ($("#confidenceBar")) $("#confidenceBar").style.width = "0%";
  buildProbabilities([]);
}

function updateStatus(text) {
  const el = $("#apiStatus");
  if (el) el.textContent = text;
}