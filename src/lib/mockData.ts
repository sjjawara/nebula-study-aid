export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";

export const bloomColor: Record<BloomLevel, string> = {
  Remember: "bg-bloom-remember/15 text-bloom-remember border-bloom-remember/30",
  Understand: "bg-bloom-understand/15 text-bloom-understand border-bloom-understand/30",
  Apply: "bg-bloom-apply/15 text-bloom-apply border-bloom-apply/30",
  Analyze: "bg-bloom-analyze/15 text-bloom-analyze border-bloom-analyze/30",
  Evaluate: "bg-bloom-evaluate/15 text-bloom-evaluate border-bloom-evaluate/30",
  Create: "bg-bloom-create/15 text-bloom-create border-bloom-create/30",
};

export interface OutlineItem {
  timestamp: string;
  topic: string;
  bloom: BloomLevel;
  load: 1 | 2 | 3 | 4 | 5;
}

export interface Flashcard {
  question: string;
  answer: string;
  bloom: BloomLevel;
}

export interface SearchMoment {
  timestamp: string;
  excerpt: string;
}

export const mockLecture = {
  title: "Introduction to Neural Networks & Deep Learning Foundations",
  outline: [
    { timestamp: "00:00", topic: "Course overview and prerequisites", bloom: "Remember", load: 1 },
    { timestamp: "03:42", topic: "What is a neuron? Biological inspiration", bloom: "Understand", load: 2 },
    { timestamp: "09:15", topic: "Perceptron model and activation functions", bloom: "Understand", load: 3 },
    { timestamp: "17:30", topic: "Implementing a single-layer perceptron in code", bloom: "Apply", load: 3 },
    { timestamp: "26:08", topic: "Limitations of linear classifiers (XOR problem)", bloom: "Analyze", load: 4 },
    { timestamp: "34:20", topic: "Multi-layer networks and backpropagation derivation", bloom: "Analyze", load: 5 },
    { timestamp: "48:55", topic: "Comparing optimizers: SGD vs Adam vs RMSprop", bloom: "Evaluate", load: 4 },
    { timestamp: "59:12", topic: "Design your own architecture for image classification", bloom: "Create", load: 5 },
  ] as OutlineItem[],
  summaries: {
    short: "Neural networks are layered systems of weighted connections inspired by biology. This lecture introduces the perceptron, explains why single layers fail on non-linear problems like XOR, and shows how multi-layer networks with backpropagation solve them.",
    medium: "The lecture begins with biological motivation for artificial neurons, then formalizes the perceptron with weights, bias, and activation functions. After implementing one in code, it demonstrates the XOR limitation that motivates multi-layer architectures. Backpropagation is derived using the chain rule. The session closes with a comparison of optimizers (SGD, Adam, RMSprop) and a design exercise for an image classifier — covering trade-offs in depth, width, and regularization.",
    full: "A complete walkthrough of the foundations of deep learning. We open with the historical and biological context of neural networks, tracing the lineage from McCulloch-Pitts neurons through Rosenblatt's perceptron. The mathematical model is built up carefully: linear combinations of inputs, bias terms, and the role of non-linear activation functions like sigmoid, tanh, and ReLU. A live coding segment implements a single-layer perceptron from scratch in NumPy and trains it on linearly separable data. The XOR problem is introduced as a clear failure case, motivating the need for hidden layers. Backpropagation is derived step-by-step using the chain rule, with attention to common pitfalls like vanishing gradients. The optimizer comparison contrasts pure SGD with momentum-based and adaptive methods, showing convergence curves on MNIST. The final segment is open-ended: students are asked to sketch an architecture for a 10-class image classifier, justifying their choices around depth, parameter count, and regularization strategy.",
  },
  flashcards: [
    { question: "What is the role of an activation function in a neural network?", answer: "It introduces non-linearity, allowing the network to learn complex patterns beyond what linear combinations alone can express.", bloom: "Understand" },
    { question: "Why can a single-layer perceptron not solve the XOR problem?", answer: "XOR is not linearly separable. A single hyperplane cannot divide the input space into the correct output classes, so at least one hidden layer is required.", bloom: "Analyze" },
    { question: "Write pseudocode for one step of gradient descent on a weight w.", answer: "w ← w − η · ∂L/∂w, where η is the learning rate and ∂L/∂w is the gradient of the loss with respect to w.", bloom: "Apply" },
    { question: "Compare SGD and Adam in one sentence.", answer: "SGD uses a fixed learning rate per parameter; Adam adapts per-parameter rates using running averages of gradients and squared gradients.", bloom: "Evaluate" },
    { question: "Design a 3-layer architecture for classifying 28×28 grayscale digits.", answer: "Example: Flatten(784) → Dense(128, ReLU) → Dropout(0.2) → Dense(64, ReLU) → Dense(10, Softmax). Trained with cross-entropy and Adam.", bloom: "Create" },
  ] as Flashcard[],
  searchIndex: [
    { timestamp: "09:15", excerpt: "...the activation function determines how the weighted sum is transformed. ReLU has become the default because it..." },
    { timestamp: "26:08", excerpt: "...XOR is the classic example. No single straight line can separate the true outputs from the false ones..." },
    { timestamp: "34:20", excerpt: "...we apply the chain rule layer by layer, propagating the error gradient back through the network..." },
    { timestamp: "48:55", excerpt: "...Adam combines momentum with per-parameter adaptive learning rates, which often converges faster than vanilla SGD..." },
  ] as SearchMoment[],
};
