import os
import io
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, render_template, send_from_directory
import tensorflow as tf

app = Flask(__name__, static_folder='.', template_folder='.')

# Set relative path based on app directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "cnn_mnist_model.h5")
model = None

def load_keras_model():
    """Load the trained Keras CNN model if available."""
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = tf.keras.models.load_model(MODEL_PATH)
            print(f"Model successfully loaded from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading model: {e}")
    else:
        print(f"Warning: {MODEL_PATH} not found. Running in demo/mock mode.")

# Call immediately so Gunicorn loads the model on Render boot
load_keras_model()

def preprocess_image(image_bytes):
    """
    Preprocess user input image to match MNIST CNN model input:
    - Convert to Grayscale
    - Resize to 28x28
    - Invert colors if necessary (MNIST uses white text on black background)
    - Normalize pixel values to [0, 1]
    - Reshape to (1, 28, 28, 1)
    """
    img = Image.open(io.BytesIO(image_bytes)).convert('L')
    
    # Resize to 28x28
    img = img.resize((28, 28), Image.Resampling.LANCZOS)
    
    img_array = np.array(img, dtype='float32')
    
    # Invert image if background is white (average pixel value > 127)
    if np.mean(img_array) > 127:
        img_array = 255.0 - img_array
        
    # Normalize pixel values
    img_array = img_array / 255.0
    
    # Reshape for CNN input: (batch_size, height, width, channels)
    img_tensor = img_array.reshape(1, 28, 28, 1)
    return img_tensor

@app.route('/')
def index():
    """Serve the index.html template."""
    return render_template('index.html')

@app.route('/style.css')
def serve_css():
    """Serve static CSS file."""
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def serve_js():
    """Serve static JavaScript file."""
    return send_from_directory('.', 'script.js')

@app.route('/predict', methods=['POST'])
def predict():
    """API Endpoint to process image and return predictions."""
    if 'image' not in request.files and 'file' not in request.files:
        return jsonify({'error': 'No image file provided in request'}), 400
    
    file = request.files.get('image') or request.files.get('file')
    if file.filename == '':
        return jsonify({'error': 'Empty filename provided'}), 400

    try:
        image_bytes = file.read()
        input_tensor = preprocess_image(image_bytes)
        
        if model is not None:
            # Predict with the loaded Keras CNN model
            predictions = model.predict(input_tensor)[0]
            predicted_class = int(np.argmax(predictions))
            confidence = float(np.max(predictions))
            probabilities = [float(p) for p in predictions]
        else:
            # Mock response if model file is not saved yet
            predicted_class = 7
            confidence = 0.985
            probabilities = [0.001, 0.002, 0.001, 0.003, 0.002, 0.001, 0.005, 0.985, 0.001, 0.001]

        return jsonify({
            'success': True,
            'prediction': predicted_class,
            'confidence': confidence,
            'probabilities': probabilities
        })

    except Exception as e:
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)