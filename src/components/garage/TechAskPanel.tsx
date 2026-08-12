/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { askTech, type BikeContext, type TechAnswer } from "@/lib/mcd-tech";
import { AnswerCard } from "@/components/garage/AnswerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const QUICK = [
  "What is the valve clearance?",
  "Engine oil capacity and spec",
  "Front axle torque",
  "Front wheel removal procedure",
  "Fork oil capacity",
];

export function TechAskPanel({
  bike,
  compact,
  quick = QUICK,
}: {
  bike: BikeContext;
  compact?: boolean;
  quick?: string[];
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<TechAnswer | null>(null);

  async function ask(question: string) {
    if (!question.trim()) return;
    setLoading(true);
    setQ(question);
    try {
      setAnswer(await askTech(question, bike));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask MCD TECH — valve clearance, torque, oil capacity, procedure…"
        />
        <Button type="submit" disabled={loading} className="gap-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Ask
        </Button>
      </form>
      {!compact && (
        <div className="flex flex-wrap gap-1">
          {quick.map((s) => (
            <Button key={s} size="sm" variant="outline" className="h-7 text-xs" onClick={() => void ask(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}
      {answer && <AnswerCard answer={answer} modelId={bike.modelId ?? null} />}
    </div>
  );
}
