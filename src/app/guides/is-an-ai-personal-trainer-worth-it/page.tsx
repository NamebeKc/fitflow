// src/app/guides/is-an-ai-personal-trainer-worth-it/page.tsx
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
  Strong,
} from "@/components/content/ArticleLayout";
import { guide } from "@/content/guides";
import { PLANS, TRIAL_DAYS } from "@/lib/plan-catalogue";
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

const SLUG = "is-an-ai-personal-trainer-worth-it";
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
      <H2 id="what-it-means">What the phrase covers</H2>
      <P>
        &ldquo;AI personal trainer&rdquo; is applied to at least three
        different products, and the differences matter more than the label:
      </P>
      <Bullets
        items={[
          <>
            <Em>A template with variables.</Em> A fixed structure with your
            numbers filled in. Often good, and not a conversation.
          </>,
          <>
            <Em>A model reading your training log.</Em> Your recorded
            sessions are passed to a language model, so answers cite what
            you actually did.
          </>,
          <>
            <Em>Camera-based movement analysis.</Em> Your phone watches you
            lift. Real, and much more limited than the demos suggest.
          </>,
        ]}
      />
      <P>
        Most of what is sold is the first two. Judge the specific product,
        not the category.
      </P>

      <H2 id="cannot">The four things it cannot do</H2>
      <P>
        Stated plainly, because the marketing in this category rarely does.
      </P>

      <H3>1. Correct your form reliably</H3>
      <P>
        Camera-based checking exists and is constrained by angle, lighting,
        framing and clothing. It cannot see what a coach sees or feel what a
        coach feels through a bar. Treat any claim of reliable form
        correction with suspicion — including from us, which is why{" "}
        <Strong>AdimFit does not attempt it at all</Strong>. It works from
        what you log, not from watching you.
      </P>

      <H3>2. Make you turn up</H3>
      <P>
        A notification is not an appointment. The social obligation of a
        person expecting you at 7am is the single hardest thing to
        replicate, and no app has replicated it. If accountability was what
        you were buying, an app is the weakest option available.
      </P>

      <H3>3. Notice what you did not mention</H3>
      <P>
        A coach sees you limping across the gym. A model knows only what you
        typed. If you do not mention the shoulder, nothing accounts for the
        shoulder.
      </P>

      <H3>4. Take responsibility</H3>
      <P>
        A certified trainer carries insurance, a professional body and a
        duty of care. Software carries terms of service. For general
        training that distinction rarely bites; for rehabilitation or a
        medical condition it is the whole thing.
      </P>

      <H2 id="can">What it does do well</H2>
      <Bullets
        items={[
          <>
            <Em>Programming and progression.</Em> The most systematisable
            part of coaching, and the part software genuinely handles.
          </>,
          <>
            <Em>Memory.</Em> A record of every session, and plans built from
            it rather than from what you recall.
          </>,
          <>
            <Em>Adjustment on demand.</Em> Twenty minutes and a hotel room
            at 10pm, answered instantly and without apology.
          </>,
          <>
            <Em>Answering questions.</Em> Why this exercise, why this rep
            range, what to drop if you are short on time.
          </>,
          <>
            <Em>Availability.</Em> 5am on a Sunday, with no booking.
          </>,
        ]}
      />

      <H2 id="maths">The arithmetic</H2>
      <P>
        At {PLANS.monthly_usd.display} a month, the bar is low. A US session
        averages around $70; twice a week for a year runs to roughly
        $7,280. An app at{" "}
        {PLANS.annual_usd_2026.display} a year clears its cost if it
        produces <Strong>one extra session a week</Strong> — and by a very
        wide margin.
      </P>
      <Callout>
        The real cost is not the subscription. It is the month you spend
        with an app you do not open, when what you needed was a person
        expecting you on Tuesday.
      </Callout>

      <H2 id="who">Who it is worth it for</H2>
      <Bullets
        items={[
          <>
            You know the movements already and need a plan and a record, not
            supervision.
          </>,
          <>
            You have trained before, stopped, and want to restart without
            guessing where you were.
          </>,
          <>
            Your week is unpredictable enough that fixed appointments keep
            failing.
          </>,
          <>
            A trainer is simply out of reach financially, and the honest
            alternative is nothing.
          </>,
        ]}
      />

      <H2 id="who-not">Who should not bother</H2>
      <Bullets
        items={[
          <>
            Learning barbell lifts from scratch with nobody watching. Buy a
            few real sessions first.
          </>,
          <>
            Rehabilitating an injury or training with a medical condition.
            See a professional.
          </>,
          <>
            Preparing for a competition with specific technical demands.
          </>,
          <>
            Anyone who already knows from experience that only a booked
            appointment with a human gets them moving. Believe yourself.
          </>,
        ]}
      />

      <H2 id="test">How to judge one in a week</H2>
      <P>
        Three tests, in order. Most products fail the first.
      </P>
      <Bullets
        items={[
          <>
            <Em>The memory test.</Em> Log two sessions, then ask what you
            did last time. A specific answer means it is reading your log. A
            paraphrase of your goals means it is not.
          </>,
          <>
            <Em>The bad-week test.</Em> Skip three days on purpose, then
            open it. Does the plan adjust, or are you simply behind?
          </>,
          <>
            <Em>The friction test.</Em> Time yourself logging a session. If
            it is a chore on day three, you will not be doing it on day
            thirty, and everything else depends on it.
          </>,
        ]}
      />

      <H2 id="verdict">The verdict</H2>
      <P>
        Worth it if you need programming and memory, and you will open it.
        Not worth it if you needed a person — and no amount of software
        changes which of those is true for you.
      </P>
      <P>
        <Link
          href="/"
          className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-moss"
        >
          AdimFit
        </Link>{" "}
        has a {TRIAL_DAYS}-day free trial with no card, which exists mostly
        so you can run those three tests on it. If it fails the friction
        test, that is worth knowing in week one rather than month three.
        And if what you actually need is a human,{" "}
        <Link
          href="/guides/personal-trainer-alternatives"
          className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-moss"
        >
          small-group training
        </Link>{" "}
        is the better buy.
      </P>
    </ArticleLayout>
  );
}
