"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Hash,
  MessagesSquare,
  CheckCircle2,
} from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepChannelsProps {
  data: SetupData;
  updateData: (patch: Partial<SetupData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepChannels({
  data,
  updateData,
  onNext,
  onBack,
}: StepChannelsProps) {
  const hasToken = data.telegramToken.trim().length > 0;
  // Strip leading @ if user includes it
  const cleanUsername = data.telegramBotUsername.replace(/^@/, "").trim();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Connect a messaging channel so you can chat with your AI agent.
        You can always add channels later in Settings.
      </p>

      {/* Telegram — active */}
      <div className="rounded-lg border border-input p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <MessageCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Telegram</div>
            <div className="text-xs text-muted-foreground">
              Chat via Telegram bot
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {/* Step 1: Create bot via BotFather */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="telegram-token">Bot Token</Label>
            <Input
              id="telegram-token"
              type="password"
              placeholder="123456789:ABCdefGHI..."
              value={data.telegramToken}
              onChange={(e) => updateData({ telegramToken: e.target.value })}
            />
            {!hasToken && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit gap-1.5"
                  asChild
                >
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open BotFather
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <div className="text-xs text-muted-foreground">
                  <ol className="list-inside list-decimal space-y-0.5">
                    <li>
                      Send{" "}
                      <code className="rounded bg-muted px-1">/newbot</code> and
                      follow the prompts
                    </li>
                    <li>Copy the bot token and paste it above</li>
                  </ol>
                </div>
              </>
            )}
          </div>

          {/* Step 2: After token entered — ask for bot username + open link */}
          {hasToken && (
            <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Token added
              </div>
              <p className="text-xs text-muted-foreground">
                Now open your bot in Telegram to activate it. Enter the bot
                username you chose in BotFather:
              </p>
              <div className="flex gap-2">
                <Input
                  id="telegram-bot-username"
                  placeholder="my_bot_name"
                  value={data.telegramBotUsername}
                  onChange={(e) =>
                    updateData({ telegramBotUsername: e.target.value })
                  }
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="default"
                  className="shrink-0 gap-1.5"
                  disabled={!cleanUsername}
                  asChild={!!cleanUsername}
                >
                  {cleanUsername ? (
                    <a
                      href={`https://t.me/${cleanUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Bot
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span>
                      Open Bot
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click <strong>Start</strong> in Telegram to activate the bot.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Coming soon channels */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 opacity-50">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" />
            <span className="text-sm font-medium">WhatsApp</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
        </div>
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 opacity-50">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            <span className="text-sm font-medium">Discord</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          {hasToken ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
