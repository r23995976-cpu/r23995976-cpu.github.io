const OPERATIONS = ["addition", "subtraction", "multiplication", "division"];

const randomInt = (min, max) =>
  min + Math.floor(Math.random() * (max - min + 1));

export function makeQuestion(selectedCategory, multiDigit) {
  const category = selectedCategory === "random"
    ? OPERATIONS[randomInt(0, OPERATIONS.length - 1)]
    : selectedCategory;
  const minAnswer = multiDigit ? 10 : 0;
  const maxAnswer = multiDigit ? 999 : 9;
  let a, b, answer, operation;

  if (category === "addition") {
    answer = randomInt(minAnswer, maxAnswer);
    a = randomInt(0, answer);
    b = answer - a;
    operation = "+";
  } else if (category === "subtraction") {
    answer = randomInt(minAnswer, maxAnswer);
    b = randomInt(0, maxAnswer - answer);
    a = answer + b;
    operation = "−";
  } else if (category === "multiplication") {
    do {
      a = randomInt(1, multiDigit ? 31 : 9);
      b = randomInt(1, Math.max(1, Math.floor(maxAnswer / a)));
      answer = a * b;
    } while (answer < minAnswer || answer > maxAnswer);
    operation = "×";
  } else {
    answer = randomInt(Math.max(1, minAnswer), maxAnswer);
    b = randomInt(1, Math.max(1, Math.floor(999 / answer)));
    a = answer * b;
    operation = "÷";
  }
  return { a, b, answer, operation, category };
}
