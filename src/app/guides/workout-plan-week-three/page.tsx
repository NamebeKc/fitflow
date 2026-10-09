// src/app/guides/workout-plan-week-three/page.tsx
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
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

const SLUG = "workout-plan-week-three";
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
      <H2 id="not-discipline">It is not discipline</H2>
      <P>
        The story everyone tells about week three is a story about
        willpower: you were motivated, the motivation faded, you stopped.
        It is a tidy story and it puts the fault in a convenient place.
      </P>
      <P>
        There is a duller explanation that fits better. Weeks one and two
        were unusually clean — you chose the start date, so of course they
        were. Week three is simply the first <Em>ordinary</Em> week, and
        most plans are not written for ordinary weeks.
      </P>
      <Callout>
        A plan that only works during a good week is not a plan. It is a
        best-case schedule, and best cases are rare by definition.
      </Callout>

      <H2 id="what-happens">What actually happens</H2>
      <P>Three mechanisms, usually together.</P>

      <H3>1. The plan assumes a week that does not exist</H3>
      <P>
        Monday, Wednesday, Friday. Four sessions. Every week, indefinitely.
        No travel, no late meeting, no sick child, no night your sleep goes
        wrong. Written down it looks reasonable; described as a prediction
        about the next three months it is obviously false.
      </P>
      <P>
        So a Wednesday goes. The plan has no instruction for that, because
        it was never written with the possibility in mind. You are now
        improvising, and improvising is the thing the plan existed to spare
        you.
      </P>

      <H3>2. One missed session becomes a reset</H3>
      <P>
        This is where it turns. A missed Wednesday should cost one session.
        Instead it usually costs the programme, because of how the miss gets
        framed: the streak broke, the week is ruined, you will start again
        Monday.
      </P>
      <P>
        Monday arrives and restarting means repeating a week you already
        did, which is dull, so you do not. The gap widens. By the time you
        return, returning means admitting a failure — and that is a much
        higher barrier than the Wednesday session ever was.
      </P>
      <Callout>
        The streak framing does the damage. A rest day you did not plan is
        not a broken streak. It is a Tuesday.
      </Callout>

      <H3>3. Nobody wrote anything down</H3>
      <P>
        Come back after ten days and you need one piece of information:
        what were you actually lifting? Without it you either guess low and
        waste a fortnight, or guess high, feel awful, and confirm the story
        that you have lost everything.
      </P>
      <P>
        You have not lost everything. Ten days off costs very little. But
        without a record you cannot know that, and the feeling of having
        lost it does the same work as actually having lost it.
      </P>

      <H2 id="restart">Why &ldquo;just start over&rdquo; is bad advice</H2>
      <P>
        Restarting throws away real adaptation and frames the gap as
        failure, which is precisely the feeling that ends the next attempt
        too. Unless you have been away for months, resume near where you
        stopped:
      </P>
      <Bullets
        items={[
          <>
            First session back, go <Em>lighter than you think you need to</Em>
            . Treat it as re-entry, not a test.
          </>,
          <>
            Do a shorter session than the plan asks for. Twenty minutes that
            happen beat forty that do not.
          </>,
          <>
            Do not add the missed sessions to this week. Compensating is how
            a small gap turns into an injury.
          </>,
          <>
            Write down what you did. Whatever else, break the cycle where
            the next gap is just as disorienting.
          </>,
        ]}
      />

      <H2 id="what-works">What a plan that survives a bad week looks like</H2>
      <P>Four properties. None of them require an app.</P>
      <Bullets
        items={[
          <>
            <Em>It has a short version.</Em> Every session should have a
            twenty-minute form you can fall back on without deciding what to
            cut in the moment.
          </>,
          <>
            <Em>It is built on what you did, not what was scheduled.</Em>{" "}
            Next week should follow from the sessions that happened.
          </>,
          <>
            <Em>It treats rest as part of training.</Em> Not a lapse to be
            made up. Unplanned rest is still rest.
          </>,
          <>
            <Em>It keeps a record.</Em> So returning is a lookup rather than
            an act of archaeology.
          </>,
        ]}
      />
      <P>
        A notebook does all four if you are disciplined about it. So does a
        good coach. So, for what it is worth, does{" "}
        <Link
          href="/"
          className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-indigo"
        >
          AdimFit
        </Link>
        , which is built around exactly this failure — sessions logged in
        seconds, plans rebuilt from what you actually did, and rest days
        that do not break anything.
      </P>

      <H2 id="bottom-line">The one thing to take away</H2>
      <P>
        Week three is not a test of character you failed. It is the first
        week that behaved like a normal week, meeting a plan that assumed
        none of them would.
      </P>
      <P>
        Pick a plan that expects <Strong>to be interrupted</Strong>. Then
        being interrupted is not an event.
      </P>
    </ArticleLayout>
  );
}
