import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import type { CommitDetail, SummaryRow } from "../types";

const COLORS = [
  "#4285F4", "#EA4335", "#FBBC04", "#34A853", "#FF6D01",
  "#46BDC6", "#7B61FF", "#F538A0", "#00ACC1", "#AB47BC",
  "#8D6E63", "#78909C",
];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export async function generatePDF(
  summary: SummaryRow[],
  commitsByRepo: Map<string, CommitDetail[]>,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGIN });
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    stream.on("finish", resolve);
    stream.on("error", reject);

    // --- Header ---
    const totalContributions = summary.reduce(
      (sum, r) => sum + r.contributions,
      0
    );

    doc.fontSize(22).font("Helvetica-Bold").text("Contribution Report", {
      align: "center",
    });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Total Contributions: ${totalContributions.toLocaleString()}`, {
        align: "center",
      });
    doc.moveDown(1.5);

    // --- Pie Chart ---
    if (summary.length > 0) {
      drawPieChart(doc, summary);
      doc.moveDown(1);
    }

    // --- Per-repo commit tables ---
    const sortedRepos = [...commitsByRepo.entries()].sort((a, b) =>
      b[1].length - a[1].length
    );

    for (const [repo, commits] of sortedRepos) {
      drawCommitTable(doc, repo, commits);
    }

    // --- Footnote on last page ---
    doc
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#666666")
      .text(
        "Commit details sourced from GitHub Search API. Some contributions (e.g., private repos) may not appear in tables.",
        MARGIN,
        PAGE_HEIGHT - MARGIN + 10,
        { width: CONTENT_WIDTH, align: "center" }
      );

    doc.end();
  });
}

function drawPieChart(doc: PDFKit.PDFDocument, summary: SummaryRow[]): void {
  const radius = 90;
  const chartY = doc.y;
  // Pie chart on the right half
  const centerX = PAGE_WIDTH - MARGIN - radius;
  const centerY = chartY + radius;
  // Legend on the left half
  const legendX = MARGIN;
  const legendWidth = PAGE_WIDTH - 2 * MARGIN - radius * 2 - 30;

  const total = summary.reduce((sum, r) => sum + r.contributions, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;

  for (let i = 0; i < summary.length; i++) {
    const row = summary[i]!;
    const sliceAngle = (row.contributions / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const color = COLORS[i % COLORS.length]!;

    drawSlice(doc, centerX, centerY, radius, startAngle, endAngle, color);
    startAngle = endAngle;
  }

  // Legend on the left, vertically aligned with pie chart
  let legendY = chartY;

  doc.fontSize(9).font("Helvetica");
  for (let i = 0; i < summary.length; i++) {
    const row = summary[i]!;
    const color = COLORS[i % COLORS.length]!;

    if (legendY + 16 > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      legendY = MARGIN;
    }

    doc.rect(legendX, legendY, 10, 10).fill(color);
    doc
      .fillColor("#000000")
      .text(
        `${row.repository} — ${row.percentage}% (${row.contributions})`,
        legendX + 16,
        legendY + 1,
        { width: legendWidth }
      );
    legendY += 16;
  }

  // Move past whichever is taller: pie chart or legend
  const pieBottom = chartY + radius * 2 + 10;
  doc.y = Math.max(pieBottom, legendY + 10);
  doc.fillColor("#000000");
}

function drawSlice(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: string
): void {
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  doc.save();
  doc
    .path(
      `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`
    )
    .fill(color);
  doc.restore();
}

function checkPageBreak(doc: PDFKit.PDFDocument, neededY: number): boolean {
  if (neededY > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return true;
  }
  return false;
}

function drawCommitTable(
  doc: PDFKit.PDFDocument,
  repo: string,
  commits: CommitDetail[]
): void {
  // Check if we need a new page for the header + at least 1 row
  if (doc.y + 60 > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
  }

  // Repo header
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#333333")
    .text(repo, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);

  // Table header
  const colDate = MARGIN;
  const colSHA = MARGIN + 140;
  const colMsg = MARGIN + 220;
  const msgWidth = CONTENT_WIDTH - 220 + MARGIN;
  const rowHeight = 16;

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#666666");
  const headerY = doc.y;
  doc.text("Date", colDate, headerY);
  doc.text("SHA", colSHA, headerY);
  doc.text("Message", colMsg, headerY);

  // Header underline
  doc.y = headerY + rowHeight;
  doc
    .moveTo(MARGIN, doc.y - 2)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y - 2)
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .stroke();

  doc.fontSize(8).font("Helvetica").fillColor("#000000");

  for (const commit of commits) {
    if (doc.y + rowHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      // Re-draw table header on new page
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#666666");
      const hy = doc.y;
      doc.text("Date", colDate, hy);
      doc.text("SHA", colSHA, hy);
      doc.text("Message", colMsg, hy);
      doc.y = hy + rowHeight;
      doc
        .moveTo(MARGIN, doc.y - 2)
        .lineTo(MARGIN + CONTENT_WIDTH, doc.y - 2)
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .stroke();
      doc.fontSize(8).font("Helvetica").fillColor("#000000");
    }

    const y = doc.y;
    const dateStr = new Date(commit.date).toISOString().slice(0, 10);
    const shortSha = commit.sha.slice(0, 7);
    const truncMsg =
      commit.message.length > 65
        ? commit.message.slice(0, 62) + "..."
        : commit.message;

    doc.text(dateStr, colDate, y, { width: 130 });
    doc.text(shortSha, colSHA, y, { width: 75 });
    doc.text(truncMsg, colMsg, y, { width: msgWidth });
    doc.y = y + rowHeight;
  }

  doc.moveDown(1);
  doc.fillColor("#000000");
}
