const $ = (s) => document.querySelector(s);

const heroGrid = $("#heroGrid");
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
pattern.forEach(v => { const i=document.createElement("i"); if(v)i.className="on"; heroGrid.appendChild(i); });

let accuracyChart;
const ctx = $("#accuracyChart");
if (ctx && window.Chart) {
  accuracyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["1","2","3","4","5"],
      datasets: [
        {label:"Perceptron", data:[0.83,0.86,0.87,0.87,0.87], borderColor:"#ff8f9f", backgroundColor:"transparent", tension:.35, pointRadius:2},
        {label:"ANN", data:[0.93,0.96,0.97,0.97,0.98], borderColor:"#66b3ff", backgroundColor:"transparent", tension:.35, pointRadius:2},
        {label:"CNN", data:[0.96,0.98,0.99,0.99,0.99], borderColor:"#a9ff68", backgroundColor:"transparent", tension:.35, pointRadius:2}
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:"rgba(255,255,255,.045)"},ticks:{color:"#686f80",font:{size:9}}},
        y:{min:.75,max:1,grid:{color:"rgba(255,255,255,.045)"},ticks:{color:"#686f80",font:{size:9},callback:v=>Math.round(v*100)+"%"}}
      }
    }
  });
}

const fileInput = $("#fileInput");
const dropZone = $("#dropZone");
const browseBtn = $("#browseBtn");
const clearBtn = $("#clearBtn");
const predictBtn = $("#predictBtn");
const canvas = $("#previewCanvas");
const emptyPreview = $("#emptyPreview");
const ctx2 = canvas.getContext("2d");

browseBtn.addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => e.target.files[0] && loadImage(e.target.files[0]));

["dragenter","dragover"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.add("dragover");
}));
["dragleave","drop"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if(file && file.type.startsWith("image/")) loadImage(file);
});

function loadImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const size = Math.min(img.width, img.height);
    const sx = (img.width-size)/2, sy=(img.height-size)/2;
    ctx2.clearRect(0,0,280,280);
    ctx2.fillStyle="#fff"; ctx2.fillRect(0,0,280,280);
    ctx2.drawImage(img,sx,sy,size,size,0,0,280,280);
    canvas.style.display="block";
    emptyPreview.style.display="none";
    $("#apiStatus").textContent="IMAGE READY";
    $("#predictedDigit").textContent="—";
    $("#confidenceValue").textContent="—";
    $("#confidenceBar").style.width="0";
    buildProbabilities([]);
    URL.revokeObjectURL(url);
  };
  img.src=url;
}

clearBtn.addEventListener("click", () => {
  ctx2.clearRect(0,0,280,280);
  canvas.style.display="none";
  emptyPreview.style.display="flex";
  $("#apiStatus").textContent="DEMO MODE";
  $("#predictedDigit").textContent="—";
  $("#confidenceValue").textContent="—";
  $("#confidenceBar").style.width="0";
  buildProbabilities([]);
  fileInput.value="";
});

function buildProbabilities(probs){
  const el=$("#probabilityList");
  el.innerHTML="";
  for(let i=0;i<10;i++){
    const d=document.createElement("div");
    const p=probs[i] ?? 0;
    d.innerHTML=`<b>${i}</b>${p ? (p*100).toFixed(0)+"%" : "—"}`;
    el.appendChild(d);
  }
}
buildProbabilities([]);

predictBtn.addEventListener("click", async () => {
  if (canvas.style.display === "none") {
    $("#apiStatus").textContent = "ADD IMAGE";
    return;
  }

  // Convert canvas to Blob using a Promise to keep try...catch working
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

  const form = new FormData();
  form.append("file", blob, "digit.png");

  try {
    const response = await fetch("/predict", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error("No prediction endpoint or server error");
    }

    const data = await response.json();
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
    $("#apiStatus").textContent = "LIVE MODEL";
  } catch (err) {
    console.warn("Prediction fetch failed:", err);
    demoPrediction();
  }
});

function demoPrediction(){
  // Front-end preview only. This deliberately does not claim a real CNN prediction.
  $("#apiStatus").textContent="DEMO ONLY";
  $("#predictedDigit").textContent="?";
  $("#confidenceValue").textContent="Connect /predict";
  $("#confidenceBar").style.width="0";
  buildProbabilities([]);
}

function showResult(digit, confidence, probs){
  $("#predictedDigit").textContent=digit;
  $("#confidenceValue").textContent=(confidence*100).toFixed(1)+"%";
  $("#confidenceBar").style.width=Math.min(100,confidence*100)+"%";
  buildProbabilities(probs);
}
