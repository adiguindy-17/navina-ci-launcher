# Deep Dive — Use Case Template
# Use case: deep_dive
# Version: v0.1
# Last updated: 2026-06-07

## Purpose
A thorough, competitor-first profile of a single company. Synthesizes all available internal and web research into a structured 7-section output.

This template is competitor-first. Navina is not mentioned unless directly relevant to a comparison, benchmark, or positioning claim. There are no hardcoded Navina KPIs, no embedded battlecard, no discovery questions, and no sales talk track.

---

## When to Use
- User selects use case: Deep Dive
- Intent: understand a competitor in depth — product, market position, clinical capabilities, business model, customer evidence, and strategic trajectory

---

## Output Structure (7 Sections)

Produce all 7 sections in order. Do not add, merge, or omit sections.
If a section has no available data, write the section header and: "No data available in current sources."

---

### 1. Company Snapshot
Brief factual overview of the company. No marketing language.

Cover:
- Founded, HQ, funding stage and total raised (with dates if known)
- Headcount range or growth stage (seed / growth / public)
- Primary market segment (payer, provider, ACO/MSO, pharma, etc.)
- One-line summary of what the product does at its core
- Any notable recent events (acquisition, IPO filing, leadership change) — date required

Do not: write a company history essay. Keep this to 5–7 bullets maximum.

---

### 2. Product and Capabilities
What the product actually does. Functionality over marketing claims.

Cover:
- Core product modules or features (name them if named)
- Workflow: where in the clinical or administrative workflow does the product operate?
- Data sources ingested (claims, HIE, EHR, unstructured, imaging, etc.)
- AI / ML approach (if described — ambient, NLP, predictive model, etc.)
- EHR integrations: which EHRs, what level of integration (native embed, SSO, standalone)?
- User roles supported (clinician, coder, care manager, administrator, etc.)

Cite every capability claim. Do not infer capabilities not present in available sources.

---

### 3. Market Position and Customer Base
Who buys this product and why.

Cover:
- Named customers (only if publicly disclosed)
- Target segment: size of org, geography, payer mix, care model (VBC, FFS, hybrid)
- Market traction indicators: customer count, covered lives, provider count, growth metrics (cite source and date)
- Go-to-market model: direct sales, channel, embedded in EHR marketplace, etc.
- Any known contract wins, renewals, or losses (date required)

Do not invent customer names. If customer evidence is anonymized in internal data, describe without naming.

---

### 4. Clinical and VBC Capabilities
Depth of clinical relevance and value-based care support. This section is the most important for Navina's competitive context.

Cover:
- Risk adjustment: HCC model support (CMS-HCC v28, HHS-HCC, RxHCC, ESRD), workflow type (prospective/retrospective/hybrid), coder support
- Quality performance: HEDIS/Stars measures supported, gap closure workflow (point-of-care vs. post-visit), outreach capability
- Clinical evidence linkage: does the product link AI suggestions to clinical evidence or documentation?
- Accuracy / validation: any independently validated metrics for AI suggestion quality or RAF impact
- Point-of-care presence: embedded in EHR workflow or separate tool requiring context switch?

If the company does not operate in VBC/risk adjustment, state that clearly and describe what clinical workflow they do support.

---

### 5. Business Model and Pricing
How the company makes money.

Cover:
- Pricing model (per-seat, per-visit, shared savings, platform fee, per-member-per-month, etc.)
- Contract structure (annual, multi-year, usage-based)
- Implementation and onboarding fees if known
- Any public pricing or pricing signals from press/filings

If pricing is not publicly available, say so. Do not estimate without a source.

---

### 6. Strengths and Risks
An honest assessment based only on available evidence.

**Strengths** (evidence-backed only):
- List 3–5 genuine, source-backed strengths
- Each strength must cite its source

**Risks / Weaknesses** (evidence-backed only):
- List 3–5 risks or weaknesses grounded in available data
- Acceptable sources: product gaps visible in documentation, customer complaints in public reviews, analyst caveats, structural limitations (e.g., retrospective-only workflow, single EHR dependency)
- Do not fabricate weaknesses. Do not infer weaknesses from silence.
- If a weakness is speculative, label it: "(inferred, not confirmed)"

---

### 7. Recent Developments and Strategic Direction
What has changed in the last 12–18 months and where the company appears to be heading.

Cover:
- Product launches or major feature releases (date required)
- Funding rounds or M&A activity (date required)
- Leadership changes (date required)
- Partnerships or EHR integrations announced
- Strategic signals: pricing changes, new market segments, regulatory filings, conference presence
- Any stated strategic vision from CEO/leadership (quote with source if available)

This section relies heavily on web search. If no recent news is found, say so.

---

## Constraints

- **Competitor-first**: Do not open with Navina context. Do not add a Navina comparison section.
- **No hardcoded KPIs**: Do not embed Navina metrics in this template. If Navina comparison is needed, it comes from the retrieval assets injected at runtime.
- **No embedded battlecard**: The battlecard is a separate use case. Do not include win/loss framing, sales objection handling, or talk tracks.
- **No discovery questions**: This is a research output, not a sales prep guide.
- **Source every claim**: Follow source-discipline.md for citation format and confidence handling.
- **Follow writing-style.md**: Lead with the answer, bullets by default, no marketing language.
