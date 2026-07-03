"""
Convert the existing Keras HDF5 model into TensorFlow.js format.

Usage:
    python scripts/convert_model.py /path/to/mnist_model.h5 model

Install requirements first:
    pip install tensorflow tensorflowjs h5py
"""
from __future__ import annotations
import importlib
import sys
import types
from pathlib import Path


def get_keras_converter():
    """Load only TF.js' Keras converter.

    tensorflowjs' package initializer imports optional TensorFlow Decision
    Forests support. That dependency has no Windows wheel, even though it is
    unrelated to converting a Keras HDF5 model.
    """
    try:
        from tensorflowjs.converters.keras_h5_conversion import save_keras_model
        return save_keras_model
    except ModuleNotFoundError as error:
        if error.name != "tensorflow_decision_forests":
            raise

    spec = importlib.util.find_spec("tensorflowjs")
    if spec is None or not spec.submodule_search_locations:
        raise RuntimeError("tensorflowjs is not installed")

    package = types.ModuleType("tensorflowjs")
    package.__path__ = list(spec.submodule_search_locations)
    sys.modules["tensorflowjs"] = package
    module = importlib.import_module("tensorflowjs.converters.keras_h5_conversion")
    return module.save_keras_model

def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python scripts/convert_model.py /path/to/mnist_model.h5 output_model_directory")
        return 2

    h5_path = Path(sys.argv[1]).expanduser().resolve()
    output_dir = Path(sys.argv[2]).expanduser().resolve()

    if not h5_path.is_file():
        print(f"Model file not found: {h5_path}")
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)

    import tensorflow as tf
    save_keras_model = get_keras_converter()

    print(f"Loading: {h5_path}")
    model = tf.keras.models.load_model(h5_path, compile=False)
    print("Input shape:", model.inputs[0].shape)
    print("Output shape:", model.outputs[0].shape)

    print(f"Saving TensorFlow.js model into: {output_dir}")
    save_keras_model(model, str(output_dir))
    print("Done. Confirm that model.json and .bin shard file(s) exist.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
