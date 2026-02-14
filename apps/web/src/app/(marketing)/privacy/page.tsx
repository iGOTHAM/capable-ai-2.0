import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 14, 2026
      </p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            What We Collect
          </h2>
          <p>
            When you create an account, we collect your email address and a
            hashed password. When you subscribe, Stripe processes your payment
            information — we never see or store your full card number.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            API Keys (BYOK Model)
          </h2>
          <p>
            Capable.ai uses a Bring Your Own Key model. Your AI provider API key
            is sent directly to your DigitalOcean droplet during deployment. We
            never store, log, or transmit your API key through our servers. It
            exists only in your browser session and on your own infrastructure.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Your Server &amp; Data
          </h2>
          <p>
            Your agent runs on a DigitalOcean droplet that you own. All
            conversation data, memory files, knowledge documents, and agent
            activity logs are stored exclusively on your server. We do not have
            access to your droplet or its data after deployment.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Payment Processing
          </h2>
          <p>
            Payments are processed by{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Stripe
            </a>
            . We store your Stripe customer ID, subscription status, and billing
            dates. We do not store credit card numbers or bank account details.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            DigitalOcean Integration
          </h2>
          <p>
            When you deploy an agent, we use the DigitalOcean API with temporary
            OAuth tokens to create a droplet on your behalf. These tokens are
            used during deployment only and are not stored long-term. We earn
            affiliate revenue from DigitalOcean for referrals.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Cookies
          </h2>
          <p>
            We use a session cookie to keep you logged in. We do not use
            tracking cookies or third-party analytics.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Contact
          </h2>
          <p>
            Questions about this policy? Email us at{" "}
            <a
              href="mailto:support@capable.ai"
              className="text-primary hover:underline"
            >
              support@capable.ai
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12 border-t pt-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
