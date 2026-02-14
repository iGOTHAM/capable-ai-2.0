import { ThemeToggle } from "@/components/theme-toggle";

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Capable.ai</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setup your AI agent
        </p>
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
