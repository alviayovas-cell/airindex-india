import { useEffect, useRef, useState } from "react";
import { Bot, SendHorizonal, Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useAiStatus, useAskAi } from "@/hooks/queries";
import type { AiTurn } from "@/api/ai";

const SUGGESTIONS = [
  "What is the current AIRINDEX?",
  "Why did the index change recently?",
  "What is the most volatile route?",
  "What happened to MAA-DEL?",
  "Compare DEL-BOM and DEL-BLR",
  "Which advance-purchase window has the highest average fare?",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  engine?: string;
}

export default function AiAssistant() {
  const status = useAiStatus();
  const ask = useAskAi();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ask.isPending]);

  function submit(question: string) {
    const q = question.trim();
    if (!q || ask.isPending) return;
    const history: AiTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    ask.mutate(
      { question: q, history },
      {
        onSuccess: (res) =>
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: res.note ? `${res.answer}\n\n(${res.note})` : res.answer,
              engine: res.engine,
            },
          ]),
        onError: (err) =>
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content:
                (err as Error).message ||
                "Something went wrong reaching the assistant. Please try again.",
              engine: "error",
            },
          ]),
      },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AIRINDEX Assistant"
        description="Ask questions in plain language — answers are generated only from the computed AIRINDEX data."
        actions={
          status.data ? (
            <Badge tone={status.data.enabled ? "accent" : "neutral"}>
              {status.data.enabled ? `Claude · ${status.data.model}` : "Rule-based engine"}
            </Badge>
          ) : null
        }
      />

      <Card className="flex h-[62vh] min-h-[420px] flex-col">
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ask about the airfare price index</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  The assistant answers from the current index, route sub-indexes,
                  volatility, contributors and lead-time data. It will say so if it
                  doesn&apos;t have the data.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : m.engine === "error"
                      ? "bg-danger/10 text-danger"
                      : "bg-accent/10 text-accent"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </CardBody>

        <div className="border-t border-border p-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the index, a route, volatility…"
              className="h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <Button type="submit" loading={ask.isPending} disabled={!input.trim()}>
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Answers are grounded in AIRINDEX data and may be incomplete. Not financial
            or purchasing advice.
          </p>
        </div>
      </Card>
    </div>
  );
}
