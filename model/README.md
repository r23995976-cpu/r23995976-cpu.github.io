# Model folder

This folder contains the converted TensorFlow.js model:

```text
model/
  model.json
  group1-shard1of1.bin
```

The browser loads `model.json`; it does not load or ship the original HDF5 file.

Use `../scripts/convert_model.py` from the project root:

```bash
python scripts/convert_model.py /path/to/mnist_model.h5 model
```

Then serve the project using GitHub Pages, VS Code Live Server, or `python -m http.server`.
