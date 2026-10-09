// src/app/guides/chatgpt-vs-fitness-app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import {
  ArticleLayout,
  Bullets,
  Callout,
  CompareTable,
  Em,
  H2,
  H3,
  P,
  Strong,
} from "@/components/content/ArticleLayout";
import { guide } from "@/content/guides";
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

const SLUG = "chatgpt-vs-fitness-app";
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
      <H2 id="difference">The actual difference</H2>
      <P>
        Almost every comparison of these two gets the axis wrong. It is not
        smart versus dumb, or flexible versus rigid. A general chatbot and a
        training app are different <Em>kinds of thing</Em>:
      </P>
      <Callout>
        One is a conversation. The other is a record. A conversation is
        better at answering today&apos;s question; a record is better at
        answering next month&apos;s.
      </Callout>
      <P>
        Every difference below follows from that, including the ones where
        the chatbot wins.
      </P>

      <H2 id="comparison">Side by side</H2>
      <CompareTable
        left="General chatbot"
        right="App with a training log"
        rows={[
          {
            aspect: "First plan",
            left: "Excellent. Fast, flexible, explains its reasoning",
            right: "Good, but usually via a setup questionnaire",
          },
          {
            aspect: "Twelfth plan",
            left: "No better than the first — nothing carried forward",
            right: "Built on eleven sessions of real data",
          },
          {
            aspect: "Progressive overload",
            left: "Only if you paste your history in every time",
            right: "Derived from what you logged",
          },
          {
            aspect: "Answering an odd question",
            left: "Very good. Nothing is off-script",
            right: "Depends entirely on the product",
          },
          {
            aspect: "After a missed week",
            left: "Plan unchanged; you are behind it",
            right: "Should adjust — check that it does",
          },
          {
            aspect: "Your training record",
            left: "A chat history you cannot query",
            right: "The point of the thing",
          },
          {
            aspect: "Cost",
            left: "Free, or bundled with a subscription you have",
            right: "A few dollars a month",
          },
          {
            aspect: "Effort from you",
            left: "Re-explaining yourself, every session",
            right: "Logging, which takes seconds",
          },
        ]}
      />

      <H2 id="chatbot-wins">When the chatbot is the right answer</H2>
      <P>
        Genuinely, and more often than fitness companies admit:
      </P>
      <Bullets
        items={[
          <>
            <Em>You want one session, not a programme.</Em> Hotel room,
            forty minutes, no kit — a chatbot answers this perfectly and
            installing anything would be absurd.
          </>,
          <>
            <Em>You want to understand something.</Em> Why this exercise, why
            this rep range, what a superset is for. Conversation beats a
            product interface for this every time.
          </>,
          <>
            <Em>You already keep a log.</Em> If you maintain a spreadsheet
            and will paste it in, you have the record problem solved and the
            chatbot is the better reasoning engine.
          </>,
          <>
            <Em>You are trying things out.</Em> Not yet committed, not ready
            to pay for anything. Start free and see whether the habit holds.
          </>,
        ]}
      />

      <H2 id="app-wins">When an app is the right answer</H2>
      <Bullets
        items={[
          <>
            <Em>You intend to train for months, not weeks.</Em> The value of
            a record compounds, and it only exists if something captured it
            from the start.
          </>,
          <>
            <Em>You have stopped and restarted before.</Em> The restart is
            where a record earns its keep — it tells you where you actually
            were rather than where you think you were.
          </>,
          <>
            <Em>You will not maintain a spreadsheet.</Em> Most people will
            not. This is not a character flaw, it is a prediction worth
            making honestly before choosing a system.
          </>,
          <>
            <Em>You want the decision made for you.</Em> Opening an app that
            says &ldquo;today, this&rdquo; removes a daily negotiation that
            a blank chat box reopens every time.
          </>,
        ]}
      />

      <H2 id="ai-in-apps">&ldquo;AI-powered&rdquo; covers two different things</H2>
      <P>
        Worth checking which one you are buying, because the label is
        applied to both:
      </P>
      <Bullets
        items={[
          <>
            <Em>Template with variables.</Em> A fixed programme structure
            with your numbers filled in. Often perfectly good, and not
            meaningfully a conversation.
          </>,
          <>
            <Em>Model reading your log.</Em> Your recorded sessions are
            passed to a language model, so replies cite what you did. This
            is what makes an answer specific rather than generic.
          </>,
        ]}
      />
      <P>
        The test takes one question. Ask it something that requires memory —{" "}
        <Em>&ldquo;what did I lift last Tuesday?&rdquo;</Em> — and see
        whether the answer is specific or a paraphrase of your goal setting.
      </P>

      <H2 id="honest">Where we stand</H2>
      <P>
        <Link
          href="/"
          className="text-white underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-[#CCFF00]"
        >
          AdimFit
        </Link>{" "}
        is the second kind: sessions you log are passed to the model, so it
        answers from your history rather than your intentions. That is the
        product, and it is why this page exists, so treat the recommendation
        with the scepticism it deserves.
      </P>
      <P>
        What we will not claim: that a chatbot is useless for this. It is
        not. If you are going to keep your own log, the free option is
        genuinely competitive, and the honest reason most people should not
        rely on it is that <Strong>most people will not keep the log</Strong>.
      </P>

      <H3>The short version</H3>
      <P>
        One question, one session, or a spreadsheet you actually maintain —
        use the chatbot. Months of training with no appetite for
        record-keeping — use something that remembers. The failure mode to
        avoid is drifting between the two and ending up with neither a plan
        nor a record.
      </P>
    </ArticleLayout>
  );
}
