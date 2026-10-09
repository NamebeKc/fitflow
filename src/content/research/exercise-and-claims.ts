// src/content/research/exercise-and-claims.ts

/**
 * ── A CITABLE PAGE, NOT A SALES PAGE ────────────────────────────────
 * Content for `/research/does-exercise-reduce-health-insurance-claims`.
 *
 * WHY THIS EXISTS. Every marketing page on this site asserts things
 * about exercise. This is the page that shows the working. It is also
 * the single most citable asset AdimFit owns: assistants and search
 * engines surface sourced, specific, self-correcting writing far more
 * readily than product copy, and a page that concedes an
 * inconvenient finding is the kind of page they quote.
 *
 * WHAT IS DELIBERATELY WITHHELD. This is drawn from an internal
 * evidence brief that also contains competitive analysis, pitch
 * framing, budget-holder analysis and price anchoring. None of that
 * is here. The evidence is public; the commercial strategy built on
 * it is not.
 *
 * THE HEADLINE FINDING RUNS AGAINST INTEREST. The honest answer to
 * the title question is "less reliably than the industry claims", and
 * saying so is the point. A fitness company publishing the two
 * randomised trials that found no effect on spending is making a
 * costly signal, and a costly signal is the only kind that carries
 * information.
 *
 * EVERY NUMBER HERE IS TRACEABLE. If a figure cannot be tied to an
 * entry in CITATIONS, it does not belong on the page.
 * ─────────────────────────────────────────────────────────────────────
 */

export const ARTICLE = {
  slug: "does-exercise-reduce-health-insurance-claims",
  title: "Does exercise reduce health insurance claims?",
  subtitle:
    "What the randomised trials, the insurer data and the app studies actually show — including the parts that do not favour us.",
  description:
    "A sourced review of whether physical activity programmes reduce healthcare claims. Randomised trials of workplace wellness found no effect on medical spending. Insurer data shows savings only among highly engaged members, with a two-to-three-year lag. Fitness apps raise activity by a directly pooled +753 steps per day.",
  published: "2026-09-21",
  modified: "2026-09-21",
  readingMinutes: 11,
} as const;

export interface Citation {
  id: string;
  authors: string;
  year: number;
  title: string;
  publication: string;
  identifier?: string;
  url: string;
  /** Why a reader should weigh this source the way we do. */
  weight: string;
}

