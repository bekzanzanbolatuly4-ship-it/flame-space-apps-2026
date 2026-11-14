// Human-authored retrieval expectations, not model-generated ground truth.
export const evaluationQuestions = [
  { question: "BASS-II solid fuel geometry airflow", expected: ["BASS-SETUP"], supported: true },
  { question: "heat release oxygen consumption", expected: ["BASS-HEAT"], supported: true },
  { question: "carbon monoxide dioxide trends", expected: ["BASS-GASES"], supported: true },
  { question: "global equivalence ratio", expected: ["BASS-RATIO"], supported: true },
  { question: "FLEX gaseous suppressants helium", expected: ["FLEX-OBJECTIVE"], supported: true },
  { question: "cool flame after visible extinction", expected: ["FLEX-COOL"], supported: true },
  { question: "methanol initial droplet diameter", expected: ["FLEX-145-INITIAL"], supported: true },
  { question: "methanol extinction diameter", expected: ["FLEX-145-EXTINCTION"], supported: true },
  { question: "methanol average burning rate constant", expected: ["FLEX-145-RATE"], supported: true },
  { question: "What is the fire risk percentage on Mars?", expected: [], supported: false },
  { question: "What is the exact temperature of the BASS-II flame?", expected: [], supported: false },
  { question: "Polypropylene battery combustion on the Moon", expected: [], supported: false },
  { question: "What is the safest oxygen concentration?", expected: [], supported: false },
  { question: "Confidence interval for methanol extinction diameter", expected: [], supported: false },
  { question: "Which suppressant is best for crew safety?", expected: [], supported: false },
];
