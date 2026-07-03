const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

function readIdx(imagesPath, labelsPath) {
  const images = fs.readFileSync(imagesPath);
  const labels = fs.readFileSync(labelsPath);
  const count = images.readUInt32BE(4);
  const rows = images.readUInt32BE(8);
  const cols = images.readUInt32BE(12);
  return { count, rows, cols, images, labels };
}

(async () => {
  const root = path.resolve(__dirname, "..", "..", "handwritten_digits-main", "MNIST_ORG");
  const data = readIdx(path.join(root, "t10k-images.idx3-ubyte"), path.join(root, "t10k-labels.idx1-ubyte"));
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  const requests = [];
  page.on("request", request => requests.push(request.url()));
  page.on("console", message => console.log("browser:", message.text()));
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector("#checkButton").disabled, { timeout: 30000 });

  const results = [];
  for (let digit = 0; digit <= 9; digit++) {
    let used = 0;
    for (let index = 0; index < data.count && used < 3; index++) {
      if (data.labels[8 + index] !== digit) continue;
      const start = 16 + index * data.rows * data.cols;
      const pixels = Array.from(data.images.subarray(start, start + data.rows * data.cols));
      const prediction = await page.evaluate(async ({ pixels, expected }) => {
        const canvas = document.querySelector("#drawCanvas");
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#173f38";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = 8;
        const left = Math.floor((canvas.width - 28 * scale) / 2);
        const top = Math.floor((canvas.height - 28 * scale) / 2);
        for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
          const value = pixels[y * 28 + x];
          ctx.fillStyle = `rgb(${value},${value},${value})`;
          ctx.fillRect(left + x * scale, top + y * scale, scale, scale);
        }
        canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: left + 1, clientY: top + 1, pointerId: 1, pointerType: "touch" }));
        canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: left + 1, clientY: top + 1, pointerId: 1, pointerType: "touch" }));
        const result = await window.__dipaloTest.predictAnswer(1);
        return { expected, predicted: result.answer };
      }, { pixels, expected: digit });
      results.push(prediction);
      used++;
    }
  }


  const arithmetic = [];
  for (const [a, operation, b, answer] of [[2, "+", 3, 5], [7, "−", 4, 3], [5, "+", 1, 6]]) {
    await page.evaluate(({ a, operation, b }) => window.__dipaloTest.setQuestion(a, operation, b), { a, operation, b });
    arithmetic.push({ question: `${a} ${operation} ${b}`, answer,
      displayed: await page.$eval("#question", element => element.textContent) });
  }

  const categories = [];
  for (const category of ["addition", "subtraction", "multiplication", "division"]) {
    await page.select("#operationSelect", category);
    const generated = await page.evaluate(() => window.__dipaloTest.getCurrent());
    categories.push(generated);
    const calculated = generated.operation === "+" ? generated.a + generated.b
      : generated.operation === "−" ? generated.a - generated.b
      : generated.operation === "×" ? generated.a * generated.b : generated.a / generated.b;
    if (calculated !== generated.answer || !Number.isInteger(generated.answer)) process.exitCode = 1;
  }

  const sampleFor = digit => {
    for (let index = 0; index < data.count; index++) if (data.labels[8 + index] === digit) {
      const start = 16 + index * data.rows * data.cols;
      return Array.from(data.images.subarray(start, start + 784));
    }
    throw new Error(`No MNIST sample for ${digit}`);
  };
  const drawAnswer = async digits => page.evaluate(({ digits, samples }) => {
      const canvas = document.querySelector("#drawCanvas");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#173f38"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = 7, gap = 20, digitWidth = 28 * scale;
      const start = Math.floor((canvas.width - (digits.length * digitWidth + (digits.length - 1) * gap)) / 2);
    digits.forEach((digit, canvasIndex) => {
      const left = start + canvasIndex * (digitWidth + gap), top = 52;
      samples[canvasIndex].forEach((pixel, index) => {
        const value = pixel;
        ctx.fillStyle = `rgb(${value},${value},${value})`;
        ctx.fillRect(left + (index % 28) * scale, top + Math.floor(index / 28) * scale, scale, scale);
      });
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 1, clientY: 1, pointerId: 1, pointerType: "touch" }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { clientX: 1, clientY: 1, pointerId: 1, pointerType: "touch" }));
  }, { digits, samples: digits.map(sampleFor) });

  await page.evaluate(() => window.__dipaloTest.setQuestion(100, "+", 23));
  await drawAnswer([1, 2, 3]);
  await page.click("#checkButton");
  await new Promise(resolve => setTimeout(resolve, 500));
  const combinedAnswer = await page.$eval("#feedback", element => element.textContent);

  const layouts = [];
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
    await page.setViewport(viewport);
    const layout = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      boardWidth: document.querySelector(".practice-board").getBoundingClientRect().width
    }));
    layouts.push(layout);
    if (layout.documentWidth > layout.viewport.width) process.exitCode = 1;
  }

  console.log(JSON.stringify({ results, arithmetic, categories, combinedAnswer, layouts, requests }, null, 2));
  await browser.close();
  if (results.some(result => result.predicted !== result.expected)) process.exitCode = 1;
  if (!/Brilliant|Good|Excellent/.test(combinedAnswer)) process.exitCode = 1;
  if (requests.some(url => /\/predict|onrender\.com/i.test(url))) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
