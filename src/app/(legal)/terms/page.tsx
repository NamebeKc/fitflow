// src/app/(legal)/terms/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, List, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — AdimFit",
  description:
    "The agreement between you and AdimFit, including important health and safety limitations.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 2026">
      <Section heading="Agreement">
        <p>
          These terms govern your use of AdimFit, operated by{" "}
          <strong className="font-medium text-white/80">Lush Techdia</strong>{" "}
          of{" "}
          <strong className="font-medium text-white/80">
            28 Adetola Street, Aguda, Surulere, Lagos, Nigeria
          </strong>{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
          By creating an account you accept them. If you do not, please
          don&apos;t use the service.
        </p>
      </Section>

      <Section heading="Health and safety — read this one">
        <p>
          <strong className="font-medium text-white/80">
            AdimFit is not a medical service and its coach is not a doctor,
            physiotherapist, or qualified personal trainer.
          </strong>{" "}
          Everything it produces is general fitness information, not
          medical advice, diagnosis, or treatment.
        </p>
        <p>
          Consult a qualified healthcare professional before starting any
          new exercise programme — particularly if you are pregnant, have
          an injury, a heart condition, a chronic illness, or have been
          inactive for a long period.
        </p>
        <p>
          Stop exercising and seek medical attention if you experience
          chest pain, dizziness, faintness, or unusual shortness of breath.
          You are responsible for judging whether any activity is safe for
          you, and you take part at your own risk.
        </p>
      </Section>

      <Section heading="What the AI coach is, and isn't">
        <p>
          The coach is powered by a large language model. It is useful, and
          it is sometimes wrong. It can misremember, miscalculate, or
          produce confident advice that does not suit your circumstances.
        </p>
        <List
          items={[
            "Treat its output as a knowledgeable suggestion, not an instruction.",
            "Do not rely on it for medical, nutritional, or clinical decisions.",
            "Use your own judgement, especially about load, intensity, and pain.",
          ]}
        />
        <p>
          We do not guarantee any particular fitness, weight, or health
          outcome from using AdimFit.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You must be at least 13 years old. If you are under 18, you need
          a parent or guardian&apos;s permission. You are responsible for
          keeping your login credentials secure and for activity under your
          account, and you agree to give accurate information — the coach
          calibrates training loads from what you tell it.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>Please don&apos;t:</p>
        <List
          items={[
            "Use AdimFit for anything unlawful, or to harass or harm anyone.",
            "Attempt to break, overload, reverse-engineer, or gain unauthorised access to the service or another person's account.",
            "Scrape or bulk-extract content, or resell access without our written permission.",
            "Use the coach to obtain advice that would foreseeably harm you or others, including extreme restriction or unsafe training practices. The coach is designed to decline such requests.",
          ]}
        />
        <p>
          We may suspend or close accounts that breach these terms.
        </p>
      </Section>

      <Section heading="Subscriptions and payment">
        <p>
          AdimFit requires a paid subscription. There is no free trial:
          the price and billing period are shown in full before you are
          charged. Subscriptions renew automatically until cancelled, and
          you can cancel at any time — access continues to the end of the
          period you have already paid for.
        </p>
        <p>
          <strong className="font-medium text-white/80">
            Seven-day money-back guarantee.
          </strong>{" "}
          If you email us within seven days of any charge — including a
          renewal, not only your first payment — we will refund that charge
          in full. You do not need to give a reason. Refunds are returned
          to the card or account you paid from, and can take a few working
          days to appear depending on your bank.
        </p>
        <p>
          Outside that window, refunds are handled in line with the rules
          of the payment provider and applicable consumer law. Nothing here
          limits any right you have under Nigerian consumer protection law.
        </p>
      </Section>

      <Section heading="Your content">
        <p>
          Your workout log, notes, and messages remain yours. You grant us
          only the permission needed to operate the service — storing your
          data, and transmitting relevant parts to our AI provider so the
          coach can reply. See the{" "}
          <Link
            href="/privacy"
            className="text-[#CCFF00]/80 underline underline-offset-4 transition-colors hover:text-[#CCFF00]"
          >
            Privacy Policy
          </Link>{" "}
          for detail.
        </p>
      </Section>

      <Section heading="Our content">
        <p>
          The AdimFit name, logo, interface, and software are ours. These
          terms grant you a personal, non-transferable licence to use the
          service — not ownership of any part of it.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          We aim to keep AdimFit running but do not guarantee uninterrupted
          service. We may change, suspend, or discontinue features, and
          will give reasonable notice of significant changes where we can.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the fullest extent the law allows, we are not liable for
          indirect or consequential loss, for injury arising from exercise
          you chose to undertake, or for decisions made in reliance on the
          coach&apos;s output. Our total liability is limited to the amount
          you paid us in the twelve months before the claim.
        </p>
        <p>
          Nothing here excludes liability that cannot lawfully be excluded,
          including for death or personal injury caused by our negligence.
        </p>
      </Section>

      <Section heading="Ending the agreement">
        <p>
          You can delete your account at any time. We may suspend or
          terminate access if these terms are breached, or if we stop
          offering the service.
        </p>
      </Section>

      <Section heading="Assignment">
        <p>
          We may assign or transfer these terms, and our rights and
          obligations under them, to a successor entity — for example if
          AdimFit is restructured, incorporated in another jurisdiction, or
          acquired. Your rights under these terms will not be reduced by
          such a transfer, and we will give notice in the app before it
          takes effect.
        </p>
        <p>You may not assign these terms to anyone else.</p>
      </Section>

      <Section heading="Governing law">
        <p>
          These terms are governed by the laws of{" "}
          <strong className="font-medium text-white/80">the Federal Republic of Nigeria</strong>,
          and disputes will be handled by its courts.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms:{" "}
          <strong className="font-medium text-white/80">support@adimfit.com</strong>
          .
        </p>
      </Section>
    </LegalPage>
  );
}