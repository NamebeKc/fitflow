// src/app/guides/chatgpt-workout-plan/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import {
  ArticleLayout,
  Bullets,
  Callout,
  Em,
  H2,
  H3,
  P,
  PromptBlock,
  Strong,
} from "@/components/content/ArticleLayout";
import { guide } from "@/content/guides";
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

const SLUG = "chatgpt-workout-plan";
const entry = guide(SLUG);

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: `/guides/${SLUG}` },
  openGraph: {
    type: "article",
    title: entry.title,
    description: entry.description,
    url: absoluteUrl(`/guides/${SLUG}`),
    publishedTime: entry.published,
    modifiedTime: entry.modified,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE.url],
  },
};

export default function Page() {
  return (
    <ArticleLayout slug={SLUG}>
      <H2 id="short-answer">The short answer</H2>
      <P>
        Yes. Give ChatGPT your equipment, your available time and an honest
        account of your experience, and it will write a sensibly structured
        plan with reasonable exercise selection. It is roughly as good as a
        competent template, available instantly, and free.
      </P>
      <P>
        That is a real answer to a real problem, and the people dismissing it
        are usually selling something. The limitation is not the first plan.
        It is the second one.
      </P>

      <H2 id="what-it-does-well">What it genuinely does well</H2>
      <P>
        Three things, and they are not trivial.
      </P>
      <Bullets
        items={[
          <>
            <Em>It explains itself.</Em> Ask why it chose Romanian deadlifts
            over conventional and you get an actual answer. Most apps present
            a plan as a fact; a conversation lets you interrogate it.
          </>,
          <>
            <Em>It adapts to constraints instantly.</Em> &ldquo;I only have
            resistance bands and a doorway&rdquo; produces a usable session
            in seconds. No app has every permutation pre-built.
          </>,
          <>
            <Em>It is not intimidated by your situation.</Em> Shift work, a
            dodgy shoulder, thirty-five minutes at 5am — describe it in plain
            language and you get something workable back.
          </>,
        ]}
      />

      <H2 id="prompt">A prompt that gets a decent plan</H2>
      <P>
        Most disappointing results come from thin prompts. The model cannot
        see you, so everything it does not know it invents. This one supplies
        the things it otherwise guesses at:
      </P>
      <PromptBlock label="Copy this into ChatGPT">{`Write me a 4-week training plan.

About me:
- Experience: [beginner / ~1 year / several years]
- Age and sex: [e.g. 34, female]
- Days per week I can train: [3]
- Time per session: [40 minutes]
- Equipment: [full gym / dumbbells up to 20kg / bodyweight only]
- Goal: [get stronger / build the habit / general fitness]
- Injuries or limits: [e.g. left shoulder, avoid overhead pressing]
- What I did last month: [be honest — "almost nothing" is useful information]

Rules:
- Prescribe sets, reps and a starting load I can actually judge.
- Explain how I should progress week to week.
- If a session has to be cut to 20 minutes, tell me what to drop.
- Flag anything I should not attempt without supervision.`}</PromptBlock>
      <P>
        The last two lines matter most. Asking for the shortened version up
        front gives you something to fall back on, and asking what to avoid
        is the closest a chatbot gets to a safety brief.
      </P>

      <H2 id="where-it-breaks">Where it stops working</H2>
      <P>
        Four failures, in the order you will meet them.
      </P>

      <H3>1. It does not know what you did</H3>
      <P>
        This is the big one. Progressive overload — the mechanism by which
        training makes you stronger — requires knowing what you lifted last
        time. Ask for week two and the model will either repeat week one or
        invent a progression, because it has no record of which sessions you
        completed or what load you used.
      </P>
      <P>
        Memory features help less than people expect. What gets retained is a
        loose summary, not a structured log. It will not reliably tell you
        that you squatted 3 × 10 at 60kg on the eleventh.
      </P>

      <H3>2. The volume is a guess, and it guesses high</H3>
      <P>
        With no way to observe your current capacity, the model produces
        something plausible for the description you gave. Descriptions skew
        optimistic. The result is a first week that leaves beginners too sore
        to attempt the second.
      </P>
      <Callout>
        Start below what it prescribes. If the plan says three sets, do two.
        You can add load next week; you cannot un-injure a shoulder.
      </Callout>

      <H3>3. Confident wrongness is indistinguishable from correctness</H3>
      <P>
        A language model has no uncertainty display. A well-judged
        prescription and an invented one arrive in the same tone, and a
        beginner has no way to tell them apart — which is exactly the reader
        least able to absorb the error.
      </P>

      <H3>4. Nothing accumulates</H3>
      <P>
        After eight weeks you have a chat history and no training record. You
        cannot see whether you trained more in August than July, what your
        squat has done, or which sessions you skipped. The information that
        would make month three better than month one was never captured.
      </P>

      <H2 id="what-to-do">What to do about it</H2>
      <P>
        Two approaches work. Both solve the same problem, which is the
        missing record.
      </P>

      <H3>Keep the log yourself</H3>
      <P>
        A notebook or a spreadsheet: date, exercise, sets, reps, load. Paste
        the last three or four sessions into every new conversation and ask
        for the next one. This genuinely works, costs nothing, and the
        honest catch is that you have to do it every single time, forever.
        Most people manage a few weeks. If you are someone who keeps a
        spreadsheet current for a year, stop reading — you have your answer.
      </P>

      <H3>Use something that keeps it for you</H3>
      <P>
        The alternative is a tool where logging is part of the loop rather
        than homework, so the plan is built from what you actually did
        instead of what you remembered to mention. That is what{" "}
        <Link
          href="/"
          className="text-white underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-[#CCFF00]"
        >
          AdimFit
        </Link>{" "}
        is: you record a session in seconds, and when you ask what is next
        the answer cites the sessions you logged.
      </P>
      <P>
        We have an obvious interest in you picking the second option. The
        first one is still a real option, and if you will actually maintain
        the spreadsheet it is free.
      </P>

      <H2 id="bottom-line">The bottom line</H2>
      <P>
        ChatGPT writes a good first plan. It cannot write a good{" "}
        <Strong>twelfth</Strong> one, because by then the thing that should
        be driving the plan is a record of eleven sessions that nobody kept.
      </P>
      <P>
        If you take one thing from this: whatever you use, keep the record.
        The tool matters less than the fact that something remembers.
      </P>
    </ArticleLayout>
  );
}
