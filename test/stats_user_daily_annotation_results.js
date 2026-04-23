// 使用方法：
// node test/stats_user_daily_annotation_results.js --layout=wide --round=0 --out=test/round0.xlsx

// 输入参数与默认值
// --layout=long|wide，默认 long
// --dateField=createdAt|completedAt，默认 completedAt
// --start=YYYY-MM-DD，可选，起始日期（含）
// --end=YYYY-MM-DD，可选，结束日期（含）
// --round=数字，默认 0
// --onlyFinished / --includeUnfinished
// 实际逻辑默认只统计 isFinished=true；传 --includeUnfinished 才会包含未完成
// --out=输出路径.xlsx，可选

const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

function getArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseIntArg(name, fallback) {
  const raw = getArg(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toLocalDayString(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}`;
}

function inRange(day, start, end) {
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function parseDateOnly(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toNumber(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && typeof value.toNumber === "function") {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function printUsage() {
  console.log(
    [
      "用法：",
      "  node test/stats_user_daily_annotation_results.js [options]",
      "",
      "可选参数：",
      "  --layout=long|wide                  输出布局：long=逐日明细，wide=透视宽表（默认 long）",
      "  --dateField=createdAt|completedAt    统计按哪个时间字段归属到“某一天”（默认 completedAt）",
      "  --start=YYYY-MM-DD                  起始日期（含）",
      "  --end=YYYY-MM-DD                    结束日期（含）",
      "  --round=0|1|2                       只统计某一轮（默认 0=标注员）",
      "  --onlyFinished                      只统计 isFinished=true（默认开启；可用 --includeUnfinished 关闭）",
      "  --includeUnfinished                 包含未完成记录（与 --onlyFinished 相反）",
      "  --out=PATH.xlsx                     输出 Excel 文件路径（默认输出到 test/ 下，带时间戳）",
      "",
      "说明：",
      "  - “总数量”= AnnotationResult 记录数（按 annotatorId 归属到用户）",
      "  - “正确数量”= correctPoint 累加结果（correctPoint 为空时按 0 处理）",
    ].join("\n")
  );
}

function timestampForFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function defaultOutPath(layout) {
  return path.join(process.cwd(), "test", `annotation_stats_${layout}_${timestampForFile()}.xlsx`);
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printUsage();
    return;
  }

  const layout = (getArg("layout") || "long").toLowerCase();
  const dateField = (getArg("dateField") || "completedAt").toLowerCase();
  const round = parseIntArg("round", 0);
  const start = getArg("start");
  const end = getArg("end");
  const onlyFinished = hasFlag("includeUnfinished") ? false : true;
  const outPath = getArg("out") || defaultOutPath(layout);

  if (start && !parseDateOnly(start)) throw new Error(`--start 格式错误：${start}（应为 YYYY-MM-DD）`);
  if (end && !parseDateOnly(end)) throw new Error(`--end 格式错误：${end}（应为 YYYY-MM-DD）`);
  if (layout !== "long" && layout !== "wide") throw new Error(`--layout 只能是 long 或 wide：${layout}`);
  if (dateField !== "createdat" && dateField !== "completedat")
    throw new Error(`--dateField 只能是 createdAt 或 completedAt：${dateField}`);

  const prisma = new PrismaClient();
  try {
    const results = await prisma.annotationResult.findMany({
      where: {
        round,
        ...(onlyFinished ? { isFinished: true } : {}),
        ...(dateField === "completedat" ? { completedAt: { not: null } } : {}),
      },
      select: {
        annotatorId: true,
        correctPoint: true,
        createdAt: true,
        completedAt: true,
        annotator: { select: { id: true, name: true, email: true } },
      },
    });

    // 先做 long 聚合（userId+day）
    const acc = new Map(); // key: `${annotatorId}::${day}` => row
    for (const r of results) {
      const dt = dateField === "completedat" ? r.completedAt : r.createdAt;
      if (!dt) continue;
      const day = toLocalDayString(dt);
      if (!inRange(day, start, end)) continue;

      const key = `${r.annotatorId}::${day}`;
      const prev = acc.get(key);
      const correctAdd = toNumber(r.correctPoint);
      if (!prev) {
        acc.set(key, {
          day,
          userId: r.annotator.id,
          name: r.annotator.name,
          email: r.annotator.email,
          total: 1,
          correct: correctAdd,
        });
      } else {
        prev.total += 1;
        prev.correct += correctAdd;
      }
    }

    const rows = [...acc.values()].sort((a, b) =>
      a.day !== b.day ? a.day.localeCompare(b.day) : a.email.localeCompare(b.email)
    );

    const wb = XLSX.utils.book_new();

    if (layout === "wide") {
      const days = [...new Set(rows.map((r) => r.day))].sort((a, b) => a.localeCompare(b));

      const byUser = new Map(); // userId => {userId,name,email,byDay:Map}
      for (const r of rows) {
        let u = byUser.get(r.userId);
        if (!u) {
          u = { userId: r.userId, name: r.name, email: r.email, byDay: new Map() };
          byUser.set(r.userId, u);
        }
        u.byDay.set(r.day, { total: r.total, correct: r.correct });
      }

      const wideRows = [...byUser.values()].sort((a, b) => a.email.localeCompare(b.email));

      const header = ["name", ...days.flatMap((d) => [`${d}_total`, `${d}_correct`])];
      const aoa = [header];
      for (const u of wideRows) {
        const cells = [u.name];
        for (const d of days) {
          const v = u.byDay.get(d) || { total: 0, correct: 0 };
          cells.push(v.total, v.correct);
        }
        aoa.push(cells);
      }

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, sheet, "wide");
    }

    if (layout === "long") {
      const aoa = [["day", "name", "total", "correct"]];
      for (const row of rows) {
        aoa.push([row.day, row.name, row.total, row.correct]);
      }
      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, sheet, "long");
    }

    // 参数表放最后，避免 Excel 打开时默认只看到 params
    const paramsSheet = XLSX.utils.aoa_to_sheet([
      ["param", "value"],
      ["layout", layout],
      ["dateField", dateField],
      ["round", String(round)],
      ["onlyFinished", String(onlyFinished)],
      ["start", start || ""],
      ["end", end || ""],
      ["generatedAt", new Date().toISOString()],
    ]);
    XLSX.utils.book_append_sheet(wb, paramsSheet, "params");

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    XLSX.writeFile(wb, outPath);
    console.log(`已输出 Excel：${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

