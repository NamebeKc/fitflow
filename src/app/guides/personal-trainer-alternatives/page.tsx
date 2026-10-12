// src/app/guides/personal-trainer-alternatives/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import {
  ArticleLayout,
  Bullets,
  Callout,
  DataTable,
  Em,
  H2,
  H3,
  P,
  Strong,
} from "@/components/content/ArticleLayout";
import { guide } from "@/content/guides";
import { PLANS } from "@/lib/plan-catalogue";
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

const SLUG = "personal-trainer-alternatives";
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
      <H2 id="first">Work out what you were buying</H2>
      <P>
        A trainer sells four things at once — programming, technique
        coaching, accountability and in-the-moment adjustment. Every
        alternative below replaces some and drops others, so the useful
        question is not &ldquo;what is cheapest&rdquo; but{" "}
        <Em>which of the four did you actually need</Em>.
      </P>
      <P>
        Get that wrong and you will buy something cheaper that does not work
        and conclude the cheap options do not work.
      </P>

      <H2 id="options">The six options</H2>
      <DataTable
        columns={["Option", "Rough cost", "Replaces", "Drops"]}
        rows={[
          [
            "Small-group training",
            "⅓ of 1-to-1",
            "Coaching, accountability",
            "Individual attention",
          ],
          [
            "Online coaching",
            "$100–300 / mo",
            "Programming, adjustment",
            "Hands-on correction",
          ],
          [
            "Free programme + notebook",
            "£0",
            "Programming",
            "Everything else",
          ],
          [
            "Training app",
            "$5–15 / mo",
            "Programming, record",
            "Technique, accountability",
          ],
          [
            "A friend who trains",
            "£0",
            "Accountability",
            "Expertise (usually)",
          ],
          [
            "A few trainer sessions",
            "3–6 sessions",
            "Technique, front-loaded",
            "Ongoing support",
          ],
        ]}
        caption="Cost bands are indicative. See the cost guide for sourced per-session figures."
      />

      <H2 id="small-group">Small-group training — the honest best buy</H2>
      <P>
        Two to six people, one coach, roughly a third of the one-to-one
        rate. In the UK, group sessions run about £20–£30 against a £70
        median for one-to-one.
      </P>
      <P>
        You lose some individual attention. You gain a coach who still
        corrects you, and — this is the part people underrate — other people
        who notice when you do not turn up.
      </P>
      <Callout>
        If what you actually needed was a human being, buy this before you
        buy any app. We sell an app and this is still the advice.
      </Callout>

      <H3>Who it is wrong for</H3>
      <P>
        Anyone with an injury needing individual programming, anyone whose
        schedule will not survive fixed class times, and anyone who will not
        go to a room with strangers in it. That last one is a real
        constraint, not a character flaw.
      </P>

      <H2 id="online-coaching">Online coaching</H2>
      <P>
        A real human writes your programme and reviews check-ins, usually
        including video you film yourself. Typically $100–$300 a month —
        cheaper than in-person, still a considerable commitment.
      </P>
      <P>
        Good when you need individual programming and can film your own
        lifts. Weak on accountability: a message is easier to ignore than
        someone standing in a gym expecting you.
      </P>

      <H2 id="free">A free programme and a notebook</H2>
      <P>
        Genuinely underrated. Reputable beginner programmes are free,
        well-tested, and better than most paid plans. Pair one with a
        notebook — date, exercise, sets, reps, load — and you have
        programming and a record for nothing.
      </P>
      <P>
        The catch is not the programme. It is that{" "}
        <Strong>you have to keep the notebook</Strong>, and most people stop
        inside a month. If you know you are the exception, stop reading;
        this is your answer and it costs nothing.
      </P>

      <H2 id="friend">A friend who trains</H2>
      <P>
        Free, and better at accountability than anything you can buy. Two
        cautions: their programme is built for their body and goals, and
        confident bad technique advice from someone you trust is worse than
        no advice. Use them for turning up, not for coaching.
      </P>

      <H2 id="few-sessions">A handful of trainer sessions, front-loaded</H2>
      <P>
        The option almost nobody considers, and often the sharpest. Buy
        three to six sessions, spend them entirely on technique for the
        lifts you intend to do for years, then continue alone.
      </P>
      <P>
        You get the irreplaceable part of a trainer — trained eyes on your
        movement — without the open-ended subscription. Combine it with a
        free programme or an app and you have covered all four needs for a
        few hundred rather than several thousand.
      </P>

      <H2 id="apps">Training apps</H2>
      <P>
        Usually a few dollars a month. They replace programming and
        record-keeping well, which is exactly the pair that fails first when
        people go it alone. They do not replace technique coaching, and any
        app claiming to fully replace a coach&apos;s eye is overselling.
      </P>
      <P>
        <Link
          href="/"
          className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-moss"
        >
          AdimFit
        </Link>{" "}
        is one of these — {PLANS.monthly_usd.display} a month or{" "}
        {PLANS.annual_usd_2026.display} a year, built so that each session
        is planned from the ones you logged. Take the recommendation with
        the scepticism it deserves, and see{" "}
        <Link
          href="/guides/is-an-ai-personal-trainer-worth-it"
          className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-moss"
        >
          the four things an AI coach cannot do
        </Link>{" "}
        before deciding.
      </P>

      <H2 id="picking">Picking</H2>
      <Bullets
        items={[
          <>
            Needed <Em>technique</Em> → a few trainer sessions, or small
            group. No app substitutes for this.
          </>,
          <>
            Needed <Em>accountability</Em> → small group, or a friend. An
            app is the weakest option here and it is worth being honest
            about that.
          </>,
          <>
            Needed <Em>programming and a record</Em> → an app, or a free
            programme and a notebook if you will keep it.
          </>,
          <>
            Needed <Em>individual programming</Em> without in-person cost →
            online coaching.
          </>,
        ]}
      />
      <P>
        Most people need two of the four, which is why the best answer is
        usually a combination — a few sessions to learn the lifts, then
        something cheap that keeps the plan and the record going.
      </P>
    </ArticleLayout>
  );
}
