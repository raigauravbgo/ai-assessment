# BGO AI Capability Development Platform — PRD

**Version:** 1.0  
**Date:** May 2026  
**Owner:** G-Ray  
**Status:** Draft  

---

## 1. Overview

### What we're building

An internal AI capability development platform for BGO. It assesses how well employees can leverage AI to multiply their productivity, gives them structured learning material before the assessment, tracks improvement over time, and informs coaching, role, and team decisions.

### Why it exists

BGO's strategic mandate is AI-native operations. The core question this platform answers is: who can scale quickly with AI, who needs coaching, and who is unlikely to adapt. The hackathon is the first deployment — engineering team first, then every function in the company.

### Design principles

- Behavioral elicitation over self-report — capture authentic behavior, not performed competence
- Learning-first framing — assessment sits inside a development loop, not a judgment event
- Conservative on negative categorization — the low multiplier bucket requires convergent evidence across multiple dimensions, not a single bad signal
- Single-user, internal-only — no sharing, no role management, no external access
- Role-configurable — engineering is the first role configured; the architecture supports every function

---

## 2. The Three Loops

```
Learn → Assess → Improve → Learn → Assess → Improve ...
```

Every employee goes through this loop every 2–3 months. The first assessment is the baseline. Each subsequent cycle shows delta — not just where someone is but how fast they're moving and on which dimensions.

---

## 3. Users

**Participants** — BGO employees taking the assessment. For the initial launch: mid-tier developers, ~10–15 LPA band. Future: all functions including collections agents, QA analysts, recruiters, team leads, finance, HR.

**Admin** — G-Ray only. Single user. Sees all scores, buckets, deltas, and diagnostic responses. No one else has dashboard access.

---

## 4. Module 1 — Learning

### Purpose

Give participants a genuine chance to understand AI-native working before they're assessed. Not a compliance checkbox — a real opinionated guide written like a senior colleague, not a corporate training deck.

### Structure

Four sections. Each has a reading component, embedded YouTube videos where relevant, and 2–3 "try this" prompts participants can run themselves.

**Section 1 — Thinking with AI, not delegating to it**
The mindset shift. What it means to use AI as a thinking partner versus a vending machine. Before/after prompt examples. Why the distinction matters.

**Section 2 — The craft of prompting for code**
Specific techniques: giving context, specifying constraints, asking for alternatives, critiquing output. Real code examples. Short and practical.

**Section 3 — Knowing when not to trust it**
The failure modes: hallucinated APIs, confident wrong answers, constraint violations, security issues AI routinely misses. The most important section for differentiating fast multipliers from people who got lucky.

**Section 4 — Building with AI in a loop**
How to structure a coding session for iteration rather than hoping. Prompt → evaluate → refine → validate. A short worked example on a real small problem.

### Behaviour

- No completion gate — participants are not blocked from taking the assessment if they skip the learning module
- Completion is tracked per participant per section — visible in the admin dashboard
- Completion data is shown alongside assessment results so the admin can see whether someone engaged with learning material before being assessed
- No quiz, no score for learning module completion

---

## 5. Module 2 — Assessment

### 5.1 Participant experience

**Entry:** Participants receive a unique token link. No account creation. They enter their name and the token — that's it.

**Problem selection:** Three problems displayed with short descriptions. Participant picks one. Selection is locked immediately — no switching. Problem descriptions are written so all three feel comparably approachable on the surface. Hidden complexity ceilings vary — the differentiation reveals itself during the work, not at selection.

**Work period:** 48 hours from the moment they select a problem. A countdown is visible. No leaderboard. No visibility into what others are doing or how far along they are.

**Submission:** Three components.

1. Zip file upload — their entire project folder built locally
2. Freeform notes field — optional, no format, no length requirement. Labelled casually: "Anything you want us to know about your submission?" Rendered as a text box in the UI so there's no friction of creating a separate file.
3. Diagnostic questions — three questions presented as a conversational interface, one at a time, after each answer is submitted. Framed as "before you submit, a few quick questions — no right answers, just how it went." Takes 5 minutes max.

**Confirmation:** Simple confirmation screen. That's the last the participant sees of it.

### 5.2 Problem bank

Problems are configured in the system — not hardcoded. The admin can add new problems at any time. Each problem in the bank has:

- Title and description (shown to participant)
- Role tag (engineering, collections, operations, etc.)
- Three trap definitions — what each trap looks like when caught vs missed
- Zone completion criteria — what floor done, middle done, and stretch attempted looks like as concrete functional criteria
- Ambiguous requirement — one deliberately underspecified requirement in the spec
- Messy data element — one intentional data quality issue in any provided input files
- Hidden constraint — one constraint that AI will routinely violate if not explicitly managed

For the initial engineering launch, three problems are configured before the hackathon. Problem design detail is maintained separately from this PRD and plugged into the system before go-live.

### 5.3 Diagnostic questions

Three questions, same for all roles in the initial launch. Wording is finalised before go-live and stored as config — not hardcoded.

The questions are designed to feel like debrief conversation, not evaluation. Each question is framed around a moment of friction or decision during the work, not a self-assessment. Final wording TBD but the intent of each:

