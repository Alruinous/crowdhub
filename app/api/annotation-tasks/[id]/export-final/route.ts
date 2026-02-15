import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

type FinalResultItem = {
  dimensionIndex: number;
  pathIds: string[];
  pathNames?: string[] | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    const taskId = (await params).id;

    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        publisherId: true,
        labelFile: {
          select: { dimensionNames: true },
        },
        annotations: {
          orderBy: { rowIndex: "asc" },
          select: {
            rowIndex: true,
            rowData: true,
            finalResult: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "标注任务不存在" }, { status: 404 });
    }

    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权访问此任务" }, { status: 403 });
    }

    const dimensionNames: string[] = Array.isArray(task.labelFile?.dimensionNames)
      ? (task.labelFile.dimensionNames as string[]).filter((n): n is string => typeof n === "string")
      : [];

    const allRowDataKeys = new Set<string>();
    const byAnn: {
      rowData: Record<string, unknown>;
      byDim: Map<number, { pathNames: string[]; pathIds: string[] }[]>;
    }[] = [];

    for (const ann of task.annotations) {
      const rowData = (ann.rowData as Record<string, unknown>) ?? {};
      const finalResult = (ann.finalResult as FinalResultItem[] | null) ?? [];
      for (const k of Object.keys(rowData)) allRowDataKeys.add(k);

      const byDim = new Map<number, { pathNames: string[]; pathIds: string[] }[]>();
      for (const item of finalResult) {
        const pathNames = (item.pathNames && item.pathNames.length > 0
          ? item.pathNames
          : (item.pathIds ?? [])) as string[];
        const pathIds = (item.pathIds ?? []) as string[];
        if (!byDim.has(item.dimensionIndex)) byDim.set(item.dimensionIndex, []);
        byDim.get(item.dimensionIndex)!.push({ pathNames, pathIds });
      }
      byAnn.push({ rowData, byDim });
    }

    const rowDataKeysSorted = [...allRowDataKeys].sort();
    const maxDim =
      dimensionNames.length > 0
        ? dimensionNames.length - 1
        : (() => {
            const indices = byAnn.flatMap((x) => [...x.byDim.keys()]);
            return indices.length > 0 ? Math.max(...indices) : -1;
          })();
    const dimensionIndicesOrdered = Array.from({ length: maxDim + 1 }, (_, i) => i);
    const dimensionColumnNames = dimensionIndicesOrdered.map((d) =>
      dimensionNames[d] ? `${dimensionNames[d]}（最终结果）` : `（最终结果）_${d}`
    );

    function mergeByPrefix(items: { pathNames: string[]; pathIds: string[] }[]): string {
      if (items.length === 0) return "";
      const byPrefix = new Map<string, string[]>();
      for (const s of items) {
        const pathNames = s.pathNames ?? [];
        const pathIds = s.pathIds ?? [];
        const prefix =
          pathNames.length > 1
            ? pathNames.slice(0, -1).join("|")
            : pathIds.length > 1
              ? pathIds.slice(0, -1).join("|")
              : "";
        const last =
          pathNames.length > 0
            ? pathNames[pathNames.length - 1]
            : pathIds.length > 0
              ? pathIds[pathIds.length - 1]
              : "";
        if (!last) continue;
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
        const arr = byPrefix.get(prefix)!;
        if (!arr.includes(last)) arr.push(last);
      }
      const parts: string[] = [];
      byPrefix.forEach((lasts, prefixKey) => {
        const prefixStr =
          prefixKey === "" ? "" : prefixKey.split("|").join(" > ") + " > ";
        parts.push(prefixStr + lasts.join("、"));
      });
      return parts.join("；");
    }

    const excelData: Record<string, string | number>[] = [];
    for (const { rowData, byDim } of byAnn) {
      const row: Record<string, string | number> = {};
      for (const k of rowDataKeysSorted) {
        const v = rowData[k];
        row[k] = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      }
      for (const d of dimensionIndicesOrdered) {
        const dimLabel = dimensionNames[d] ? `${dimensionNames[d]}（最终结果）` : `（最终结果）_${d}`;
        const items = byDim.get(d) ?? [];
        row[dimLabel] = mergeByPrefix(items);
      }
      excelData.push(row);
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "最终结果");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const filename = `${task.title}_最终结果_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("[ExportFinal] 导出失败:", error);
    return NextResponse.json(
      { error: "导出失败，请稍后重试" },
      { status: 500 }
    );
  }
}