export const CITATIONS: Citation[] = [
  {
    id: "jones-2019",
    authors: "Jones D, Molitor D, Reif J",
    year: 2019,
    title:
      "What do workplace wellness programs do? Evidence from the Illinois Workplace Wellness Study",
    publication: "The Quarterly Journal of Economics 134(4): 1747–1791",
    identifier: "doi:10.1093/qje/qjz023",
    url: "https://academic.oup.com/qje/article/134/4/1747/5550759",
    weight:
      "Randomised. The strongest evidence on this page, and the least convenient.",
  },
  {
    id: "song-2019",
    authors: "Song Z, Baicker K",
    year: 2019,
    title:
      "Effect of a workplace wellness program on employee health and economic outcomes: a randomized clinical trial",
    publication: "JAMA 321(15): 1491–1501",
    identifier: "PMID 30990549",
    url: "https://pubmed.ncbi.nlm.nih.gov/30990549/",
    weight: "Cluster-randomised across 160 worksites. 18-month follow-up.",
  },
  {
    id: "cornelissen-2013",
    authors: "Cornelissen VA, Smart NA",
    year: 2013,
    title:
      "Exercise training for blood pressure: a systematic review and meta-analysis",
    publication: "Journal of the American Heart Association 2(1): e004473",
    identifier: "PMID 23525435",
    url: "https://pubmed.ncbi.nlm.nih.gov/23525435/",
    weight: "Meta-analysis of 93 randomised trials, n = 5,223.",
  },
  {
    id: "lancet-2025",
    authors: "Ding D, Nguyen B, Nau T, et al.",
    year: 2025,
    title:
      "Daily steps and health outcomes in adults: a systematic review and dose-response meta-analysis",
    publication: "The Lancet Public Health",
    identifier: "PMID 40713949",
    url: "https://pubmed.ncbi.nlm.nih.gov/40713949/",
    weight:
      "57 studies, 160,000+ adults. The authors flag low certainty for several outcomes.",
  },
  {
    id: "paluch-2022",
    authors: "Paluch AE, Bajpai S, Bassett DR, et al.",
    year: 2022,
    title:
      "Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts",
    publication: "The Lancet Public Health 7(3): e219–e228",
    identifier: "PMID 35247352",
    url: "https://pubmed.ncbi.nlm.nih.gov/35247352/",
    weight: "Observational cohorts, ~50,000 people. Establishes the plateau.",
  },
  {
    id: "carlson-2015",
    authors: "Carlson SA, Fulton JE, Pratt M, Yang Z, Adams EK",
    year: 2015,
    title:
      "Inadequate physical activity and health care expenditures in the United States",
    publication: "Progress in Cardiovascular Diseases 57(4): 315–323",
    identifier: "PMID 25559060",
    url: "https://pubmed.ncbi.nlm.nih.gov/25559060/",
    weight: "National survey attribution. Association, not causation.",
  },
  {
    id: "matjasko-2025",
    authors: "Matjasko JL, Carlson SA, Whitfield GP, et al.",
    year: 2025,
    title:
      "Health care expenditures attributable to inadequate physical activity among US adults",
    publication: "American Journal of Health Promotion",
    identifier: "doi:10.1177/08901171251357128",
    url: "https://journals.sagepub.com/doi/10.1177/08901171251357128",
    weight:
      "Updates Carlson et al. Adjusted for smoking, obesity, age and insurance status.",
  },
  {
    id: "patel-2010",
    authors: "Patel D, Lambert EV, da Silva R, et al.",
    year: 2010,
    title:
      "The association between medical costs and participation in the Vitality health promotion program among 948,974 members of a South African health insurance company",
    publication: "American Journal of Health Promotion 24(3): 199–204",
    identifier: "PMID 20073387",
    url: "https://pubmed.ncbi.nlm.nih.gov/20073387/",
    weight: "Cross-sectional, one year. Selection effects not excluded.",
  },
  {
    id: "patel-2011",
    authors: "Patel DN, Lambert EV, da Silva R, et al.",
    year: 2011,
    title:
      "Participation in fitness-related activities of an incentive-based health promotion program and hospital costs: a retrospective longitudinal study",
    publication: "American Journal of Health Promotion 25(5): 341–348",
    identifier: "PMID 21534837",
    url: "https://pubmed.ncbi.nlm.nih.gov/21534837/",
    weight:
      "Five years, electronically documented gym visits. Longitudinal but not randomised.",
  },
  {
    id: "hajat-2019",
    authors: "Hajat C, Hasan A, Subel S, Noach A",
    year: 2019,
    title:
      "The impact of short-term incentives on physical activity in a UK behavioural incentives programme",
    publication: "npj Digital Medicine 2: 91",
    identifier: "doi:10.1038/s41746-019-0164-3",
    url: "https://www.nature.com/articles/s41746-019-0164-3",
    weight: "Observational, n = 11,881. Measures activity, not claims.",
  },
  {
    id: "laranjo-2021",
    authors:
      "Laranjo L, Ding D, Heleno B, Kocaballi AB, Quiroz JC, Tong HL, et al.",
    year: 2021,
    title:
      "Do smartphone applications and activity trackers increase physical activity in adults? Systematic review, meta-analysis and metaregression",
    publication: "British Journal of Sports Medicine 55(8): 422–432",
    identifier: "PMID 33355160",
    url: "https://pubmed.ncbi.nlm.nih.gov/33355160/",
    weight:
      "28 randomised trials, n = 7,454. The source of the correction logged on this page.",
  },
];

export function citation(id: string): Citation {
  const found = CITATIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`[research] unknown citation: ${id}`);
  return found;
}

/**
 * The five questions this page is written to answer, phrased the way
 * people actually ask them. These feed the `FAQPage` schema, so each
 * answer has to stand alone when lifted out of the page entirely.
 */
