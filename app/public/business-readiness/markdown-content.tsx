"use client";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function inline(value: string): string {
  const links: string[] = [];
  let safe = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    const marker = `\u0000${links.length}\u0000`;
    links.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`);
    return marker;
  });
  safe = escapeHtml(safe)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return safe.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => links[Number(index)] ?? "");
}

function renderMarkdown(markdown: string, ids: Record<string, string>): string {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/\*\*/g, "").trim();
      const id = ids[title];
      output.push(`<h${level}${id ? ` id="${escapeHtml(id)}"` : ""}>${inline(title)}</h${level}>`);
      index++; continue;
    }
    if (/^\s*([-*_]\s*){3,}$/.test(line)) { output.push("<hr>"); index++; continue; }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
      const headers = cells(line);
      output.push(`<div class="guideTableWrap"><table><thead><tr>${headers.map(cell => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>`);
      index += 2;
      while (index < lines.length && lines[index].includes("|")) {
        const values = cells(lines[index]);
        output.push(`<tr>${headers.map((_header, cellIndex) => `<td>${inline(values[cellIndex] ?? "")}</td>`).join("")}</tr>`);
        index++;
      }
      output.push("</tbody></table></div>"); continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quoted.push(lines[index++].replace(/^\s*>\s?/, ""));
      output.push(`<blockquote>${quoted.map(item => `<p>${inline(item)}</p>`).join("")}</blockquote>`); continue;
    }
    const list = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/);
    if (list) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index])) items.push(`<li>${inline(lines[index++].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ""))}</li>`);
      output.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s|^\s*>|^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index])) paragraph.push(lines[index++]);
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return output.join("\n");
}

export default function MarkdownContent({ markdown, idMap = {}, className = "" }: { markdown: string; idMap?: Record<string, string>; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown, idMap) }} />;
}
