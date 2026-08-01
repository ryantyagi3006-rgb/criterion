# Criterion. MYP assessments, digitised

Upload an IB MYP task sheet (PDF, Word .docx, image, scan, worksheet) and it becomes a
complete digital assessment. Every question is extracted, mapped to its MYP criteria and
strands, given the right subject tools, marked against the task-specific clarification,
and moderated by the teacher before release.

All AI features run on the Gemini Flash free tier (`gemini-2.5-flash`).

## Quick start

Needs a Postgres connection string. The free tier of Vercel Postgres, Neon or
Supabase is plenty. Copy `.env.example` to `.env` and fill in `DATABASE_URL`.

```bash
npm install
npm run setup       # applies migrations and seeds demo data
npm run dev         # http://localhost:3000
```

Demo accounts (seeded): `teacher@demo.com` and `student@demo.com`, password `password123`.
A sample published MYP Mathematics task covering Criteria A to D is included.

### Enable real AI (free)

1. Get a free API key at <https://aistudio.google.com/apikey>
2. Put it in `.env` as `GEMINI_API_KEY="..."`

Without a key the platform still works end to end. Uploads produce a clearly labelled
demo task and marking falls back to manual teacher scoring.

## MYP structure

The platform knows all 8 MYP subject groups and their criteria:

- Language and Literature, Language Acquisition, Individuals and Societies,
  Sciences, Mathematics, Arts, Design, Physical and Health Education
- Each subject group has 4 criteria, A to D, with subject-specific names
  (for Mathematics: Knowing and understanding, Investigating patterns,
  Communicating, Applying mathematics in real-life contexts)
- A question can assess several criteria at once. Each question shows every criterion
  beside it, task-sheet style, with its own strands, for example
  "Criterion B: Investigating patterns (strands i, iii)  Criterion C: Communicating (strands i)"
- Results show marks per criterion plus an indicative achievement level out of 8

## What it does

Teachers:

- Drag in a task sheet. Gemini Flash reads it with OCR and vision, extracts every
  question in order, detects the stated criterion or infers the best fit, writes a
  marking clarification, assigns tools, and reports parsing confidence.
- Review screen to edit anything before publishing: criterion, strands, marks,
  answer format, tools, clarification, mode, duration, due date.
- Criterion coverage cards show how marks spread across A to D.
- Moderation view per submission: suggested marks with confidence flags, editable
  scores and feedback, approve and release, reopen.

Students:

- Calm workspace: question navigator, progress bar, countdown with auto-submit,
  flagging, keyboard shortcuts, zoom, full screen, dark and light themes, autosave.
- Answer formats: multiple choice, short text, long response with word count,
  maths working with symbol palette, runnable JavaScript console, drawing canvas,
  editable data table.
- Tools appear only when relevant: scientific calculator, function grapher, formula
  sheet, periodic table, unit converter, word tools, coordinate grid.
- Practice mode has a tutor that hints without giving answers. Exam mode disables
  it server-side and blocks copy and paste.
- Results show per-question feedback plus criterion levels per subject group.

## Design

UI and UX take cues from AssessPrep, StudentOS and the DPSI Techathlon site:
serif display type, letterspaced micro-labels, warm paper tones with a muted teal
accent in light mode, deep navy in dark mode. No emojis, no clutter.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma ORM,
SQLite (swap the datasource provider to `postgresql` for production), JWT session
cookies with bcrypt-hashed passwords, `@google/genai` with `gemini-2.5-flash`.

## Project layout

```
prisma/schema.prisma        # User / Assessment / Question / Attempt / Answer
prisma/seed.js              # demo accounts plus a sample MYP task
src/lib/myp.ts              # subject groups, criteria names, indicative levels
src/lib/gemini.ts           # parsing, marking and tutoring prompts
src/app/api/...             # REST endpoints (auth, assessments, attempts, tutor)
src/app/dashboard           # role-based dashboards with criterion analytics
src/app/assessment/[id]/edit# teacher review and publish
src/app/attempt/[id]        # student workspace (plus /results)
src/app/review/[id]         # teacher moderation
src/components/             # workspace, tools, criterion tags, editors
```

## Supported uploads

| Format | Text and questions | Diagrams |
| --- | --- | --- |
| PDF | yes, with OCR | yes, cropped from rendered pages |
| PNG, JPG, WEBP | yes, with OCR | yes, cropped from the image |
| Word .docx | yes | yes, the embedded images are pulled out |
| Plain text | yes | none to extract |

Old binary `.doc` files are rejected with a clear message. Save them as `.docx`
or export to PDF first.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New > Project** and import the repository. Leave the build
   settings alone; the `build` script already runs `prisma generate` and
   `prisma migrate deploy` before `next build`.
3. Before the first deploy, open **Storage > Create Database > Postgres** and
   attach it to the project. Vercel injects `DATABASE_URL` for you.
4. Add the remaining environment variables under **Settings > Environment
   Variables**:
   - `AUTH_SECRET` — a long random value, e.g. `openssl rand -base64 32`
   - `GEMINI_API_KEY` — your key from aistudio.google.com/apikey
5. Deploy. Migrations run automatically as part of the build.

To create the demo accounts on the deployed database, run once from your
machine with `DATABASE_URL` pointed at the production database:

```bash
npm run db:seed
```

Anyone can also just register through the sign-up form, so seeding is optional.

### Notes

- Postgres is required, not a preference. Vercel's filesystem is read-only and
  ephemeral, so a SQLite file cannot be written or persisted between requests.
- Document parsing rasterises PDFs and calls Gemini, which takes tens of
  seconds on long task sheets. The upload route sets `maxDuration = 120`.
  Vercel's Hobby plan caps functions at 60s, so very long sheets may time out
  there; the Pro plan allows the full 120s.
- `public/hero.mp4` is committed deliberately. It is the scrub-optimised,
  all-keyframe build of the login hero clip, regenerated with
  `npm run build:hero-video`.

## Free tier notes

Gemini free tier allows about 10 requests per minute on Flash. Parsing uses 1 request
per upload, marking 1 per submission, tutoring 1 per hint. If a parse fails with a
quota error, wait a minute and retry.
