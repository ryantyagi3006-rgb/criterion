import { GoogleGenAI } from "@google/genai";
import { renderPages, cropDiagram, docxToParts, DOCX_MIME } from "./pages";
import { findVideoIds, normaliseMedia, type MediaItem } from "./youtube";
import { isRetryable, statusOf } from "./ai-errors";
import { richTextToPlain } from "./richtext";
import { parseCriteria } from "./myp";

export { describeAiError, type AiErrorInfo } from "./ai-errors";

// Free-tier Gemini Flash model. The -latest alias tracks the current Flash
// release, so it keeps working as Google retires older versions.
const MODEL = "gemini-flash-latest";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

export function aiAvailable() {
  return !!process.env.GEMINI_API_KEY;
}

type GenerateArgs = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

async function generateWithRetry(
  ai: GoogleGenAI,
  args: GenerateArgs,
  attempts = 5
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await ai.models.generateContent(args);
    } catch (error) {
      if (!isRetryable(error)) throw error;
      lastError = error;
      if (attempt === attempts - 1) break;
      // Exponential backoff with jitter: about 0.8s, 1.6s, 3.2s, 6.4s.
      const wait = 800 * 2 ** attempt + Math.random() * 400;
      console.warn(
        `Gemini returned ${statusOf(error)}, retrying in ${Math.round(wait)}ms (attempt ${attempt + 1}/${attempts})`
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

export type ParsedQuestion = {
  number: string;
  section: string;
  criteria: { criterion: string; strands: string; marks: number }[];
  text: string;
  answerFormat: "mcq" | "short_text" | "long_text" | "math" | "code" | "drawing" | "table";
  options: string[];
  marks: number;
  subject: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estMinutes: number;
  skills: string[];
  tools: string[];
  rubric: string;
  stimulus: string;
  stimulusTitle: string;
  media: MediaItem[];
  diagramBoxes?: { page: number; box: number[] }[];
  diagramImageIndexes?: number[]; // docx path: indexes into the embedded images
  diagrams: string[]; // data-URL crops, filled in after parsing
};

export type ParsedAssessment = {
  title: string;
  sections?: { title: string; instructions: string }[];
  subject: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  curriculum: string;
  confidence: number;
  questions: ParsedQuestion[];
};

const PARSE_PROMPT = `You are an expert IB MYP assessment digitiser. Analyse the attached task sheet (it may be a PDF, image, scan, or handwritten worksheet; perform OCR as needed).

Extract EVERY question in original order, preserving numbering and sub-questions (2a, 3(ii), etc.), sections, marks per question, and any instructions. Separate general instructions from questions.

DIAGRAMS: when the document is provided as page images, find every figure, diagram, chart, graph, map, photograph or illustrated table that a question refers to. For each one, return it in that question's "diagramBoxes" array as {"page": zero-based page index, "box": [ymin, xmin, ymax, xmax]} with coordinates normalised to 0-1000 of the page. Draw the box generously so the whole figure, its labels and its caption are inside. Do NOT box plain paragraphs of text. Also mention the figure briefly in the question text, e.g. "(see diagram)". If a question has no figure, return an empty array.

If instead the document is provided as extracted HTML text followed by separate embedded images (a converted Word document), the text marks image positions with "[embedded image N]". In that case leave "diagramBoxes" empty and use "diagramImageIndexes": the zero-based indexes of the embedded images belonging to that question.

STIMULUS TEXT: many tasks, especially Language and Literature, give a long source that questions refer to. That is an unseen extract, poem, article, transcript, case study, data commentary or similar, and it is often introduced by wording like "Read the following extract", "Text A", "Refer to the passage below", or "Questions 3 to 6 refer to the text below".
- Put that source in "stimulus", reproduced IN FULL and verbatim, preserving paragraph breaks and line breaks. Do not summarise, truncate or paraphrase it. Where exact text was supplied to you, copy it from there rather than re-reading the image, so wording and punctuation are exact.
- Put a short label in "stimulusTitle", for example "Text A: extract from The Road by Cormac McCarthy" or "Source B: transcript".
- The stimulus is NOT the question. Keep the actual instruction to the student in "text".
- If several questions refer to the same source, repeat the same stimulus on EVERY one of those questions, because students see one question at a time.
- If a question has no source text, use "" for both fields.

VIDEO: task sheets sometimes tell students to watch a YouTube video. Look for YouTube links in the visible text, and also in the list of link targets supplied to you, since a hyperlink behind wording like "watch this clip" is invisible in a page image. For each video a question depends on, add an entry to that question's "media" array as {"type": "youtube", "url": the full URL exactly as it appears, "videoId": the 11 character id if you can read it confidently, "title": short label, "start": start time in seconds or 0}. Never invent or guess an id. If you cannot read it reliably, still return the url and leave videoId empty. Use an empty array when there is no video.

This platform is built for the IB Middle Years Programme (MYP). Classify the assessment into exactly one MYP subject group: "Language and Literature", "Language Acquisition", "Individuals and Societies", "Sciences", "Mathematics", "Arts", "Design", "Physical and Health Education".

Every MYP subject group is assessed through four criteria, A to D. For example Mathematics: A Knowing and understanding, B Investigating patterns, C Communicating, D Applying mathematics in real-life contexts. Sciences: A Knowing and understanding, B Inquiring and designing, C Processing and evaluating, D Reflecting on the impacts of science.

For each question:
- criteria: an array, because one question often assesses SEVERAL criteria at once. Each entry is {"criterion": "A"|"B"|"C"|"D", "strands": "i, ii" or "", "marks": the marks awarded under THAT criterion}. The criterion marks must add up to the marks for that question. Where the sheet states a split, for example "[4 marks: A2, C2]", use it exactly. Where it gives only a total for a question covering several criteria, divide it sensibly and never leave a criterion on zero. If the task sheet states the criteria (for example "Criterion B" or "Criteria A and C" or "[Crit B i-ii, Crit C i]"), use exactly those. Otherwise infer the best fit; include every criterion the question genuinely assesses, and never leave the array empty.
- answerFormat: one of "mcq" (include options array), "short_text", "long_text" (extended response), "math" (working plus numeric or symbolic answer), "code" (programming), "drawing" (sketches or graphs to draw), "table" (data tables)
- subject: the MYP subject group name
- topic: specific topic, e.g. Linear relationships, Ecosystems, Poetry analysis
- difficulty: Easy | Medium | Hard
- estMinutes: estimated completion time
- skills: array of skills assessed
- tools: array chosen ONLY from [calculator, graphing, formula_sheet, periodic_table, unit_converter, code_editor, spreadsheet, dictionary, map]; only tools genuinely useful for that question
- rubric: a concise marking guide (use the sheet's task-specific clarification if present, otherwise write one worth the allocated marks, phrased in MYP command-term style)
- marks: integer marks allocated (default 1 if not stated)

SECTIONS: task sheets are usually split into parts, each with its own preamble, for example "Section B: Data analysis. Answer ALL questions. You may use a calculator." Return a "sections" array in document order: {"title": the section heading exactly as printed, "instructions": any wording that applies to that whole section rather than to one question}. Use "" for instructions where a section has none. Each question's "section" field must match one of these titles exactly. If the sheet has no sections, return an empty array and leave every question's section as "".

Also return: title, subject (the MYP subject group), description (1 sentence), instructions (general instructions text that applies to the WHOLE paper, not to one section), durationMinutes (stated or estimated total), curriculum (e.g. "IB MYP Year 4"), confidence (0-1, your parsing confidence).

Return ONLY valid JSON:
{"title": string, "subject": string, "description": string, "instructions": string, "durationMinutes": number, "curriculum": string, "confidence": number, "sections": [{"title": string, "instructions": string}], "questions": [{"number": string, "section": string, "criteria": [{"criterion": string, "strands": string, "marks": number}], "text": string, "answerFormat": string, "options": string[], "marks": number, "subject": string, "topic": string, "difficulty": string, "estMinutes": number, "skills": string[], "tools": string[], "rubric": string, "stimulus": string, "stimulusTitle": string, "media": [{"type": "youtube", "url": string, "videoId": string, "title": string, "start": number}], "diagramBoxes": [{"page": number, "box": [number, number, number, number]}], "diagramImageIndexes": number[]}]}`;

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ParsedAssessment> {
  const ai = client();
  if (!ai) return demoParse(fileName);

  // Rasterise PDFs and images into page bitmaps so Gemini can return diagram
  // bounding boxes we can crop. Word documents are converted to HTML text plus
  // their embedded images, since Gemini cannot ingest .docx directly.
  let pages = null;
  let docxImages: string[] = [];
  let mediaParts: ({ inlineData: { mimeType: string; data: string } } | { text: string })[];

  if (mimeType === DOCX_MIME) {
    const { html, images } = await docxToParts(buffer);
    docxImages = images;
    mediaParts = [
      { text: `Converted Word document (image positions marked inline):\n\n${html}` },
      ...images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
    ];
  } else {
    try {
      pages = await renderPages(buffer, mimeType);
    } catch (e) {
      console.error("Page rendering failed, falling back to raw upload:", e);
    }
    mediaParts = pages
      ? pages.map((p) => ({ inlineData: { mimeType: "image/jpeg", data: p.jpeg.toString("base64") } }))
      : [{ inlineData: { mimeType, data: buffer.toString("base64") } }];

    // Embedded PDF text is exact where OCR guesses, which matters for long
    // stimulus passages, and link targets are invisible once rasterised.
    if (pages) {
      const embeddedText = pages
        .map((p, i) => (p.text.trim() ? `--- page ${i} text ---\n${p.text.trim()}` : ""))
        .filter(Boolean)
        .join("\n\n");
      const allLinks = [...new Set(pages.flatMap((p) => p.links))];

      if (embeddedText) {
        mediaParts.push({
          text: `Exact text extracted from the document. Prefer this over reading the page images when copying wording, especially for long passages:\n\n${embeddedText}`,
        });
      }
      if (allLinks.length) {
        mediaParts.push({
          text: `Link targets embedded in the document:\n${allLinks.join("\n")}`,
        });
      }
    }
  }

  const res = await generateWithRetry(ai, {
    model: MODEL,
    contents: [{ role: "user", parts: [...mediaParts, { text: PARSE_PROMPT }] }],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });
  const parsed = extractJson(res.text ?? "") as ParsedAssessment;
  parsed.questions = (parsed.questions ?? []).map((q, i) => {
    const questionMarks = Math.max(1, Math.round(q.marks || 1));

    const criteria = (() => {
      const list = (q.criteria ?? [])
        .filter((c) => ["A", "B", "C", "D"].includes(c?.criterion))
        .map((c) => ({
          criterion: c.criterion,
          strands: c.strands ?? "",
          marks: Math.max(0, Math.round(Number(c.marks) || 0)),
        }));
      if (!list.length) return [{ criterion: "A", strands: "", marks: questionMarks }];
      // The model sometimes names the criteria without splitting the marks.
      // Spread the question total rather than leaving every criterion on zero.
      if (list.every((c) => c.marks === 0)) {
        const each = Math.floor(questionMarks / list.length);
        const remainder = questionMarks - each * list.length;
        return list.map((c, index) => ({ ...c, marks: each + (index === 0 ? remainder : 0) }));
      }
      return list;
    })();

    return {
    ...q,
    number: q.number || String(i + 1),
    criteria,
    options: q.options ?? [],
    skills: q.skills ?? [],
    tools: q.tools ?? [],
    // The question is worth whatever its criteria add up to.
    marks: criteria.reduce((sum, c) => sum + c.marks, 0) || questionMarks,
    stimulus: typeof q.stimulus === "string" ? q.stimulus : "",
    stimulusTitle: typeof q.stimulusTitle === "string" ? q.stimulusTitle : "",
    // Drop anything that is not a real 11 character YouTube id, so a bad OCR
    // read can never become an iframe pointing at an unrelated video.
    media: normaliseMedia(q.media),
    diagrams: [],
    };
  });

  // Safety net: if the document clearly links a video but the model attached it
  // to no question, put it on the first question that mentions watching.
  const linkedIds = pages ? findVideoIds(pages.flatMap((p) => p.links).join("\n")) : [];
  if (linkedIds.length && !parsed.questions.some((q) => q.media.length)) {
    const target =
      parsed.questions.find((q) => /watch|video|clip|listen/i.test(q.text)) ??
      parsed.questions[0];
    if (target) {
      target.media = linkedIds.map((videoId) => ({
        type: "youtube" as const,
        videoId,
        title: "",
        start: 0,
      }));
    }
  }

  // Crop each detected diagram out of its page and attach it to the question.
  if (pages) {
    for (const q of parsed.questions) {
      for (const d of q.diagramBoxes ?? []) {
        const page = pages[d.page];
        if (!page || !Array.isArray(d.box) || d.box.length !== 4) continue;
        try {
          const dataUrl = await cropDiagram(page, d.box);
          if (dataUrl) q.diagrams.push(dataUrl);
        } catch (e) {
          console.error("Diagram crop failed:", e);
        }
      }
    }
  }

  // Docx path: attach the referenced embedded images directly.
  if (docxImages.length) {
    for (const q of parsed.questions) {
      for (const idx of q.diagramImageIndexes ?? []) {
        if (docxImages[idx]) q.diagrams.push(`data:image/jpeg;base64,${docxImages[idx]}`);
      }
    }
  }

  return parsed;
}

export type MarkResult = {
  perQuestion: {
    questionId: string;
    score: number;
    criterionScores: Record<string, number>;
    feedback: string;
    confidence: number;
  }[];
  overallFeedback: string;
};

export async function markAttempt(
  questions: {
    id: string; number: string; text: string; marks: number; rubric: string;
    answerFormat: string; criteria?: string; stimulus?: string;
  }[],
  answers: Record<string, string>
): Promise<MarkResult | null> {
  const ai = client();
  if (!ai) return null;

  const payload = questions.map((q) => ({
    questionId: q.id,
    number: q.number,
    // Each criterion with the marks available under it, so the model marks
    // against the right allocation rather than one lump total.
    criteria: parseCriteria(q.criteria ?? "[]").map((c) => ({
      criterion: c.criterion,
      strands: c.strands,
      marksAvailable: c.marks,
    })),
    question: q.text,
    // Without the source text an analysis question cannot be marked fairly.
    ...(q.stimulus ? { sourceText: q.stimulus } : {}),
    maxMarks: q.marks,
    rubric: q.rubric,
    format: q.answerFormat,
    // Extended responses are stored with formatting markup. Marking is about
    // the prose, so the tags are flattened rather than fed to the model.
    studentAnswer:
      (q.answerFormat === "long_text"
        ? richTextToPlain(answers[q.id] ?? "")
        : answers[q.id]) || "(no answer given)",
  }));

  const prompt = `You are a fair, rigorous IB MYP examiner marking a student submission. Each question is mapped to one or more MYP criteria (A to D), given as a JSON list with the strands and the marks available under each one.

Mark EACH criterion separately against its own allocation. For a question listing A worth 4 and C worth 2, decide an A mark out of 4 and a C mark out of 2, judging that criterion on its own terms: A on the knowledge and analysis shown, C on how clearly it is communicated. Return these in "criterionScores", keyed by criterion letter, for example {"A": 3, "C": 1.5}. Never exceed the marks available for a criterion, halves are allowed, and include every criterion the question lists even when the mark is 0. "score" must be the sum of those criterion marks. Explain WHY marks were awarded or withheld using MYP command-term language, identify missing steps and misconceptions, and give one constructive improvement tip. Note: "drawing" answers are image data; if the answer content starts with "data:image" treat it as attempted and mark generously on effort unless clearly blank. Also provide overall feedback: strengths and weaknesses organised by criterion, plus 2-3 revision suggestions. Write all feedback in short, plain sentences. Never use em dashes or emojis.

Submission:
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON:
{"perQuestion": [{"questionId": string, "score": number, "criterionScores": {"A": number}, "feedback": string, "confidence": number}], "overallFeedback": string}`;

  const res = await generateWithRetry(ai, {
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });
  return extractJson(res.text ?? "") as MarkResult;
}

export async function tutorReply(
  question: string,
  studentAnswer: string,
  chat: { role: string; text: string }[]
): Promise<string> {
  const ai = client();
  if (!ai)
    return "The tutor needs a GEMINI_API_KEY in .env. Grab a free one at aistudio.google.com/apikey.";

  const history = chat.map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.text}`).join("\n");
  const prompt = `You are a patient tutor in PRACTICE MODE of an IB MYP assessment platform. Help the student learn: give hints, explain concepts, show worked examples of SIMILAR problems, and point out mistakes in their working. NEVER give the final answer outright; guide them to it. Never use em dashes or emojis. Keep replies under 150 words, plain text.

Current question: ${question}
Student's current answer/working: ${studentAnswer || "(blank)"}
Conversation so far:
${history}

Reply as the tutor:`;

  const res = await generateWithRetry(ai, { model: MODEL, contents: prompt });
  return res.text ?? "Sorry, I couldn't generate a hint right now.";
}

// When no API key is present, return a clearly labelled sample so the whole
// platform can still be explored end to end.
function demoParse(fileName: string): ParsedAssessment {
  return {
    title: `Demo Task (${fileName})`,
    subject: "Mathematics",
    description: "Sample generated in demo mode. Add GEMINI_API_KEY to parse real task sheets.",
    instructions: "Answer all questions. Show your working where marks allow.",
    durationMinutes: 30,
    curriculum: "IB MYP Year 4",
    confidence: 0,
    questions: [
      {
        number: "1", section: "Section A", criteria: [{ criterion: "A", strands: "i", marks: 1 }],
        text: "Solve for x:  3x + 7 = 22",
        answerFormat: "mcq", options: ["x = 3", "x = 5", "x = 7", "x = 15"],
        marks: 1, subject: "Mathematics", topic: "Algebra", difficulty: "Easy",
        estMinutes: 1, skills: ["Solving linear equations"], tools: ["calculator"],
        rubric: "1 mark for x = 5.",
        stimulus: "", stimulusTitle: "", media: [], diagrams: [],
      },
      {
        number: "2", section: "Section A", criteria: [{ criterion: "A", strands: "i, ii", marks: 3 }],
        text: "A ladder leans against a wall reaching 4 m up, with its base 3 m from the wall. Find the length of the ladder, showing your working.",
        answerFormat: "math", options: [], marks: 3, subject: "Mathematics",
        topic: "Pythagoras", difficulty: "Medium", estMinutes: 4,
        skills: ["Pythagoras' theorem", "Problem solving"], tools: ["calculator", "formula_sheet"],
        rubric: "1 mark for identifying a squared plus b squared equals c squared, 1 mark for correct substitution, 1 mark for answer 5 m.",
        stimulus: "", stimulusTitle: "", media: [], diagrams: [],
      },
      {
        number: "3", section: "Section B", criteria: [{ criterion: "C", strands: "i, iii", marks: 3 }, { criterion: "A", strands: "i", marks: 1 }],
        text: "Explain, in a short paragraph, the difference between the mean and the median, and give an example where the median better represents a data set.",
        answerFormat: "long_text", options: [], marks: 4, subject: "Mathematics",
        topic: "Statistics", difficulty: "Medium", estMinutes: 6,
        skills: ["Statistical reasoning", "Written communication"], tools: ["dictionary"],
        rubric: "1 mark defining mean, 1 defining median, 2 for a valid example with skew or outliers.",
        stimulus: "", stimulusTitle: "", media: [], diagrams: [],
      },
    ],
  };
}
