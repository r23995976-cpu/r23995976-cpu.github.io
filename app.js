import { createDrawingBoard } from "./js/drawing-board.js";
import { makeQuestion } from "./js/questions.js";

const MODEL_URL = "./model/model.json";
const PRAISE = ["Brilliant!", "Good!", "Excellent!"];
const byId = id => document.getElementById(id);
const elements = {
  canvas: byId("drawCanvas"), empty: byId("canvasEmptyMessage"),
  question: byId("question"), hint: byId("questionHint"),
  feedback: byId("feedback"), score: byId("scoreValue"), round: byId("roundValue"),
  badge: byId("modelBadge"), meta: byId("modelMeta"), check: byId("checkButton"),
  clear: byId("clearButton"), sound: byId("soundButton"), info: byId("infoButton"),
  dialog: byId("infoDialog"), closeDialog: byId("closeInfoButton"),
  multiDigit: byId("multiDigitToggle"), operation: byId("operationSelect"),
};
const board = createDrawingBoard(elements.canvas, elements.empty);
let model, current;
let score = 0;
let round = 1;

function setFeedback(message, type = "") {
  elements.feedback.className = `feedback ${type}`.trim();
  elements.feedback.textContent = message;
}

function showQuestion() {
  current = makeQuestion(elements.operation.value, elements.multiDigit.checked);
  elements.question.textContent = `${current.a} ${current.operation} ${current.b} = ?`;
  elements.round.textContent = round;
  const count = String(current.answer).length;
  elements.hint.textContent = count === 1 ? "Write one digit."
    : `Write all ${count} digits with a little space between them.`;
  board.reset();
  setFeedback("Write your answer, then choose Check answer.");
  setTimeout(speakQuestion, 150);
}

function speakText(message, rate = 0.9) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(message);
    speech.rate = rate;
    speechSynthesis.speak(speech);
  } catch (_) {}
}

function speakQuestion() {
  if (!current) return;
  const word = { "+": "plus", "\u2212": "minus", "\u00d7": "times",
    "\u00f7": "divided by" }[current.operation];
  speakText(`${current.a} ${word} ${current.b}. What is the answer?`, 0.85);
}

function announce(message, type = "") {
  setFeedback(message, type);
  speakText(message);
}

async function predictSegment(segment) {
  let input, output;
  try {
    input = board.tensorForSegment(segment, model);
    output = model.predict(input);
    const values = await output.data();
    let digit = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[digit]) digit = i;
    return digit;
  } finally {
    input?.dispose();
    output?.dispose();
  }
}

async function predictAnswer(expected = String(current.answer).length) {
  const digits = await Promise.all(board.segmentBounds(expected).map(predictSegment));
  return { digits, answer: Number(digits.join("")) };
}

async function checkAnswer() {
  if (!board.hasInk()) return announce("Write your answer in the chalk box first.", "error");
  if (!model) return announce("The number model is still getting ready.", "error");
  elements.check.disabled = true;
  setFeedback("Reading your chalk writing…");
  try {
    const result = await predictAnswer();
    if (result.answer === current.answer) {
      elements.score.textContent = ++score;
      announce(PRAISE[Math.floor(Math.random() * PRAISE.length)], "success");
      setTimeout(() => { round++; showQuestion(); }, 2400);
    } else {
      announce("Give it another try.", "error");
    }
  } catch (error) {
    announce(error.message === "DIGITS_TOO_CLOSE"
      ? "Leave a little space between each digit so I can read them."
      : "I could not read every digit. Try writing a little bigger.", "error");
  } finally {
    elements.check.disabled = false;
  }
}

async function loadModel() {
  try {
    model = await tf.loadLayersModel(MODEL_URL);
    elements.badge.className = "status-badge status-ready";
    elements.badge.textContent = "Number brain ready";
    elements.meta.textContent = "Private, on-device checking";
    elements.check.disabled = false;
    console.info("Dipalo model loaded");
  } catch (error) {
    elements.badge.textContent = "Model unavailable";
    setFeedback("The number model could not load.", "error");
  }
}

function setTestQuestion(a, operation, b) {
  const answer = operation === "+" ? a + b : operation === "−" ? a - b
    : operation === "×" ? a * b : a / b;
  current = { a, b, operation, answer };
  elements.question.textContent = `${a} ${operation} ${b} = ?`;
  board.reset();
}

if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.__dipaloTest = { predictAnswer, getCurrent: () => ({ ...current }),
    setQuestion: setTestQuestion };
}

elements.clear.addEventListener("click", () => {
  board.reset();
  setFeedback("Board cleared. Have another go!");
});
elements.check.addEventListener("click", checkAnswer);
elements.sound.addEventListener("click", speakQuestion);
elements.info.addEventListener("click", () => elements.dialog.showModal());
elements.closeDialog.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => {
  if (event.target === elements.dialog) elements.dialog.close();
});
[elements.operation, elements.multiDigit].forEach(input =>
  input.addEventListener("change", () => { round = 1; showQuestion(); }));

board.reset();
showQuestion();
loadModel();

if ("serviceWorker" in navigator) {
  addEventListener("load", () =>
    navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
}
