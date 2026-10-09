// src/app/(legal)/privacy/page.tsx
import type { Metadata } from "next";

import { LegalPage, List, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — AdimFit",
  description:
    "What AdimFit collects, why, and who can see it. Your training log is visible to you alone: no employer, gym or trainer can see what you logged.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 2026">
      <Section heading="The short version">
        <p>
          AdimFit stores what you tell it about your training so your coach
          can give advice built on your own history. Your training log is
          visible to you alone — no employer, gym or trainer can see what
          you logged. We do not sell your data, we do not show
          advertising, and you can delete everything at any time.
        </p>
        <p>
          This page explains the detail. It applies to AdimFit, operated by{" "}
          <strong className="font-medium text-ink">Lush Techdia</strong>{" "}
          of{" "}
          <strong className="font-medium text-ink">
            28 Adetola Street, Aguda, Surulere, Lagos, Nigeria
          </strong>{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>
      </Section>

      <Section heading="Who can see your training log">
        <p>
          You, and nobody else. Your workout log, your coach
          conversations and your training profile are visible to your own
          account only. This is stated here plainly rather than left to be
          inferred, because it is the promise the rest of this page exists
          to support — and because it is the one claim we make elsewhere
          that you should be able to hold us to in writing.
        </p>
        <List
          items={[
            <>
              <strong className="font-medium text-ink">
                No employer, gym or trainer can see what you logged.
              </strong>{" "}
              There is no mechanism in AdimFit for granting anyone a view
              of another person&apos;s sessions. No coach dashboard, no gym
              portal, no employer report that names an individual. The
              feature does not exist to be switched on.
            </>,
            <>
              <strong className="font-medium text-ink">
                Referral partners see counts, not people.
              </strong>{" "}
              A trainer or creator who refers members sees how many people
              followed their link, how many created an account, how many
              subscribed, and what they have earned. They do not see who
              those people are, and they never see a training log — no
              name, no email address, no session.
            </>,
            <>
              <strong className="font-medium text-ink">
                A sponsored account is still a private account.
              </strong>{" "}
              Where an organisation pays for accounts, it receives
              aggregate figures across the group and nothing else. Nothing
              in the product reports one named person&apos;s training to
              whoever is paying for it.
            </>,
          ]}
        />
        <p>
          Three ordinary limits apply, and they are the same ones that
          apply to any service that stores anything. The providers listed
          under{" "}
          <strong className="font-medium text-ink">
            Who else processes it
          </strong>{" "}
          handle data on our instructions in order to make the product
          work. Our own staff can reach stored data where operating the
          service requires it — investigating a fault you report, for
          example — and we keep that access to what the task needs. And we
          would comply with a valid legal demand, as we are obliged to.
          None of the three is a route by which an employer, a gym or a
          trainer sees your sessions.
        </p>
      </Section>

      <Section heading="What we collect">
        <p>Only what the product needs to function:</p>
        <List
          items={[
            <>
              <strong className="font-medium text-ink">
                Account details
              </strong>{" "}
              — your email address, and your name and profile photo if you
              sign in with Google.
            </>,
            <>
              <strong className="font-medium text-ink">
                Training profile
              </strong>{" "}
              — first name, age, weight, your goal, preferred activities,
              and optionally where you train and what equipment you have.
            </>,
            <>
              <strong className="font-medium text-ink">
                Workout log
              </strong>{" "}
              — the sessions you record: activity, date, duration,
              intensity, and any notes you write.
            </>,
            <>
              <strong className="font-medium text-ink">
                Coach conversations
              </strong>{" "}
              — the messages you exchange with the AI coach, and any
              training plans it produces.
            </>,
            <>
              <strong className="font-medium text-ink">
                Technical data
              </strong>{" "}
              — standard server logs (IP address, browser type, timestamps)
              generated when you use the service.
            </>,
          ]}
        />
        <p>
          We do not collect location data, contacts, photos, or health data
          from other apps or devices.
        </p>
        <p>
          When you attach a photo to a workout share card, the image is read
          by your browser, drawn onto the card, and discarded when you close
          the dialog. It is never uploaded to us and never stored. The card
          you post is a flattened image, so any location data your camera
          embedded in the original is removed rather than published.
        </p>
      </Section>

      <Section heading="Why we hold it">
        <List
          items={[
            "To give your coach the context that makes its advice personal rather than generic — this is the core function of the product.",
            "To show your progress, statistics, and history.",
            "To keep your account secure and to operate the service.",
            "To understand, in aggregate, which features are used, so the product can be improved.",
          ]}
        />
        <p>
          Where the law requires a lawful basis, ours is the performance of
          our contract with you (providing the service you signed up for)
          and our legitimate interest in operating and improving it.
        </p>
      </Section>

      <Section heading="Who else processes it">
        <p>
          AdimFit runs on third-party infrastructure. These providers
          process data on our instructions and are bound by their own
          agreements with us:
        </p>
        <List
          items={[
            <>
              <strong className="font-medium text-ink">
                Google Cloud and Firebase
              </strong>{" "}
              — authentication, database storage, and hosting. Your account
              and training data are stored here.
            </>,
            <>
              <strong className="font-medium text-ink">Anthropic</strong>{" "}
              — provides the AI model behind the coach. When you send a
              message, your message plus relevant profile and workout
              context is transmitted to Anthropic to generate a reply.
            </>,
            <>
              <strong className="font-medium text-ink">PostHog</strong>{" "}
              — product analytics, hosted in the EU. Receives anonymous
              usage events (for example &ldquo;a workout was logged&rdquo;)
              tied to a random account identifier. We do not send your
              name, email, message content, or workout notes to PostHog.
            </>,
          ]}
        />
        <p>
          These providers may store and process data outside your country,
          including in the United States and Europe. We do not sell your
          data or share it with advertisers or data brokers.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Your data stays for as long as your account exists. Delete your
          account and we remove your profile, workout log, and coach
          conversations from our active systems. Backups and server logs may
          persist for a limited period before being overwritten in the
          ordinary course.
        </p>
        <p>
          You can clear your coach conversation at any time from the AI
          Coach screen without affecting the rest of your account.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>You can ask us to:</p>
        <List
          items={[
            "Give you a copy of the data we hold about you.",
            "Correct anything inaccurate.",
            "Delete your account and its data.",
            "Restrict or object to certain processing.",
          ]}
        />
        <p>
          Email{" "}
          <strong className="font-medium text-ink">support@adimfit.com</strong>{" "}
          and we will respond within 30 days. If you are in Nigeria, you may
          also complain to the Nigeria Data Protection Commission; in the
          EU or UK, to your local supervisory authority.
        </p>
      </Section>

      <Section heading="Security">
        <p>
          Data is encrypted in transit and at rest by our infrastructure
          providers. Access is scoped so that you can only ever read or
          write your own records, enforced at the database level rather
          than only in the app.
        </p>
        <p>
          No system is perfectly secure. If a breach affects your data, we
          will notify you and the relevant authority as required by law.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          AdimFit is not intended for children under 13, and we do not
          knowingly collect their data. If you are between 13 and 18, you
          should have a parent or guardian&apos;s permission to use it. If
          you believe a child has given us data, contact us and we will
          delete it.
        </p>
      </Section>

      <Section heading="Cookies and local storage">
        <p>
          We use browser storage to keep you signed in and to remember
          preferences such as whether you have dismissed the install
          prompt. We do not use advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section heading="Business transfers">
        <p>
          AdimFit may in future be restructured, incorporated in another
          country, or acquired. If that happens, your account and its data
          may be transferred to the successor entity as part of that
          transaction, so the service can continue without interruption.
        </p>
        <p>
          Any successor will be bound by commitments no less protective
          than those in this policy. We will tell you before your data
          moves to a different controller, and you may delete your account
          instead.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes materially, we will update the date at the
          top and, where the change is significant, tell you in the app.
          Continuing to use AdimFit after a change means you accept the
          revised policy.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy or your data:{" "}
          <strong className="font-medium text-ink">support@adimfit.com</strong>
          .
        </p>
      </Section>
    </LegalPage>
  );
}