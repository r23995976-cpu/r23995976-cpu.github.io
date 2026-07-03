const STROKE_WIDTH = 14;
const CHALK_THRESHOLD = 190;

export function createDrawingBoard(canvas, emptyMessage) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let drawing = false;
  let hasInk = false;
  let lastPoint = null;

  function reset() {
    ctx.fillStyle = "#173f38";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasInk = false;
    emptyMessage.classList.remove("hidden");
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  }

  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    drawing = true;
    lastPoint = pointFrom(event);
    try { canvas.setPointerCapture?.(event.pointerId); } catch (_) {}
    ctx.fillStyle = "#fffdf0";
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    hasInk = true;
    emptyMessage.classList.add("hidden");
  });

  canvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    event.preventDefault();
    for (const item of event.getCoalescedEvents?.() || [event]) {
      const point = pointFrom(item);
      ctx.strokeStyle = "#fffdf0";
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPoint = point;
    }
  });

  function stop(event) {
    drawing = false;
    lastPoint = null;
    try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
  }
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  function isChalk(data, index) {
    return data[index] > CHALK_THRESHOLD &&
      data[index + 1] > CHALK_THRESHOLD && data[index + 2] > CHALK_THRESHOLD;
  }

  function segmentBounds(expected) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const active = new Array(image.width).fill(false);
    for (let x = 0; x < image.width; x++) {
      for (let y = 0; y < image.height; y++) {
        if (isChalk(image.data, (y * image.width + x) * 4)) {
          active[x] = true;
          break;
        }
      }
    }
    const first = active.indexOf(true);
    const last = active.lastIndexOf(true);
    if (first < 0) throw new Error("EMPTY_CANVAS");
    if (expected === 1) return [{ left: first, right: last }];
    const gaps = [];
    for (let x = first; x <= last;) {
      if (active[x]) { x++; continue; }
      const start = x;
      while (x <= last && !active[x]) x++;
      gaps.push({ start, end: x - 1, size: x - start });
    }
    if (gaps.length < expected - 1) throw new Error("DIGITS_TOO_CLOSE");
    const cuts = gaps.sort((a, b) => b.size - a.size).slice(0, expected - 1)
      .map(gap => Math.floor((gap.start + gap.end) / 2)).sort((a, b) => a - b);
    const edges = [first, ...cuts, last];
    return Array.from({ length: expected }, (_, index) => ({
      left: index ? edges[index] + 1 : edges[index],
      right: edges[index + 1],
    }));
  }

  function tensorForSegment(segment, model) {
    const image = ctx.getImageData(segment.left, 0,
      segment.right - segment.left + 1, canvas.height);
    let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        if (isChalk(image.data, (y * image.width + x) * 4)) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) throw new Error("EMPTY_DIGIT");
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const source = document.createElement("canvas");
    source.width = width; source.height = height;
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    sourceCtx.drawImage(canvas, segment.left + minX, minY, width, height,
      0, 0, width, height);
    const pixels = sourceCtx.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = isChalk(pixels.data, i) ? 255 : 0;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    sourceCtx.putImageData(pixels, 0, 0);
    const target = document.createElement("canvas");
    target.width = target.height = 28;
    const targetCtx = target.getContext("2d", { willReadFrequently: true });
    targetCtx.fillStyle = "#000";
    targetCtx.fillRect(0, 0, 28, 28);
    const scale = Math.min(20 / width, 20 / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    targetCtx.drawImage(source, (28 - drawWidth) / 2, (28 - drawHeight) / 2,
      drawWidth, drawHeight);
    const rgba = targetCtx.getImageData(0, 0, 28, 28).data;
    const values = new Float32Array(784);
    for (let i = 0; i < 784; i++) values[i] = rgba[i * 4] / 255;
    const shape = model.inputs[0].shape;
    if (shape.length === 4) return tf.tensor4d(values, [1, 28, 28, 1]);
    if (shape.length === 3) return tf.tensor3d(values, [1, 28, 28]);
    return tf.tensor2d(values, [1, 784]);
  }

  return { reset, hasInk: () => hasInk, segmentBounds, tensorForSegment };
}
