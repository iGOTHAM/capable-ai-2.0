import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Zap, Brain, Activity } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "7-Day Free Trial",
    description:
      "Try everything free for 7 days. Then $49/mo for your own AI assistant with a custom subdomain.",
  },
  {
    icon: Shield,
    title: "You Own Everything",
    description:
      "Your VPS, your data, your keys. We never store your LLM credentials or access your server.",
  },
  {
    icon: Brain,
    title: "Memory That Works",
    description:
      "Session memory search, memory flush, and curated knowledge. Your assistant actually remembers.",
  },
  {
    icon: Activity,
    title: "Activity Dashboard",
    description:
      "See exactly what your bot is doing. Timeline, approvals, and chat — all in one premium interface.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Your AI Senior Associate.
          <br />
          <span className="text-muted-foreground">On Your Server.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Capable.ai generates a fully configured AI assistant pack and deploys
          it to your own DigitalOcean droplet with a custom subdomain. Start your
          7-day free trial. Full control. Memory that actually works.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#features">Learn More</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="p-6">
              <CardHeader className="p-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
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
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/50 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="text-2xl font-bold">Ready to deploy?</h2>
          <p className="text-muted-foreground">
            Create your project, name your bot, start your free trial, and
            deploy in minutes.
          </p>
          <Button size="lg" asChild>
            <Link href="/register">Create Your Pack</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