- Q1: Did they distrust AI output at any point and what did they do about it
- Q2: What would they do differently with more time — reveals whether their mental model is AI-iterative or manually-fixable
- Q3: What would worry them about shipping this to a real client — surfaces whether they see AI-specific risks or only generic technical ones

### 5.4 Scoring engine

Fires automatically when a zip is submitted. Claude API scores across five dimensions. Output is stored — scores, reasoning, and evidence citations — before any human sees it.

#### Dimension 1 — Zone completion

Claude reads the code against the problem's zone criteria and answers binary questions: floor cleared, middle cleared, stretch attempted. Output: 0–3 score plus one-line observation per zone on what's present or missing.

Bucketing role: floor completion is a minimum threshold. Once floor is cleared, zone completion stops being the primary differentiator.

#### Dimension 2 — Trap handling

Three traps per problem. Each scored binary: caught, partially caught, or missed. Claude looks for specific evidence defined in the trap config — not vibe-reading the code.

For each trap the scoring prompt receives: what the trap is, what "caught" looks like as concrete code evidence, what "missed" looks like. Output: status per trap with one-line evidence citation that the admin can verify in 30 seconds.

Bucketing role: strongest objective signal. Two or more traps caught is a required condition for the fast multiplier bucket.

#### Dimension 3 — AI fingerprint

The most important dimension. Claude is not looking for AI-generated code — it's looking for evidence of AI-native judgment. Five markers:

1. **Critical override evidence** — comments, alternative implementations, or error handling suggesting the developer evaluated AI output and made a deliberate correction
2. **Iterative structure** — code that looks refined in passes rather than written in one go; helper functions that wrap AI output in validation layers; prompt templates stored as constants
3. **Prompt design quality** — if prompts are stored as strings or constants in the code, what do they look like? Naive single-sentence, or constraint-aware with output format specification?
4. **Trust calibration** — where did they add logging, validation, or fallbacks? Does that calibration make sense given where AI is likely to fail on this problem?
5. **Absence signals** — code that is entirely hand-written with no AI integration, or code that is a raw AI dump with zero human judgment layered on top. Both are flags, different flags.

Output: 1–3 rating per marker with one specific code example, plus overall 1–5 AI fingerprint score and two-sentence summary.

#### Dimension 4 — Notes quality

Three sub-scores 1–3: awareness of AI-specific limitations in what they built, intellectual honesty about what's incomplete, and whether it reveals anything about how they worked that the code doesn't show.

**Important:** if the notes field is empty or absent, all three sub-scores are recorded as null — not zero. Absence of notes is no signal. A submitted but empty or generic note is a weak signal. These are different.

Output: three sub-scores plus one paragraph summary.

#### Dimension 5 — Diagnostic responses

Each answer scored 1–3 on a single axis: forward orientation vs backward orientation.

- 1 = entirely backward-looking, no AI-native thinking visible
- 2 = mixed
- 3 = clearly forward-oriented — thinking about AI use, iteration, improvement, or AI-specific risk

Output: score per question with one-sentence explanation, plus the single most revealing phrase across all three answers combined with a one-line explanation of why.

### 5.5 Bucketing logic

The system suggests a bucket. The admin sees dimension scores and reasoning first, then the suggested bucket. This forces the admin to form their own read before seeing the recommendation.

| Bucket | Criteria |
|---|---|
| Fast multiplier | AI fingerprint 4–5 AND 2+ traps caught AND diagnostic avg > 2.0. Zone floor must be cleared. |
| Slow multiplier | Any signal present but not consistently strong across dimensions. |
| Low multiplier | AI fingerprint 1–2 AND traps mostly missed AND diagnostic orientation flat — ALL THREE must be true. |

The low multiplier bucket uses AND logic across all three core dimensions deliberately. One weak dimension means nothing. Three converging weak dimensions is the decisive signal. This is the highest bar by design.

Admin actions per participant: confirm bucket, override with a note, or flag for second opinion. All overrides are logged.

---

## 6. Module 3 — Improvement Tracking

### Cycle management

Each assessment is stored as a cycle with a timestamp. The first cycle is the baseline. Subsequent cycles are triggered by the admin — typically every 2–3 months.

Retake problems are drawn from the problem bank. The system ensures a participant doesn't get the same problem twice in consecutive cycles.

### What participants see

After each assessment, participants receive a brief personalised summary — directional, not judgmental. Example tone: "Your submission showed strong zone completion. The AI fingerprint dimension suggests room to build more confidence in iterating on AI output rather than accepting it on first pass." No bucket label is shared with participants.

### What the admin sees

Delta view per participant: each of the five dimension scores across all cycles on one screen. Movement direction is shown — improving, flat, declining — per dimension. Cohort view: all participants bucketed, filterable by role, problem choice, and cycle. If a cohort clusters in one bucket, that's visible and worth investigating — it may reflect problem design or learning material gaps, not just individual performance.

---

## 7. Role Architecture

Engineering is the first role configured. Every subsequent role is additive configuration on top of the same engine — not new engineering.

