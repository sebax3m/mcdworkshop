import { useEffect, useRef, useState } from "react";
import { Check, MessageSquareText, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { ChatStatus } from "ai";
import { cleanTechnicianNote } from "@/lib/mcd-tech-assist.functions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function normalizeReport(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function FixWordingChatDialog({
  open,
  originalText,
  onOpenChange,
  onAccept,
}: {
  open: boolean;
  originalText: string;
  onOpenChange: (open: boolean) => void;
  onAccept: (value: string) => void;
}) {
  const cleanNote = useServerFn(cleanTechnicianNote);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const sessionRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const latestSuggestion = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content;

  async function requestWording(text: string, history: ChatTurn[]) {
    const session = sessionRef.current;
    setStatus("submitted");
    try {
      const response = await cleanNote({
        data: {
          text,
          history: history.map(({ role, content }) => ({ role, content })),
        },
      });
      if (session !== sessionRef.current) return;
      const suggestion = normalizeReport((response as { suggestion?: string }).suggestion ?? "");
      if (!suggestion) throw new Error("AI did not return revised wording.");
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", content: suggestion },
      ]);
      setStatus("ready");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      if (session !== sessionRef.current) return;
      setStatus("error");
      toast.error(error instanceof Error ? error.message : "Fix Wording failed.");
    }
  }

  // Opening the dialog intentionally starts one temporary wording session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    sessionRef.current += 1;
    const firstMessage: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      content: originalText,
    };
    setMessages([firstMessage]);
    setInput("");
    void requestWording(originalText, []);
    return () => {
      sessionRef.current += 1;
    };
  }, [open, originalText]);

  async function submitFollowUp() {
    const request = input.trim();
    if (!request || status === "submitted" || status === "streaming") return;
    const nextUser: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      content: request,
    };
    const history = [...messages, nextUser];
    setMessages(history);
    setInput("");
    await requestWording(request, messages);
  }

  function close() {
    sessionRef.current += 1;
    onOpenChange(false);
  }

  function accept() {
    if (!latestSuggestion) return;
    onAccept(latestSuggestion);
    close();
    toast.success("Updated wording added to Details.");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex h-[min(760px,92dvh)] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <MessageSquareText className="size-5" />
            </div>
            <div>
              <DialogTitle>Fix Wording</DialogTitle>
              <DialogDescription>
                Refine the report, then use the version you approve.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Conversation className="min-h-0 bg-background">
          <ConversationContent className="gap-5 px-4 py-5 sm:px-6">
            {messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <MessageResponse>{message.content}</MessageResponse>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Rewriting workshop notes…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border bg-card px-3 py-3 sm:px-5">
          <PromptInput
            className="w-full"
            onSubmit={() => {
              void submitFollowUp();
            }}
          >
            <PromptInputTextarea
              ref={inputRef}
              value={input}
              disabled={status === "submitted" || status === "streaming"}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for a change, e.g. make it shorter or easier for the customer…"
            />
            <PromptInputFooter className="justify-between">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={status === "submitted" || status === "streaming"}
                onClick={() => {
                  setMessages([{ id: `user-${Date.now()}`, role: "user", content: originalText }]);
                  void requestWording(originalText, []);
                }}
              >
                <RotateCcw className="size-4" /> Rewrite
              </Button>
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() || status === "submitted" || status === "streaming"}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>

        <DialogFooter className="border-t border-border bg-card px-5 py-3 sm:space-x-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="button" className="gap-2" disabled={!latestSuggestion} onClick={accept}>
            <Check className="size-4" /> Use wording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
