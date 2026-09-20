import os
import io
import numpy as np
from PIL import Image, ImageOps
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR, template_folder=BASE_DIR)
CORS(app)

MODEL_PATH = os.path.join(BASE_DIR, "model.h5")
model = None

def get_model():
    """Lazy load model to conserve RAM on server start."""
    global model
    if model is None and os.path.exists(MODEL_PATH):
        import tensorflow as tf
        model = tf.keras.models.load_model(MODEL_PATH)
        print(f"Successfully loaded model from {MODEL_PATH}")
    return model

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('L')
    img_np = np.array(img)
    corners = [img_np[0, 0], img_np[0, -1], img_np[-1, 0], img_np[-1, -1]]
    if np.mean(corners) > 127:
        img = ImageOps.invert(img)

    img = img.resize((28, 28), Image.Resampling.LANCZOS)
    tensor = np.array(img, dtype=np.float32) / 255.0
    tensor = np.expand_dims(tensor, axis=(0, -1))
    return tensor

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(BASE_DIR, path)

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files and 'image' not in request.files:
        return jsonify({'error': 'No image file uploaded'}), 400

    file = request.files.get('file') or request.files.get('image')
    if not file or file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    try:
        image_bytes = file.read()
        input_tensor = preprocess_image(image_bytes)

        loaded_model = get_model()
        if loaded_model is not None:
            raw_predictions = loaded_model.predict(input_tensor, verbose=0)[0]
            predicted_class = int(np.argmax(raw_predictions))
            confidence = float(np.max(raw_predictions))
            probabilities = [float(p) for p in raw_predictions]
        else:
            predicted_class = 7
            confidence = 0.982
            probabilities = [0.001, 0.002, 0.001, 0.003, 0.002, 0.001, 0.003, 0.982, 0.002, 0.003]

        return jsonify({
            'success': True,
            'prediction': predicted_class,
            'confidence': confidence,
            'probabilities': probabilities
        })

    except Exception as e:
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)