Each role configuration contains:

- Assessment type: code submission (engineering) or scenario-based document/decision submission (all other roles)
- Learning track: four-section structure, role-specific content
- Problem bank: role-appropriate scenarios with equivalent trap and zone structure
- Scoring rubric adjustments: the five dimensions apply to all roles; the evidence Claude looks for is role-specific

**Priority sequencing:**
1. Engineering — initial launch, code-based assessment
2. Collections agents — scenario-based, highest operational impact for BGO
3. All other functions — subsequent cycles

---

## 8. Admin Dashboard

Single user. No login sharing. Three views:

**Aggregate view** — all participants across all cycles. Filterable by role, cycle, bucket, problem chosen. Cohort-level patterns visible.

**Individual view** — one screen per participant. Shows: problem chosen, submission timestamp, learning module completion status, five dimension scorecards with plain-English reasoning under each, diagnostic answers verbatim, most revealing phrase extracted, suggested bucket with reasoning, admin action (confirm / override / flag).

**Cycle management** — create a new assessment cycle, assign participants, set the 48-hour window, view submission status in real time during the active window.

---

## 9. Tech Stack

| Layer | Decision |
|---|---|
| Framework | Next.js — participant portal, scoring pipeline, and admin dashboard in one codebase |
| Database | PostgreSQL on Railway |
| File storage | S3-compatible object store — zip archives |
| AI scoring | Claude API (claude-sonnet-4-6) |
| Hosting | Railway |
| Auth | Token-based for participants, single hardcoded admin login (no user management needed) |

---

## 10. Data Model (Conceptual)

```
Participant
  id, name, token, role, created_at

AssessmentCycle
  id, name, role, problem_ids[], window_start, window_end, created_at

Submission
  id, participant_id, cycle_id, problem_id, zip_path, notes_text, submitted_at

DiagnosticResponse
  id, submission_id, question_index, response_text

Score
  id, submission_id
  zone_score (0-3), zone_reasoning
  trap_1_status, trap_2_status, trap_3_status, trap_evidence[]
  ai_fingerprint_score (1-5), ai_fingerprint_reasoning
  notes_awareness_score, notes_honesty_score, notes_process_score (each 1-3 or null)
  diagnostic_q1_score, diagnostic_q2_score, diagnostic_q3_score (1-3)
  diagnostic_revealing_phrase, diagnostic_revealing_reason
  suggested_bucket (fast|slow|low)
  bucket_reasoning

AdminDecision
  id, submission_id, confirmed_bucket, override_note, flagged, decided_at

Problem
  id, role, title, description, zone_criteria{}, trap_definitions[], ambiguous_requirement, messy_data_spec, hidden_constraint

LearningCompletion
  id, participant_id, role, section_1_viewed, section_2_viewed, section_3_viewed, section_4_viewed
```

---

## 11. Scoring Prompt Architecture

Five prompts, one per dimension. Each prompt is:

- Parameterised — receives problem spec, trap definitions, and zone criteria at runtime so prompts are not hardcoded to a specific problem
- Role-configurable — the evidence markers for AI fingerprint are passed as config, not hardcoded
- Structured output — Claude returns JSON with scores, reasoning, and evidence so the application layer can parse and store cleanly
- Auditable — all raw Claude responses are stored alongside parsed scores so the admin can inspect the full reasoning if needed

Prompt library is maintained as files in the codebase — not in the database — so they can be version-controlled and iterated on as scoring quality improves.

---

## 12. What's Not in Scope (v1)

- Git integration or commit history analysis
- Video or async interview recording
- Participant-facing progress dashboard beyond the post-assessment summary
- Email or notification system — admin manages communication manually
- Multi-admin or team lead access
- Mobile-optimised participant UI (desktop-first is fine for v1)
- Learning module content authoring UI — content is markdown files in the codebase for v1

---

## 13. Open Questions Before Build

1. **Diagnostic question wording** — three questions need final wording locked before scoring prompts can be written. Intent is defined (section 5.3), exact wording TBD.
2. **Problem bank — initial three problems** — problem design for the engineering hackathon needs to be finalised and trap definitions written before go-live. This is a content task, not an engineering task.
3. **Participant communication** — how participants are told about the platform, what framing they receive, and what the post-assessment summary says. Needs to be consistent with the learning-first positioning.
4. **Cycle 2 problem availability** — by the time the first retake cycle runs (2–3 months post-launch), additional problems need to be in the bank so participants don't repeat. Problem authoring cadence needs to be planned.

---

## 14. Build Sequence

**Phase 1 — Core assessment loop**
Participant portal (token entry, problem selection, submission, diagnostic), zip upload and storage, scoring engine (all five dimensions), admin individual view, bucket confirmation flow.

**Phase 2 — Learning module**
Four-section learning content for engineering role, completion tracking, learning completion visible in admin dashboard alongside scores.

**Phase 3 — Improvement tracking**
Cycle management, delta view per participant, cohort aggregate view, retake problem assignment logic.

**Phase 4 — Role expansion**
Role architecture, collections agent scenario-based assessment type, collections learning track, role filter in admin dashboard.