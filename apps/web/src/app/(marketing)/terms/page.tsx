import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 14, 2026
      </p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            What Capable.ai Provides
          </h2>
          <p>
            Capable.ai is a SaaS platform that generates configured deployment
            packages (&ldquo;Capable Packs&rdquo;) for OpenClaw, an open-source
            AI agent framework. We provide pack generation, custom subdomain
            routing, auto-HTTPS via Caddy, a management dashboard, and
            deployment automation to DigitalOcean.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            What You Provide
          </h2>
          <p>
            You provide your own AI provider API key (Anthropic or OpenAI), a
            DigitalOcean account for hosting, and any custom knowledge or
            configuration for your agent. You are responsible for the costs of
            your AI API usage and DigitalOcean hosting, which are billed
            separately by those providers.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Your Responsibilities
          </h2>
          <ul className="ml-4 list-disc flex flex-col gap-2">
            <li>
              You are responsible for the actions your AI agent takes, including
              any content it generates, messages it sends, and tasks it performs.
            </li>
            <li>
              You must comply with the acceptable use policies of your AI
              provider (Anthropic or OpenAI).
            </li>
            <li>
              You must not use your agent for illegal activities, harassment,
              spam, or generating harmful content.
            </li>
            <li>
              You are responsible for securing your droplet and API keys.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Billing &amp; Cancellation
          </h2>
          <p>
            Subscriptions are billed monthly ($9/mo) or annually ($80/year)
            through Stripe. You can cancel at any time from your Settings page.
            When you cancel, your subscription remains active until the end of
            the current billing period. We do not offer refunds for partial
            billing periods.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Data Ownership
          </h2>
          <p>
            You own all data on your server, including conversations, memory
            files, knowledge documents, and agent activity logs. Your Capable
            Pack configuration (personality, rules, knowledge) is stored in our
            database to enable regeneration and updates. You can export or delete
            your data at any time.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Limitation of Liability
          </h2>
          <p>
            Capable.ai provides deployment tooling and configuration for
            OpenClaw. We are not responsible for the behavior of your AI agent,
            the availability of third-party services (DigitalOcean, AI
            providers, OpenClaw), or any damages arising from your use of the
            platform. The service is provided &ldquo;as is&rdquo; without
            warranty.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Changes to Terms
          </h2>
          <p>
            We may update these terms from time to time. We will notify you of
            significant changes by email. Continued use of the service after
            changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Contact
          </h2>
          <p>
            Questions about these terms? Email us at{" "}
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
