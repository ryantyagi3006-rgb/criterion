/* Seeds demo accounts and a sample published MYP assessment.
   Run: node prisma/seed.js */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const db = new PrismaClient();

const QUESTIONS = [
  {
    number: "1", section: "Section A", criteria: [{ criterion: "A", strands: "i" }],
    text: "Solve for x:  4x − 9 = 19",
    answerFormat: "mcq", options: ["x = 5", "x = 7", "x = 2.5", "x = 10"],
    marks: 1, topic: "Algebra", difficulty: "Easy", estMinutes: 1,
    skills: ["Solving linear equations"], tools: ["calculator"],
    rubric: "1 mark for x = 7.",
  },
  {
    number: "2", section: "Section A", criteria: [{ criterion: "A", strands: "i" }],
    text: "Which of the following is equivalent to sin(θ)/cos(θ)?",
    answerFormat: "mcq", options: ["tan(θ)", "cot(θ)", "sec(θ)", "cosec(θ)"],
    marks: 1, topic: "Trigonometry", difficulty: "Easy", estMinutes: 1,
    skills: ["Trigonometric identities"], tools: ["formula_sheet"],
    rubric: "1 mark for tan(θ).",
  },
  {
    number: "3", section: "Section B", criteria: [{ criterion: "A", strands: "i, ii" }],
    text: "A right-angled triangle has legs of length 6 cm and 8 cm. Calculate the length of the hypotenuse, showing all working.",
    answerFormat: "math", options: [],
    marks: 3, topic: "Pythagoras", difficulty: "Medium", estMinutes: 4,
    skills: ["Pythagoras' theorem", "Show working"], tools: ["calculator", "formula_sheet"],
    rubric: "1 mark for selecting Pythagoras, 1 mark for substitution (36 + 64 = 100), 1 mark for c = 10 cm with units.",
  },
  {
    number: "4", section: "Section B", criteria: [{ criterion: "B", strands: "i, iii" }, { criterion: "C", strands: "i" }],
    text: "Sketch the graph of y = x² − 4, labelling the y-intercept and both x-intercepts. Describe the pattern linking the intercepts to the equation.",
    answerFormat: "drawing", options: [],
    marks: 4, topic: "Quadratic Functions", difficulty: "Medium", estMinutes: 5,
    skills: ["Graphing parabolas", "Describing patterns"], tools: ["graphing", "calculator"],
    rubric: "1 mark for parabola shape, 1 for y-intercept (0, −4), 2 for x-intercepts (±2, 0) with the pattern described.",
  },
  {
    number: "5", section: "Section C", criteria: [{ criterion: "C", strands: "i, ii" }, { criterion: "A", strands: "i" }],
    text: "The table shows daily sales (units) for one week: Mon 12, Tue 15, Wed 9, Thu 15, Fri 24. Enter the data in a table and calculate the mean, median and mode. Which measure best represents a typical day, and why? Communicate your reasoning clearly.",
    answerFormat: "table", options: [],
    marks: 5, topic: "Statistics", difficulty: "Medium", estMinutes: 7,
    skills: ["Measures of centre", "Mathematical communication"], tools: ["spreadsheet", "calculator"],
    rubric: "1 mark each for mean (15), median (15), mode (15); 2 marks for a clearly communicated, justified choice referencing the Friday outlier.",
  },
  {
    number: "6", section: "Section D", criteria: [{ criterion: "D", strands: "i, ii, iii" }],
    text: "A shop tracks whether a stock number is prime to decide shelf placement. Write a function isPrime(n) that returns true if n is prime and false otherwise, then test it by printing isPrime(2), isPrime(9) and isPrime(17). Explain in a comment how this applies to the real-life context.",
    answerFormat: "code", options: [],
    marks: 6, topic: "Algorithms in Context", difficulty: "Hard", estMinutes: 10,
    skills: ["Applying mathematics", "Algorithms", "Testing"], tools: ["code_editor"],
    rubric: "2 marks for correct prime logic, 1 for handling n < 2, 1 for demonstrated test output (true, false, true), 2 for connecting the method to the real-life context.",
  },
];

// An original passage, written for this seed so nothing copyrighted is stored.
const EXTRACT = `The tide went out that year and did not come back.

At first nobody in Kelmore agreed on what they were seeing. Mr Aldiss, who had kept the harbour ledger for thirty-one years, wrote calm and unseasonal in the margin and underlined it twice, the way he underlined everything he did not wish to think about. The fishing boats settled into the mud at angles that looked almost comic, the way a man looks comic the instant before he understands he has fallen.

My grandmother took me down to the wall each morning. She did not explain. She simply stood with her hands folded on the stone and looked at the place where the water used to be, and I stood beside her and looked at it too, and the mud steamed faintly in the cold, and the gulls walked about on it as though they had been given a country.

By August the tourists had stopped coming and the word had changed. It was no longer calm. In the shop they said the retreat, and later, when the wells turned brackish and the Pentlow family left in a van with a mattress roped to the roof, they said it, only it, as in before it and since it, and everyone understood.

I was eleven. I understood that the adults had run out of the kind of words you say aloud. What I remember is not fear. What I remember is my grandmother's hands on the stone, and how she never once said that it would come back, and how I loved her for that, later, when I was old enough to know what she had spared me.`;

