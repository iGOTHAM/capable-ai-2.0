import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Zap,
  Brain,
  Activity,
  Globe,
  MessageSquare,
  Terminal,
  Eye,
  Mic,
  Puzzle,
  Clock,
  Lock,
  Server,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const superpowers = [
  {
    icon: MessageSquare,
    title: "Every Channel, One Agent",
    description:
      "WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams — your agent meets people wherever they already are.",
  },
  {
    icon: Brain,
    title: "Persistent Memory",
    description:
      "Your agent remembers everything across sessions. Preferences, context, past decisions — it builds a working relationship over time.",
  },
  {
    icon: Terminal,
    title: "Computer Use",
    description:
      "Read and write files, run scripts, execute shell commands, and control browsers. This agent doesn't just talk — it does things.",
  },
  {
    icon: Globe,
    title: "Browser Automation",
    description:
      "Fill forms, extract web data, navigate sites, book flights, check in — your agent handles the tedious browser work for you.",
  },
  {
    icon: Eye,
    title: "Human-in-the-Loop Approvals",
    description:
      "You decide what runs automatically and what needs your sign-off. Dangerous operations require explicit approval before executing.",
  },
  {
    icon: Clock,
    title: "Proactive Scheduling",
    description:
      "Background jobs, cron tasks, periodic checks. Your agent works while you sleep — clearing inboxes, sending reminders, running reports.",
  },
  {
    icon: Sparkles,
    title: "Self-Extending Skills",
    description:
      "Your agent writes its own new skills when it needs them. It adapts and grows its capabilities to match your workflow.",
  },
  {
    icon: Puzzle,
    title: "100+ Integrations",
    description:
      "Gmail, GitHub, Spotify, smart home, Obsidian, calendars, and more via MCP. Connect your agent to your entire digital life.",
  },
  {
    icon: Mic,
    title: "Voice & Visual",
    description:
      "Voice wake, talk mode, text-to-speech calls. A live canvas workspace your agent can draw on. Multi-modal by default.",
  },
];

const whyCapable = [
  {
    icon: Server,
    title: "Deploy in Minutes, Not Days",
    description:
      "OpenClaw is powerful but complex to set up. Capable.ai generates a fully configured pack with your bot's personality, knowledge, and rules — then deploys it to your own server with one script.",
  },
  {
    icon: Shield,
    title: "Secure by Default",
    description:
      "Your VPS, your data, your API keys. We never store your LLM credentials or access your server. Auto-HTTPS on your custom subdomain via Caddy. Security-hardened out of the box.",
  },
  {
    icon: Activity,
    title: "Premium Dashboard",
    description:
      "A real-time activity timeline, approval queue, and chat interface — all on your subdomain. See exactly what your agent is doing, review pending actions, and intervene when needed.",
  },
  {
    icon: Lock,
    title: "Vertical Customization",
    description:
      "Pre-built knowledge templates for Private Equity, Legal, Healthcare, and more. Custom personality, operating rules, and safety boundaries tailored to your industry.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
        <Badge variant="secondary" className="text-sm">
          Powered by OpenClaw
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          The Full Power of OpenClaw.
          <br />
          <span className="text-muted-foreground">
            Deployed and Configured for You.
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          OpenClaw is the most capable open-source AI agent in the world —
          persistent memory, computer use, browser automation, 100+
          integrations. Capable.ai packages it with your custom personality,
          knowledge, and safety rules, then deploys it to your own server with a
          custom subdomain in minutes.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/register">Start Free Trial</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#superpowers">See What It Can Do</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          7-day free trial. Then $49/mo. Your server, your data.
        </p>
      </section>

      {/* Superpowers */}
      <section id="superpowers" className="border-t bg-muted/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              What Your Agent Can Do
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every OpenClaw superpower, ready to work for you on day one.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {superpowers.map((feature) => (
              <Card key={feature.title} className="p-6">
                <CardHeader className="p-0 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">
                      {feature.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Capable */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Why Capable.ai
            </h2>
            <p className="mt-3 text-muted-foreground">
              OpenClaw is free and open-source. Setting it up properly isn&apos;t.
              We handle the hard part.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {whyCapable.map((feature) => (
              <Card key={feature.title} className="p-6">
                <CardHeader className="p-0 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">
                      {feature.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Live in 3 Steps
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Configure",
                description:
                  "Name your bot, choose a personality, add your industry knowledge, set safety boundaries.",
              },
              {
                step: "2",
                title: "Deploy",
                description:
                  "Paste one script into a $6/mo DigitalOcean droplet. Auto-HTTPS, your subdomain, done.",
              },
              {
                step: "3",
                title: "Work Together",
                description:
                  "Chat on WhatsApp, review actions on your dashboard, watch your agent learn and grow.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Your Agent Is Waiting
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Start your 7-day free trial. Configure your agent in minutes.
            Deploy to your own infrastructure. No lock-in, cancel anytime.
          </p>
          <Button size="lg" asChild>
            <Link href="/register">
              Get Started <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
