import type { ReactNode } from "react";

/** Minimal, safe markdown-lite rendering for agent replies (no raw HTML). */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-${i++}`} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-${i++}`}
          className="rounded bg-white/10 px-1 py-px font-mono text-[0.85em] text-amber-200/90"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function AgentText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Markdown table → compact mono block (chat column is narrow).
    if (trimmed.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim();
        if (!/^\|[\s:|-]+\|$/.test(row)) {
          rows.push(
            row
              .replace(/^\||\|$/g, "")
              .split("|")
              .map((c) => c.trim())
              .join("  ·  "),
          );
        }
        i += 1;
      }
      blocks.push(
        <div
          key={key++}
          className="my-2 space-y-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300"
        >
          {rows.map((r, ri) => (
            <div key={ri} className={ri === 0 ? "font-medium text-zinc-100" : undefined}>
              {r}
            </div>
          ))}
        </div>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push(
        <div key={key++} className="mb-1 mt-3 text-[13px] font-semibold text-zinc-100 first:mt-0">
          {inline(heading[2], `h${key}`)}
        </div>,
      );
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-tungsten/80" />
              <span>{inline(it, `li${key}-${ii}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: Array<{ n: string; body: string }> = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        const m = lines[i].trim().match(/^(\d+)[.)]\s+(.*)$/) as RegExpMatchArray;
        items.push({ n: m[1], body: m[2] });
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2">
              <span className="shrink-0 font-mono text-[11px] leading-5 text-tungsten/90">
                {it.n}.
              </span>
              <span>{inline(it.body, `ol${key}-${ii}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("|") &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        {inline(para.join(" "), `p${key}`)}
      </p>,
    );
  }

  return <div className="text-[13.5px] text-zinc-300">{blocks}</div>;
}