const LL_QUESTIONS = [
  {
    number: "1", section: "Section A", criteria: [{ criterion: "A", strands: "i, ii" }],
    text: "Analyse how the writer uses the shifting language of the townspeople (\"calm and unseasonal\", \"the retreat\", \"it\") to convey the community's changing relationship with the event.",
    answerFormat: "long_text", marks: 8, topic: "Unseen Prose Analysis", difficulty: "Medium", estMinutes: 20,
    skills: ["Analysing language", "Analysing structure"], tools: ["dictionary"],
    rubric: "Analyses the progression from euphemism to bare pronoun. Rewards close reference to the three quoted phrases and comment on what the narrowing vocabulary suggests about denial and acceptance.",
    stimulusTitle: "Text A: extract from a short story",
    stimulus: EXTRACT,
    media: [],
  },
  {
    number: "2", section: "Section A", criteria: [{ criterion: "A", strands: "iii" }, { criterion: "D", strands: "i, ii" }],
    text: "Comment on the effect of the final paragraph. How does the adult narrator's perspective shape the reader's response to the grandmother?",
    answerFormat: "long_text", marks: 6, topic: "Narrative Perspective", difficulty: "Hard", estMinutes: 15,
    skills: ["Analysing perspective", "Using language to explain"], tools: ["dictionary"],
    rubric: "Identifies the retrospective adult voice and the withheld reassurance. Rewards discussion of restraint, and of what 'spared me' implies about the grandmother's honesty.",
    stimulusTitle: "Text A: extract from a short story",
    stimulus: EXTRACT,
    media: [],
  },
  {
    number: "3", section: "Section B", criteria: [{ criterion: "A", strands: "i" }, { criterion: "D", strands: "ii" }],
    text: "Watch the talk above. The speaker deliberately uses the techniques of persuasive delivery while saying nothing of substance. Identify three specific techniques he demonstrates, and explain how each one creates an impression of authority.",
    answerFormat: "long_text", marks: 6, topic: "Rhetoric and Delivery", difficulty: "Medium", estMinutes: 15,
    skills: ["Analysing rhetorical technique", "Evaluating delivery"], tools: [],
    rubric: "Three distinct techniques identified, for example the pause, the rehearsed personal anecdote, the rhetorical triple, gesture, or shifts in vocal pace. Each linked to the impression of authority it manufactures.",
    stimulusTitle: "",
    stimulus: "",
    media: [{ type: "youtube", videoId: "8S0FDjFBj8o", title: "How to sound smart in your TEDx Talk", start: 0 }],
  },
];

async function main() {
  const teacher = await db.user.upsert({
    where: { email: "teacher@demo.com" },
    update: {},
    create: {
      email: "teacher@demo.com", name: "Ms. Rivera", role: "TEACHER",
      password: bcrypt.hashSync("password123", 10),
    },
  });
  await db.user.upsert({
    where: { email: "student@demo.com" },
    update: {},
    create: {
      email: "student@demo.com", name: "Alex Chen", role: "STUDENT",
      password: bcrypt.hashSync("password123", 10),
    },
  });

  const existing = await db.assessment.findFirst({ where: { teacherId: teacher.id } });
  if (!existing) {
    await db.assessment.create({
      data: {
        title: "MYP 4 Mathematics: Criterion Review Task",
        subject: "Mathematics",
        description: "Mixed task covering Criteria A to D: knowing and understanding, investigating patterns, communicating, and applying mathematics in real-life contexts.",
        instructions: "Answer all questions. Show full working where marks allow. The criterion being assessed is shown beside each question.",
        status: "PUBLISHED",
        mode: "PRACTICE",
        durationMinutes: 45,
        totalMarks: QUESTIONS.reduce((s, q) => s + q.marks, 0),
        sourceFileName: "myp4-maths-criterion-review.pdf",
        aiConfidence: 0.94,
        curriculum: "IB MYP Year 4",
        teacherId: teacher.id,
        questions: {
          create: QUESTIONS.map((q, i) => ({
            order: i, number: q.number, section: q.section,
            criteria: JSON.stringify(q.criteria), text: q.text,
            answerFormat: q.answerFormat, options: JSON.stringify(q.options),
            marks: q.marks, subject: "Mathematics", topic: q.topic, difficulty: q.difficulty,
            estMinutes: q.estMinutes, skills: JSON.stringify(q.skills),
            tools: JSON.stringify(q.tools), rubric: q.rubric,
          })),
        },
      },
    });
  }

  // Second sample: shows a long shared source text and an embedded video.
  const llExisting = await db.assessment.findFirst({
    where: { teacherId: teacher.id, subject: "Language and Literature" },
  });
  if (!llExisting) {
    await db.assessment.create({
      data: {
        title: "MYP 4 Language and Literature: Unseen Text and Rhetoric",
        subject: "Language and Literature",
        description: "Analysis of an unseen prose extract, plus a viewing task on persuasive delivery.",
        instructions: "Read Text A closely before answering Section A. Watch the talk in Section B as many times as you need. Refer to specific words and moments in your answers.",
        status: "PUBLISHED",
        mode: "PRACTICE",
        durationMinutes: 50,
        totalMarks: LL_QUESTIONS.reduce((s, q) => s + q.marks, 0),
        sourceFileName: "myp4-langlit-unseen.pdf",
        aiConfidence: 0.91,
        curriculum: "IB MYP Year 4",
        teacherId: teacher.id,
        questions: {
          create: LL_QUESTIONS.map((q, i) => ({
            order: i, number: q.number, section: q.section,
            criteria: JSON.stringify(q.criteria), text: q.text,
            answerFormat: q.answerFormat, options: JSON.stringify([]),
            marks: q.marks, subject: "Language and Literature", topic: q.topic,
            difficulty: q.difficulty, estMinutes: q.estMinutes,
            skills: JSON.stringify(q.skills), tools: JSON.stringify(q.tools),
            rubric: q.rubric,
            stimulus: q.stimulus, stimulusTitle: q.stimulusTitle,
            media: JSON.stringify(q.media),
          })),
        },
      },
    });
  }

  console.log("Seeded: teacher@demo.com / student@demo.com (password123) plus two sample MYP tasks");
}

main().finally(() => db.$disconnect());