export const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: "Does exercise reduce health insurance claims?",
    answer:
      "Less reliably than the wellness industry claims. Two large randomised trials found no significant effect of workplace wellness programmes on medical spending. Insurer data does show lower admissions, but only among highly engaged members and only after two to three years. Physical activity itself clearly reduces disease risk; a programme that offers it does not automatically reduce claims.",
  },
  {
    question: "How much does physical inactivity cost healthcare systems?",
    answer:
      "Around 11–13% of aggregate US healthcare spending is associated with inadequate physical activity. The 2025 estimate is 12.6% (95% CI 10.5–14.3), about $205 billion. Inactive adults incur roughly $2,025 more per year than active adults, adjusted for smoking, obesity, age and insurance status. These are associations from national surveys, not causal estimates.",
  },
  {
    question: "Do fitness apps and activity trackers actually increase activity?",
    answer:
      "Yes, modestly. Across 28 randomised trials the pooled effect was SMD 0.350 (95% CI 0.236–0.465). Among the 21 trials that measured steps directly, the raw pooled difference was +753 steps per day (95% CI 440–971). Personalised and message-driven interventions outperformed the rest in both subgroup analysis and metaregression.",
  },
  {
    question: "Do workplace wellness programmes lower medical spending?",
    answer:
      "The randomised evidence says no, at least within 18 months. The Illinois Workplace Wellness Study found no significant effect on spending, biometrics or utilisation, with confidence intervals ruling out 84% of previous estimates. The BJ's Wholesale trial raised self-reported exercise by 8.3 percentage points with no change in clinical markers, healthcare use or spending.",
  },
  {
    question: "How many steps a day do you need for health benefits?",
    answer:
      "Benefits accumulate fastest at low step counts and level off around 7,000 per day. Compared with 2,000 steps, 7,000 was associated with 47% lower all-cause mortality, 25% lower cardiovascular disease and 14% lower type 2 diabetes. Mortality benefit plateaued at 6,000–8,000 steps for adults over 60 and 8,000–10,000 for those under 60.",
  },
];

/**
 * The correction, kept visible.
 *
 * An earlier version of the internal brief this page draws on cited
 * +1,850 steps/day. That figure is real and appears in the paper, but
 * it is the pooled SMD converted back into steps using a standard
 * deviation pooled across trials that measured different things. The
 * directly pooled step estimate is 40% of it. Publishing the error
 * alongside the fix is more persuasive than quietly shipping the
 * right number, and it is the honest record of how the page was made.
 */
export const CORRECTION = {
  date: "2026-09-21",
  summary:
    "Corrected the daily-step effect of fitness apps from +1,850 to +753 steps per day.",
  detail:
    "Both figures come from Laranjo et al. 2021. The +1,850 figure is the pooled standardised mean difference (SMD 0.350) converted back into steps using a standard deviation pooled across all 28 trials — trials that variously measured step counts, moderate-to-vigorous activity minutes, accelerometer counts and self-reported activity. The +753 figure is the raw pooled difference in means from the 21 trials that actually counted steps. Converting a standardised effect into a physical unit inflates the estimate whenever the pooled standard deviation is wider than that of the trials measuring the unit, which is what happened here. Where a meta-analysis reports both a standardised effect and a unit conversion of it, the directly pooled unit estimate is the one to quote.",
  table: [
    {
      estimate: "Pooled effect",
      value: "SMD 0.350 (95% CI 0.236–0.465)",
      meaning: "28 trials, n = 7,454, mixed activity outcomes",
      preferred: false,
    },
    {
      estimate: "Daily steps, directly pooled",
      value: "+753/day (95% CI 440–971)",
      meaning: "The 21 trials that measured step counts",
      preferred: true,
    },
    {
      estimate: "Daily steps, SMD-converted",
      value: "+1,850/day (95% CI 1,247–2,457)",
      meaning: "The SMD back-converted using a pooled standard deviation",
      preferred: false,
    },
  ],
} as const;
