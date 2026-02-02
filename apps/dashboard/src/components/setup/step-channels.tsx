"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MessageCircle, Hash, MessagesSquare } from "lucide-react";
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

        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="telegram-token">Bot Token</Label>
          <Input
            id="telegram-token"
            type="password"
            placeholder="123456789:ABCdefGHI..."
            value={data.telegramToken}
            onChange={(e) => updateData({ telegramToken: e.target.value })}
          />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">How to get a Telegram bot token:</p>
            <ol className="mt-1 list-inside list-decimal space-y-0.5">
              <li>
                Open Telegram and search for{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  @BotFather
                </a>
              </li>
              <li>
                Send <code className="rounded bg-muted px-1">/newbot</code> and
                follow the prompts
              </li>
              <li>Copy the bot token and paste it above</li>
            </ol>
          </div>
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
          {data.telegramToken ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
