"use client";

import {
  Fragment,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { CalendarRange, Download, MoreHorizontal, MoreVertical, Pencil, Sparkles, TableProperties, Trash2 } from "lucide-react";

import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import AppModal from "@/components/shared/AppModal";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { cn } from "@/lib/utils";

type DurationUnit = "day" | "week" | "month";
type TimelineViewMode = "day" | "week";

type RawCell = {
  value: string;
  mergeDown: boolean;
  items: string[];
};

type ParsedGroup = {
  id: string;
  cells: RawCell[];
  rowCount: number;
  statusTargetColumn: string | null;
  startIndex: number | null;
  manualIndices: number[];
  timelineStatus: string | null;
};

type ParsedTable = {
  headers: string[];
  groups: ParsedGroup[];
  timelineHeader: string | null;
};

type ManualDragState = {
  groupId: string;
  mode: "add" | "remove";
};

type EditingHeaderState = {
  columnIndex: number;
  value: string;
};

type TimelinePlannerSnapshot = {
  version: 1;
  timelineStartParts: {
    day: string;
    month: string;
    year: string;
  };
  timelineTargetAmount: string;
  timelineTargetColumn: string;
  timelineTaskDays: string;
  timelineViewMode: TimelineViewMode;
  tableFontSize?: string;
  tableCellPaddingX?: string;
  tableCellPaddingY?: string;
  hiddenColumnIndexes?: number[];
  showNumber: boolean;
  rawInput: string;
};

const initialStart = "2026-03-16";
const initialStartParts = {
  day: "16",
  month: "03",
  year: "2026",
};

const initialRawInput = [
  "Task;timeline | Controller | Status | Deskripsi",
  "v1:asmikCoveringInquiryForClaim;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084) | planned | Mapping endpoint existing usage",
  "v1:getDetailDWHBranch;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084),ClaimController.AsuransiKreditClaimValidation (ClaimController.cs:167),ClaimController.AsuransiKreditClaimOnPOJKValidation (ClaimController.cs:401) | planned | Mapping endpoint existing usage",
  "v1:inquiryPayoffSubfile;m;status=Task | ClaimController.AsuransiKreditClaimValidation (ClaimController.cs:167),ClaimController.AsuransiKreditClaimOnPOJKValidation (ClaimController.cs:401) | planned | Mapping endpoint existing usage",
  "v1:isValidCcy;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084),ClaimController.AsuransiKreditClaimValidation (ClaimController.cs:167),ClaimController.AsuransiKreditClaimOnPOJKValidation (ClaimController.cs:401) | planned | Mapping endpoint existing usage",
  "v2:coveringInquiryForClaimAMKKM;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084) | planned | Mapping endpoint existing usage",
  "v2:coveringInquiryForClaimBIS;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084) | planned | Mapping endpoint existing usage",
  "v2:inquiryMultiCIFLoan;m;status=Task | ClaimController.AsuransiKreditClaimOnPOJKValidation (ClaimController.cs:401) | planned | Mapping endpoint existing usage",
  "v20:claimConfirmation;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084),ClaimController.AsuransiKreditClaimValidation (ClaimController.cs:167),ClaimController.AsuransiKreditClaimOnPOJKValidation (ClaimController.cs:401) | planned | Mapping endpoint existing usage",
  "v20:programDetail;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408) | planned | Mapping endpoint existing usage",
  "v8s2:ajkoCoveringInquiryForClaim;m;status=Task | ClaimController.BancassClaimSubmissionController (ClaimController.cs:26),ClaimController.AsuransiUangClaimValidation (ClaimController.cs:1408),ClaimController.BankGaransiClaimValidation (ClaimController.cs:1084) | planned | Mapping endpoint existing usage",
  "Create Claim Sumission Controller;m;status=Task | BRISURF_API_CONTROLLER | planned | Create controller baru",
].join("\n");

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDateParts(parts: { day: string; month: string; year: string }) {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDuration(start: string, amount: number, unit: DurationUnit) {
  const startDate = parseDate(start);

  if (Number.isNaN(startDate.getTime()) || amount < 1) {
    return start;
  }

  const endDate = new Date(startDate);

  if (unit === "day") {
    endDate.setUTCDate(endDate.getUTCDate() + amount - 1);
  }

  if (unit === "week") {
    endDate.setUTCDate(endDate.getUTCDate() + amount * 7 - 1);
  }

  if (unit === "month") {
    endDate.setUTCMonth(endDate.getUTCMonth() + amount);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
  }

  return toInputDate(endDate);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDate(value));
}

function createDateRange(start: string, end: string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend) {
      dates.push(toInputDate(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(parseDate(value));
}

function formatDayNumber(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
  }).format(parseDate(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
  }).format(parseDate(value));
}

function createMonthBuckets(dates: string[]) {
  const buckets: Array<{ label: string; dates: string[] }> = [];

  dates.forEach((date) => {
    const label = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(parseDate(date));
    const currentBucket = buckets.at(-1);

    if (currentBucket && currentBucket.label === label) {
      currentBucket.dates.push(date);
      return;
    }

    buckets.push({
      label,
      dates: [date],
    });
  });

  return buckets;
}

function parseRawLine(line: string, index: number): ParsedGroup | null {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  let statusTargetColumn: string | null = null;
  let startIndex: number | null = null;
  let manualIndices: number[] = [];
  let timelineStatus: string | null = null;

  const cells = trimmedLine.split("|").map((segment) => {
    const trimmedSegment = segment.trim();
    const statusMatch = trimmedSegment.match(/;status=([a-zA-Z0-9 _-]+)/i);
    if (statusMatch) {
      statusTargetColumn = statusMatch[1].trim();
    }
    const startMatch = trimmedSegment.match(/;start=(\d+)/i);
    if (startMatch) {
      startIndex = Number(startMatch[1]);
    }
    const manualMatch = trimmedSegment.match(/;manual=([\d,]+)/i);
    if (manualMatch) {
      manualIndices = manualMatch[1]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
    }
    const timelineStatusMatch = trimmedSegment.match(/;tstatus=([a-zA-Z _-]+)/i);
    if (timelineStatusMatch) {
      timelineStatus = timelineStatusMatch[1].trim();
    }

    const withoutMacros = trimmedSegment
      .replace(/;status=[a-zA-Z0-9 _-]+/gi, "")
      .replace(/;start=\d+/gi, "")
      .replace(/;manual=[\d,]+/gi, "")
      .replace(/;tstatus=[a-zA-Z _-]+/gi, "")
      .trim();
    const mergeDown = withoutMacros.endsWith(";m");
    const normalizedSource = mergeDown
      ? withoutMacros.slice(0, withoutMacros.length - 2).trim()
      : withoutMacros;
    const normalizedValue = normalizedSource;
    const items = normalizedValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      value: normalizedValue,
      mergeDown,
      items: items.length > 0 ? items : [normalizedValue],
    };
  });

  const rowCount = Math.max(1, ...cells.map((cell) => cell.items.length));

  return {
    id: `group-${index}`,
    cells,
    rowCount,
    statusTargetColumn,
    startIndex,
    manualIndices,
    timelineStatus,
  };
}

function parseRawTable(input: string): ParsedTable {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      headers: ["Kolom 1", "Kolom 2", "Kolom 3", "Kolom 4"],
      groups: [],
      timelineHeader: null,
    };
  }

  const headerLine = lines[0];
  let timelineHeader: string | null = null;
  const headers = headerLine
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((header) => {
      const isTimelineHeader = /;timeline\b/i.test(header);
      const cleanedHeader = header.replace(/;timeline\b/gi, "").trim();

      if (isTimelineHeader) {
        timelineHeader = cleanedHeader;
      }

      return cleanedHeader;
    });
  const groups = lines
    .slice(1)
    .map((line, index) => parseRawLine(line, index))
    .filter((group): group is ParsedGroup => group !== null);

  return {
    headers: headers.length > 0 ? headers : ["Kolom 1", "Kolom 2", "Kolom 3", "Kolom 4"],
    groups,
    timelineHeader,
  };
}

function statusTone(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("backlog") || normalized.includes("todo")) {
    return "bg-slate-700/70 text-slate-100 border-slate-500/40";
  }

  if (normalized.includes("progress")) {
    return "bg-blue-500/15 text-blue-100 border-blue-400/30";
  }

  if (normalized.includes("done") || normalized.includes("selesai")) {
    return "bg-emerald-500/15 text-emerald-100 border-emerald-400/30";
  }

  if (normalized.includes("block")) {
    return "bg-rose-500/15 text-rose-100 border-rose-400/30";
  }

  if (
    normalized.includes("plan") ||
    normalized.includes("belum") ||
    normalized.includes("not started") ||
    normalized.includes("todo") ||
    normalized.includes("backlog")
  ) {
    return "bg-slate-700/70 text-slate-100 border-slate-500/40";
  }

  return "bg-slate-800 text-slate-200 border-white/10";
}

function getTimelineCellAppearance(timelineStatus: string | null, statusValue: string) {
  const normalized = (timelineStatus || statusValue || "backlog").toLowerCase();

  if (normalized.includes("backlog") || normalized.includes("todo")) {
    return "bg-slate-600/85";
  }

  if (
    normalized.includes("plan") ||
    normalized.includes("belum") ||
    normalized.includes("not started")
  ) {
    return "bg-slate-600/85";
  }

  if (normalized.includes("done") || normalized.includes("selesai")) {
    return "bg-emerald-500/85";
  }

  if (normalized.includes("hold")) {
    return "bg-amber-400/85";
  }

  if (normalized.includes("remove") || normalized.includes("cancel") || normalized.includes("ga jadi")) {
    return "bg-rose-500/85";
  }

  return "bg-blue-500/80";
}

function getWeeklyCellAppearance(statuses: string[]) {
  if (statuses.length === 0) {
    return "bg-slate-600/85";
  }

  const normalized = statuses.map((status) => status.toLowerCase());

  if (normalized.every((status) => status.includes("done") || status.includes("selesai"))) {
    return "bg-emerald-500/85";
  }

  if (normalized.every((status) => status.includes("remove") || status.includes("cancel"))) {
    return "bg-rose-500/85";
  }

  if (normalized.every((status) => status.includes("hold"))) {
    return "bg-amber-400/85";
  }

  if (
    normalized.every(
      (status) =>
        status.includes("backlog") ||
        status.includes("todo") ||
        status.includes("plan") ||
        status.includes("belum") ||
        status.includes("not started")
    )
  ) {
    return "bg-slate-600/85";
  }

  return "bg-blue-500/80";
}

function createWeekBuckets(dates: string[]) {
  const buckets: Array<{ label: string; dates: string[] }> = [];

  for (let index = 0; index < dates.length; index += 5) {
    buckets.push({
      label: `Week ${buckets.length + 1}`,
      dates: dates.slice(index, index + 5),
    });
  }

  return buckets;
}

function normalizeColumnName(value: string) {
  return value
    .trim()
    .replace(/;[a-zA-Z0-9_-]+/g, "")
    .trim()
    .toLowerCase();
}

function findStatusValue(group: ParsedGroup, headers: string[]) {
  const statusIndex = headers.findIndex((header) => normalizeColumnName(header) === "status");
  return statusIndex >= 0 ? group.cells[statusIndex]?.value || "" : "";
}

function findCellValueByHeader(group: ParsedGroup, headers: string[], targetHeader: string | null) {
  if (!targetHeader) {
    return "";
  }

  const targetIndex = headers.findIndex(
    (header) => normalizeColumnName(header) === normalizeColumnName(targetHeader)
  );

  return targetIndex >= 0 ? group.cells[targetIndex]?.value || "" : "";
}

function getTimelineAssignments(
  groups: ParsedGroup[],
  headers: string[],
  timelineDates: string[],
  durationTargetColumn: string | null,
  durationDays: number
) {
  const assignments = new Map<string, Set<string>>();
  let currentStartIndex = 0;

  groups.forEach((group) => {
    const activeDates = new Set<string>();
    const targetValue = findCellValueByHeader(group, headers, durationTargetColumn);
    const duration = targetValue ? durationDays : 0;
    const explicitStartIndex =
      group.startIndex && group.startIndex > 0 ? Math.max(0, group.startIndex - 1) : null;
    const effectiveStartIndex = explicitStartIndex ?? currentStartIndex;

    for (let offset = 0; offset < duration; offset += 1) {
      const date = timelineDates[effectiveStartIndex + offset];
      if (date) {
        activeDates.add(date);
      }
    }

    group.manualIndices.forEach((manualIndex) => {
      const date = timelineDates[manualIndex - 1];
      if (date) {
        activeDates.add(date);
      }
    });

    if (duration > 0) {
      currentStartIndex =
        explicitStartIndex !== null
          ? Math.max(currentStartIndex, effectiveStartIndex + duration)
          : currentStartIndex + duration;
    }

    assignments.set(group.id, activeDates);
  });

  return assignments;
}

function updateRawInputStartMacro(
  source: string,
  groupId: string,
  targetHeader: string,
  startIndex: number
) {
  const lines = source.split("\n");
  const groupMatch = groupId.match(/^group-(\d+)$/);

  if (!groupMatch || lines.length < 2) {
    return source;
  }

  const lineIndex = Number(groupMatch[1]) + 1;
  const headerParts = (lines[0] || "").split("|").map((part) => part.trim());
  const targetIndex = headerParts.findIndex(
    (header) => normalizeColumnName(header) === normalizeColumnName(targetHeader)
  );

  if (lineIndex >= lines.length || targetIndex < 0) {
    return source;
  }

  const parts = lines[lineIndex].split("|").map((part) => part.trim());
  const nextParts = parts.map((part, index) => {
    if (index !== targetIndex) {
      return part;
    }

    const cleaned = part.replace(/;start=\d+/gi, "").trim();
    return `${cleaned};start=${startIndex}`;
  });

  lines[lineIndex] = nextParts.join(" | ");
  return lines.join("\n");
}

function updateRawInputManualMacro(
  source: string,
  groupId: string,
  targetHeader: string,
  dayIndex: number,
  mode: "add" | "remove" = "add"
) {
  const lines = source.split("\n");
  const groupMatch = groupId.match(/^group-(\d+)$/);

  if (!groupMatch || lines.length < 2) {
    return source;
  }

  const lineIndex = Number(groupMatch[1]) + 1;
  const headerParts = (lines[0] || "").split("|").map((part) => part.trim());
  const targetIndex = headerParts.findIndex(
    (header) => normalizeColumnName(header) === normalizeColumnName(targetHeader)
  );

  if (lineIndex >= lines.length || targetIndex < 0) {
    return source;
  }

  const parts = lines[lineIndex].split("|").map((part) => part.trim());
  const nextParts = parts.map((part, index) => {
    if (index !== targetIndex) {
      return part;
    }

    const existingMatch = part.match(/;manual=([\d,]+)/i);
    const existingValues = existingMatch
      ? existingMatch[1]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    const hasValue = existingValues.includes(dayIndex);
    const nextValues =
      mode === "remove"
        ? existingValues.filter((value) => value !== dayIndex)
        : hasValue
          ? existingValues
          : [...existingValues, dayIndex].sort((a, b) => a - b);

    const cleaned = part.replace(/;manual=[\d,]+/gi, "").trim();

    if (nextValues.length === 0) {
      return cleaned;
    }

    return `${cleaned};manual=${nextValues.join(",")}`;
  });

  lines[lineIndex] = nextParts.join(" | ");
  return lines.join("\n");
}

function updateRawInputTimelineStatusMacro(
  source: string,
  groupId: string,
  targetHeader: string,
  timelineStatus: string
) {
  const lines = source.split("\n");
  const groupMatch = groupId.match(/^group-(\d+)$/);

  if (!groupMatch || lines.length < 2) {
    return source;
  }

  const lineIndex = Number(groupMatch[1]) + 1;
  const headerParts = (lines[0] || "").split("|").map((part) => part.trim());
  const targetIndex = headerParts.findIndex(
    (header) => normalizeColumnName(header) === normalizeColumnName(targetHeader)
  );

  if (lineIndex >= lines.length || targetIndex < 0) {
    return source;
  }

  const parts = lines[lineIndex].split("|").map((part) => part.trim());
  const sanitizedStatus = timelineStatus.trim();

  const nextParts = parts.map((part, index) => {
    if (index !== targetIndex) {
      return part;
    }

    const cleaned = part.replace(/;tstatus=[a-zA-Z _-]+/gi, "").trim();
    return sanitizedStatus === "" ? cleaned : `${cleaned};tstatus=${sanitizedStatus}`;
  });

  lines[lineIndex] = nextParts.join(" | ");
  return lines.join("\n");
}

export default function TimelinePlanner() {
  const [timelineStartParts, setTimelineStartParts] = useState(initialStartParts);
  const [timelineTargetAmount, setTimelineTargetAmount] = useState("30");
  const [timelineTargetUnit] = useState<DurationUnit>("day");
  const [timelineTargetColumn, setTimelineTargetColumn] = useState("");
  const [timelineTaskDays, setTimelineTaskDays] = useState("1");
  const [timelineViewMode, setTimelineViewMode] = useState<TimelineViewMode>("day");
  const [tableFontSize, setTableFontSize] = useState("11");
  const [tableCellPaddingX, setTableCellPaddingX] = useState("12");
  const [tableCellPaddingY, setTableCellPaddingY] = useState("8");
  const [showNumber, setShowNumber] = useState(true);
  const [rawInput, setRawInput] = useState(initialRawInput);
  const [submittedInput, setSubmittedInput] = useState(initialRawInput);
  const [manualDragState, setManualDragState] = useState<ManualDragState | null>(null);
  const [openHeaderActionIndex, setOpenHeaderActionIndex] = useState<number | null>(null);
  const [openGroupActionId, setOpenGroupActionId] = useState<string | null>(null);
  const [openHiddenColumnsMenu, setOpenHiddenColumnsMenu] = useState(false);
  const [hiddenColumnIndexes, setHiddenColumnIndexes] = useState<number[]>([]);
  const [editingHeader, setEditingHeader] = useState<EditingHeaderState | null>(null);
  const [editingHeaderDraft, setEditingHeaderDraft] = useState("");
  const [isParserDialogOpen, setIsParserDialogOpen] = useState(false);
  const [isTimelineSettingsOpen, setIsTimelineSettingsOpen] = useState(false);
  const [isRawInputOpen, setIsRawInputOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importDraft, setImportDraft] = useState("");
  const [importError, setImportError] = useState("");
  const manualDragVisitedRef = useRef<Set<string>>(new Set());
  const manualDragStateRef = useRef<ManualDragState | null>(null);
  const deferredSubmittedInput = useDeferredValue(submittedInput);

  const parsedTimelineStart = parseDateParts(timelineStartParts);
  const timelineStart = parsedTimelineStart ? toInputDate(parsedTimelineStart) : initialStart;
  const targetAmount = Math.max(1, Number(timelineTargetAmount) || 1);
  const timelineEnd = addDuration(timelineStart, targetAmount, timelineTargetUnit);
  const timelineDates = useMemo(() => createDateRange(timelineStart, timelineEnd), [timelineEnd, timelineStart]);

  const parsedTable = useMemo(() => parseRawTable(deferredSubmittedInput), [deferredSubmittedInput]);
  const parsedGroups = parsedTable.groups;
  const taskDays = Math.max(1, Number(timelineTaskDays) || 1);
  const effectiveTimelineTargetColumn = parsedTable.timelineHeader || timelineTargetColumn;
  const timelineAssignments = useMemo(
    () =>
      getTimelineAssignments(
        parsedGroups,
        parsedTable.headers,
        timelineDates,
        effectiveTimelineTargetColumn,
        taskDays
      ),
    [parsedGroups, parsedTable.headers, timelineDates, effectiveTimelineTargetColumn, taskDays]
  );

  const maxColumnCount = useMemo(
    () => Math.max(parsedTable.headers.length || 0, ...parsedGroups.map((group) => group.cells.length), 0),
    [parsedGroups, parsedTable.headers.length]
  );
  const visibleColumnIndexes = useMemo(
    () =>
      Array.from({ length: maxColumnCount }, (_, index) => index).filter(
        (index) => !hiddenColumnIndexes.includes(index)
      ),
    [hiddenColumnIndexes, maxColumnCount]
  );
  const fontSizePx = Math.min(24, Math.max(8, Number(tableFontSize) || 11));
  const paddingXPx = Math.min(32, Math.max(0, Number(tableCellPaddingX) || 12));
  const paddingYPx = Math.min(24, Math.max(0, Number(tableCellPaddingY) || 8));
  const monthFontSizePx = Math.max(8, fontSizePx - 2);
  const dayFontSizePx = Math.max(8, fontSizePx - 1);
  const timelineCellMinWidthPx = Math.max(24, fontSizePx * 3);
  const timelineCellMinHeightPx = Math.max(16, fontSizePx + paddingYPx);
  const dataCellStyle = { padding: `${paddingYPx}px ${paddingXPx}px` };
  const timelineCellStyle = {
    padding: `${Math.max(0, Math.round(paddingYPx / 2))}px ${Math.max(0, Math.round(paddingXPx / 4))}px`,
    minWidth: `${timelineCellMinWidthPx}px`,
  };
  const statusBadgeStyle = {
    padding: `${Math.max(2, Math.round(paddingYPx / 2))}px ${Math.max(6, Math.round(paddingXPx * 0.75))}px`,
  };

  function handleTimelinePartChange(field: "day" | "month" | "year", value: string) {
    const maxLength = field === "year" ? 4 : 2;
    const sanitized = value.replace(/\D/g, "").slice(0, maxLength);
    setTimelineStartParts((current) => ({ ...current, [field]: sanitized }));
  }

  function handleSubmitRawInput() {
    startTransition(() => {
      setSubmittedInput(rawInput);
    });
  }

  function buildSnapshot(): TimelinePlannerSnapshot {
    return {
      version: 1,
      timelineStartParts,
      timelineTargetAmount,
      timelineTargetColumn,
      timelineTaskDays,
      timelineViewMode,
      tableFontSize,
      tableCellPaddingX,
      tableCellPaddingY,
      hiddenColumnIndexes,
      showNumber,
      rawInput,
    };
  }

  function applySnapshot(snapshot: TimelinePlannerSnapshot) {
    setTimelineStartParts(snapshot.timelineStartParts);
    setTimelineTargetAmount(snapshot.timelineTargetAmount);
    setTimelineTargetColumn(snapshot.timelineTargetColumn);
    setTimelineTaskDays(snapshot.timelineTaskDays);
    setTimelineViewMode(snapshot.timelineViewMode ?? "day");
    setTableFontSize(snapshot.tableFontSize ?? "11");
    setTableCellPaddingX(snapshot.tableCellPaddingX ?? "12");
    setTableCellPaddingY(snapshot.tableCellPaddingY ?? "8");
    setHiddenColumnIndexes(snapshot.hiddenColumnIndexes ?? []);
    setShowNumber(snapshot.showNumber);
    setRawInput(snapshot.rawInput);
    startTransition(() => {
      setSubmittedInput(snapshot.rawInput);
    });
  }

  function handleExportJson() {
    const snapshot = buildSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "timeline-planner-snapshot.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJson() {
    try {
      const parsed = JSON.parse(importDraft) as Partial<TimelinePlannerSnapshot>;

      if (
        parsed.version !== 1 ||
        !parsed.timelineStartParts ||
        typeof parsed.timelineTargetAmount !== "string" ||
        typeof parsed.timelineTargetColumn !== "string" ||
        typeof parsed.timelineTaskDays !== "string" ||
        (parsed.timelineViewMode !== "day" && parsed.timelineViewMode !== "week") ||
        (parsed.tableFontSize !== undefined && typeof parsed.tableFontSize !== "string") ||
        (parsed.tableCellPaddingX !== undefined && typeof parsed.tableCellPaddingX !== "string") ||
        (parsed.tableCellPaddingY !== undefined && typeof parsed.tableCellPaddingY !== "string") ||
        (parsed.hiddenColumnIndexes !== undefined &&
          !Array.isArray(parsed.hiddenColumnIndexes)) ||
        typeof parsed.showNumber !== "boolean" ||
        typeof parsed.rawInput !== "string"
      ) {
        setImportError("Format JSON tidak valid untuk timeline planner.");
        return;
      }

      applySnapshot({
        version: 1,
        timelineStartParts: parsed.timelineStartParts,
        timelineTargetAmount: parsed.timelineTargetAmount,
        timelineTargetColumn: parsed.timelineTargetColumn,
        timelineTaskDays: parsed.timelineTaskDays,
        timelineViewMode: parsed.timelineViewMode,
        tableFontSize: parsed.tableFontSize,
        tableCellPaddingX: parsed.tableCellPaddingX,
        tableCellPaddingY: parsed.tableCellPaddingY,
        hiddenColumnIndexes: parsed.hiddenColumnIndexes?.filter((value) => Number.isInteger(value)),
        showNumber: parsed.showNumber,
        rawInput: parsed.rawInput,
      });
      setImportError("");
      setImportDraft("");
      setIsImportDialogOpen(false);
    } catch {
      setImportError("JSON tidak bisa dibaca. Cek lagi formatnya.");
    }
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    file.text()
      .then((text) => {
        setImportDraft(text);
        setImportError("");
      })
      .catch(() => {
        setImportError("File JSON tidak bisa dibaca.");
      });

    event.target.value = "";
  }

  function updateHeaderColumn(source: string, columnIndex: number, nextHeader: string) {
    const lines = source.split("\n");
    if (lines.length === 0) {
      return source;
    }

    const headerParts = lines[0].split("|").map((part) => part.trim());
    if (columnIndex < 0 || columnIndex >= headerParts.length) {
      return source;
    }

    headerParts[columnIndex] = nextHeader.trim();
    lines[0] = headerParts.join(" | ");
    return lines.join("\n");
  }

  function deleteColumnFromRawInput(source: string, columnIndex: number) {
    const lines = source.split("\n").filter(Boolean);
    if (lines.length === 0) {
      return source;
    }

    const nextLines = lines.map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (columnIndex < 0 || columnIndex >= parts.length) {
        return line;
      }

      parts.splice(columnIndex, 1);
      return parts.join(" | ");
    });

    return nextLines.join("\n");
  }

  function handleTimelineCellClick(groupId: string, startIndex: number) {
    const nextRawInput = updateRawInputStartMacro(
      rawInput,
      groupId,
      effectiveTimelineTargetColumn,
      startIndex
    );

    setRawInput(nextRawInput);
    startTransition(() => {
      setSubmittedInput(nextRawInput);
    });
  }

  function applyManualDayChange(groupId: string, dayIndex: number, mode: "add" | "remove") {
    setRawInput((currentRawInput) => {
      const nextRawInput = updateRawInputManualMacro(
        currentRawInput,
        groupId,
        effectiveTimelineTargetColumn,
        dayIndex,
        mode
      );
      startTransition(() => {
        setSubmittedInput(nextRawInput);
      });
      return nextRawInput;
    });
  }

  function handleTimelineMouseDown(
    event: MouseEvent<HTMLTableCellElement>,
    group: ParsedGroup,
    dayIndex: number,
    isActive: boolean,
    isManual: boolean
  ) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      handleTimelineCellClick(group.id, dayIndex);
      return;
    }

    if (!event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (isActive && !isManual) {
      return;
    }

    const mode: "add" | "remove" = isManual ? "remove" : "add";
    manualDragVisitedRef.current = new Set([`${group.id}:${dayIndex}`]);
    const nextDragState = { groupId: group.id, mode };
    manualDragStateRef.current = nextDragState;
    setManualDragState(nextDragState);
    applyManualDayChange(group.id, dayIndex, mode);
  }

  function handleTimelineMouseEnter(group: ParsedGroup, dayIndex: number) {
    const activeDragState = manualDragStateRef.current;

    if (!activeDragState || activeDragState.groupId !== group.id) {
      return;
    }

    const visitKey = `${group.id}:${dayIndex}`;
    if (manualDragVisitedRef.current.has(visitKey)) {
      return;
    }

    manualDragVisitedRef.current.add(visitKey);
    applyManualDayChange(group.id, dayIndex, activeDragState.mode);
  }

  useEffect(() => {
    function stopManualDrag() {
      manualDragStateRef.current = null;
      setManualDragState(null);
      manualDragVisitedRef.current = new Set();
    }

    window.addEventListener("mouseup", stopManualDrag);
    return () => window.removeEventListener("mouseup", stopManualDrag);
  }, []);

  useEffect(() => {
    function closeActionMenu() {
      setOpenHeaderActionIndex(null);
      setOpenGroupActionId(null);
      setOpenHiddenColumnsMenu(false);
    }

    window.addEventListener("click", closeActionMenu);
    return () => window.removeEventListener("click", closeActionMenu);
  }, []);

  useEffect(() => {
    if (parsedTable.timelineHeader) {
      return;
    }

    if (parsedTable.headers.length === 0) {
      if (timelineTargetColumn !== "") {
        setTimelineTargetColumn("");
      }
      return;
    }

    const hasExistingColumn = parsedTable.headers.some(
      (header) => normalizeColumnName(header) === normalizeColumnName(timelineTargetColumn)
    );

    if (!hasExistingColumn) {
      setTimelineTargetColumn(parsedTable.headers[0]);
    }
  }, [parsedTable.headers, parsedTable.timelineHeader, timelineTargetColumn]);

  function handleOpenHeaderEdit(columnIndex: number) {
    const currentValue = parsedTable.headers[columnIndex] || "";
    setEditingHeader({ columnIndex, value: currentValue });
    setEditingHeaderDraft(currentValue);
    setOpenHeaderActionIndex(null);
  }

  function handleSaveHeaderEdit() {
    if (!editingHeader) {
      return;
    }

    const nextRawInput = updateHeaderColumn(rawInput, editingHeader.columnIndex, editingHeaderDraft);
    setRawInput(nextRawInput);
    startTransition(() => {
      setSubmittedInput(nextRawInput);
    });
    setEditingHeader(null);
    setEditingHeaderDraft("");
  }

  function handleDeleteColumn(columnIndex: number) {
    const nextRawInput = deleteColumnFromRawInput(rawInput, columnIndex);
    setRawInput(nextRawInput);
    setHiddenColumnIndexes((current) =>
      current
        .filter((index) => index !== columnIndex)
        .map((index) => (index > columnIndex ? index - 1 : index))
    );
    startTransition(() => {
      setSubmittedInput(nextRawInput);
    });
    setOpenHeaderActionIndex(null);
  }

  function handleToggleHiddenColumn(columnIndex: number) {
    setHiddenColumnIndexes((current) =>
      current.includes(columnIndex)
        ? current.filter((index) => index !== columnIndex)
        : [...current, columnIndex].sort((a, b) => a - b)
    );
    setOpenHeaderActionIndex(null);
  }

  function handleTimelineStatusChange(groupId: string, timelineStatus: string) {
    setRawInput((currentRawInput) => {
      const nextRawInput = updateRawInputTimelineStatusMacro(
        currentRawInput,
        groupId,
        effectiveTimelineTargetColumn,
        timelineStatus
      );
      startTransition(() => {
        setSubmittedInput(nextRawInput);
      });
      return nextRawInput;
    });
  }

  return (
    <main className=" min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-200 uppercase">
            <Sparkles className="size-3.5" />
            Raw Task Builder
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Button
              variant="outline"
              className="gap-2 border-white/10 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-white dark:border-white/10 dark:bg-slate-950/80 dark:hover:bg-slate-900"
              onClick={() => setIsTimelineSettingsOpen(true)}
            >
              <CalendarRange className="size-4" />
              Timeline global
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-white/10 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-white dark:border-white/10 dark:bg-slate-950/80 dark:hover:bg-slate-900"
              onClick={() => setIsRawInputOpen(true)}
            >
              <TableProperties className="size-4" />
              Input mentah
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-white/10 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-white dark:border-white/10 dark:bg-slate-950/80 dark:hover:bg-slate-900"
              onClick={() => setIsParserDialogOpen(true)}
            >
              Aturan parser
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-white/10 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-white dark:border-white/10 dark:bg-slate-950/80 dark:hover:bg-slate-900"
              onClick={handleExportJson}
            >
              <Download className="size-4" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-white/10 bg-slate-950/80 text-slate-100 hover:bg-slate-900 hover:text-white dark:border-white/10 dark:bg-slate-950/80 dark:hover:bg-slate-900"
              onClick={() => {
                setImportError("");
                setImportDraft("");
                setIsImportDialogOpen(true);
              }}
            >
              <Download className="size-4" />
              Import JSON
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Table Toolbar
            </div>
            <div className="text-xs text-slate-400">
              Font size, padding, dan hidden column diatur dari sini.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenHiddenColumnsMenu((current) => !current);
                }}
                className="flex h-9 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white transition hover:bg-slate-800"
              >
                Hidden col
              </button>
              {openHiddenColumnsMenu ? (
                <div
                  className="absolute top-11 left-0 z-30 grid min-w-48 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  {Array.from({ length: maxColumnCount }, (_, index) => {
                    const isHidden = hiddenColumnIndexes.includes(index);
                    const label = parsedTable.headers[index] || `Kolom ${index + 1}`;
                    return (
                      <button
                        key={`hidden-col-${index}`}
                        type="button"
                        onClick={() => handleToggleHiddenColumn(index)}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-900"
                      >
                        <span>{label}</span>
                        <span className={cn(isHidden ? "text-amber-300" : "text-emerald-300")}>
                          {isHidden ? "Hidden" : "Shown"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={showNumber}
                onChange={(event) => setShowNumber(event.target.checked)}
                className="size-4 rounded border-slate-500 bg-slate-950"
              />
              <span>Show number</span>
            </label>
            <label className="grid gap-1 text-xs text-slate-300">
              <span>Font size</span>
              <div className="flex items-center rounded-md border border-slate-700 bg-slate-900 pr-3">
                <input
                  inputMode="numeric"
                  value={tableFontSize}
                  onChange={(event) => setTableFontSize(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="h-9 w-20 bg-transparent px-3 text-sm text-white outline-none"
                />
                <span className="text-xs text-slate-400">px</span>
              </div>
            </label>
            <label className="grid gap-1 text-xs text-slate-300">
              <span>Padding X</span>
              <div className="flex items-center rounded-md border border-slate-700 bg-slate-900 pr-3">
                <input
                  inputMode="numeric"
                  value={tableCellPaddingX}
                  onChange={(event) =>
                    setTableCellPaddingX(event.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  className="h-9 w-20 bg-transparent px-3 text-sm text-white outline-none"
                />
                <span className="text-xs text-slate-400">px</span>
              </div>
            </label>
            <label className="grid gap-1 text-xs text-slate-300">
              <span>Padding Y</span>
              <div className="flex items-center rounded-md border border-slate-700 bg-slate-900 pr-3">
                <input
                  inputMode="numeric"
                  value={tableCellPaddingY}
                  onChange={(event) =>
                    setTableCellPaddingY(event.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  className="h-9 w-20 bg-transparent px-3 text-sm text-white outline-none"
                />
                <span className="text-xs text-slate-400">px</span>
              </div>
            </label>
          </div>
        </div>
        <section className="grid gap-6 overflow-auto">
          <Card className="border-white/10 bg-slate-950/60 shadow-[0_20px_70px_rgba(2,6,23,0.4)] backdrop-blur">
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1">
                  {parsedGroups.length} grup
                </span>
                <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1">
                  {maxColumnCount} kolom
                </span>
                <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1">
                  {timelineDates.length} hari
                </span>
              </div>



              <div className="overflow-x-auto">
                <div className="inline-block w-max rounded-2xl border border-white/10 bg-slate-950/70 p-3 align-top">
                  {(() => {
                    const weekBuckets = createWeekBuckets(timelineDates);
                    const monthBuckets = createMonthBuckets(timelineDates);
                    return (
                      <table className="w-max border-separate border-spacing-0 bg-slate-950" style={{ fontSize: `${fontSizePx}px` }}>
                        <thead>
                          {timelineViewMode === "day" ? (
                            <>
                              <tr className="text-slate-200">
                                {showNumber ? (
                                  <th
                                    rowSpan={2}
                                    className={cn(
                                      "w-16 bg-slate-900 border-b border-r border-white/10 px-4 py-2 text-center align-middle font-semibold"
                                    )}
                                    style={{ fontSize: `${fontSizePx}px` }}
                                  >
                                    No
                                  </th>
                                ) : null}
                                <th
                                  rowSpan={2}
                                  className="w-20 bg-slate-900 border-b border-r border-white/10 px-3 py-2 text-center align-middle font-semibold"
                                  style={{ fontSize: `${fontSizePx}px` }}
                                >
                                  Action
                                </th>
                                {visibleColumnIndexes.map((index) => (
                                  <th
                                    key={`header-${index}`}
                                    rowSpan={2}
                                    className={cn(
                                      "bg-slate-900 border-b border-r border-white/10 px-4 py-2 text-left font-semibold last:border-r-0"
                                    )}
                                    style={{ fontSize: `${fontSizePx}px` }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{parsedTable.headers[index] || `Kolom ${index + 1}`}</span>
                                      {index < parsedTable.headers.length ? (
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setOpenHeaderActionIndex((current) =>
                                                current === index ? null : index
                                              );
                                            }}
                                            className="flex size-7 items-center justify-center rounded-md border border-white/10 bg-slate-950/80 text-slate-300 transition hover:bg-slate-800"
                                            aria-label={`Aksi kolom ${parsedTable.headers[index]}`}
                                          >
                                            <MoreVertical className="size-4" />
                                          </button>
                                          {openHeaderActionIndex === index ? (
                                            <div
                                              className="absolute top-9 right-0 z-20 grid min-w-32 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-2xl"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => handleToggleHiddenColumn(index)}
                                                className="flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-900"
                                              >
                                                <MoreHorizontal className="size-4" />
                                                Hide
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleOpenHeaderEdit(index)}
                                                className="flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-900"
                                              >
                                                <Pencil className="size-4" />
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteColumn(index)}
                                                className="flex items-center gap-2 px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-rose-500/10"
                                              >
                                                <Trash2 className="size-4" />
                                                Hapus
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </th>
                                ))}
                                {monthBuckets.map((bucket) => (
                                  <th
                                    key={bucket.label}
                                    colSpan={bucket.dates.length}
                                    className={cn(
                                      "bg-slate-900 border-b border-r border-white/10 px-2 py-2 text-center font-semibold uppercase tracking-[0.18em] text-slate-300 last:border-r-0"
                                    )}
                                    style={{ fontSize: `${monthFontSizePx}px` }}
                                  >
                                    {bucket.label}
                                  </th>
                                ))}
                              </tr>
                              <tr className="text-slate-200">
                                {timelineDates.map((date) => (
                                  <th
                                    key={date}
                                    title={`${formatWeekday(date)}, ${formatLongDate(date)}`}
                                    className={cn(
                                      "bg-slate-900/95 border-b border-r border-white/10 text-center font-semibold last:border-r-0"
                                    )}
                                    style={{ ...timelineCellStyle, fontSize: `${dayFontSizePx}px` }}
                                  >
                                    {formatDayNumber(date)}
                                  </th>
                                ))}
                              </tr>
                            </>
                          ) : (
                            <tr className="text-slate-200">
                          {showNumber ? (
                            <th
                              className={cn(
                                "w-16 bg-slate-900 border-b border-r border-white/10 px-4 py-2 text-center align-middle font-semibold"
                              )}
                              style={{ fontSize: `${fontSizePx}px` }}
                            >
                                  No
                                </th>
                              ) : null}
                              <th
                                className="w-20 bg-slate-900 border-b border-r border-white/10 px-3 py-2 text-center align-middle font-semibold"
                                style={{ fontSize: `${fontSizePx}px` }}
                              >
                                Action
                              </th>
                              {visibleColumnIndexes.map((index) => (
                                <th
                                  key={`header-${index}`}
                                  className={cn(
                                    "bg-slate-900 border-b border-r border-white/10 px-4 py-2 text-left font-semibold last:border-r-0"
                                  )}
                                  style={{ fontSize: `${fontSizePx}px` }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span>{parsedTable.headers[index] || `Kolom ${index + 1}`}</span>
                                    {index < parsedTable.headers.length ? (
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenHeaderActionIndex((current) =>
                                              current === index ? null : index
                                            );
                                          }}
                                          className="flex size-7 items-center justify-center rounded-md border border-white/10 bg-slate-950/80 text-slate-300 transition hover:bg-slate-800"
                                          aria-label={`Aksi kolom ${parsedTable.headers[index]}`}
                                        >
                                          <MoreVertical className="size-4" />
                                        </button>
                                        {openHeaderActionIndex === index ? (
                                          <div
                                            className="absolute top-9 right-0 z-20 grid min-w-32 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-2xl"
                                            onClick={(event) => event.stopPropagation()}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => handleToggleHiddenColumn(index)}
                                                className="flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-900"
                                              >
                                                <MoreHorizontal className="size-4" />
                                                Hide
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleOpenHeaderEdit(index)}
                                              className="flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-900"
                                            >
                                              <Pencil className="size-4" />
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteColumn(index)}
                                              className="flex items-center gap-2 px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-rose-500/10"
                                            >
                                              <Trash2 className="size-4" />
                                              Hapus
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </th>
                              ))}
                              {weekBuckets.map((bucket) => (
                                <th
                                  key={bucket.label}
                                  className={cn(
                                    "min-w-24 bg-slate-900 border-b border-r border-white/10 px-2 py-2 text-center font-semibold last:border-r-0"
                                  )}
                                  style={{ fontSize: `${dayFontSizePx}px` }}
                                >
                                  <div className="text-slate-200" style={{ fontSize: `${dayFontSizePx}px` }}>{bucket.label}</div>
                                  <div className="text-slate-400" style={{ fontSize: `${monthFontSizePx}px` }}>
                                    {bucket.dates[0] ? formatShortDate(bucket.dates[0]) : ""}{" "}
                                    {bucket.dates.at(-1) ? `- ${formatShortDate(bucket.dates.at(-1) as string)}` : ""}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {parsedGroups.map((group, groupIndex) => {
                            const rowBaseClass = groupIndex % 2 === 0 ? "bg-slate-950" : "bg-slate-900/70";

                            return (
                              <Fragment key={group.id}>
                                {Array.from({ length: group.rowCount }).map((_, rowIndex) => {
                                  return (
                                    <tr
                                      key={`${group.id}-${rowIndex}`}
                                      className={rowBaseClass}
                                    >
                                      {showNumber ? (
                                        rowIndex === 0 ? (
                                          <td
                                            rowSpan={group.rowCount}
                                            className={cn(
                                              "border-b border-r border-white/10 text-center align-middle font-medium text-slate-300",
                                              rowBaseClass
                                            )}
                                            style={dataCellStyle}
                                          >
                                            {groupIndex + 1}
                                          </td>
                                        ) : null
                                      ) : null}
                                      {rowIndex === 0 ? (
                                        <td
                                          rowSpan={group.rowCount}
                                          className={cn(
                                            "border-b border-r border-white/10 text-center align-middle text-slate-300",
                                            rowBaseClass
                                          )}
                                          style={dataCellStyle}
                                        >
                                          <div className="relative flex items-center justify-center">
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setOpenGroupActionId((current) => current === group.id ? null : group.id);
                                              }}
                                              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-slate-900 text-slate-200 transition hover:bg-slate-800"
                                              aria-label={`Aksi grup ${groupIndex + 1}`}
                                            >
                                              <MoreHorizontal className="size-4" />
                                            </button>
                                            {openGroupActionId === group.id ? (
                                              <div
                                                className="absolute top-9 left-1/2 z-20 min-w-32 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950 shadow-2xl"
                                                onClick={(event) => event.stopPropagation()}
                                              >
                                                <div className="group/status relative">
                                                  <div className="flex items-center justify-between gap-3 px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-900">
                                                    <span>Status</span>
                                                    <span className="text-slate-500">›</span>
                                                  </div>
                                                  <div className="invisible absolute top-0 left-full z-30 ml-1 grid min-w-36 overflow-hidden rounded-lg border border-white/10 bg-slate-950 opacity-0 shadow-2xl transition group-hover/status:visible group-hover/status:opacity-100">
                                                    {["backlog", "progress", "done", "on hold", "remove"].map((statusOption) => (
                                                      <button
                                                        key={statusOption}
                                                        type="button"
                                                        onClick={() => {
                                                          handleTimelineStatusChange(group.id, statusOption);
                                                          setOpenGroupActionId(null);
                                                        }}
                                                        className={cn(
                                                          "px-3 py-2 text-left text-xs transition hover:bg-slate-900",
                                                          (group.timelineStatus ?? "backlog") === statusOption
                                                            ? "text-white"
                                                            : "text-slate-200"
                                                        )}
                                                      >
                                                        {statusOption === "on hold"
                                                          ? "On Hold"
                                                          : statusOption === "remove"
                                                            ? "Remove"
                                                            : statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        </td>
                                      ) : null}
                                      {visibleColumnIndexes.map((columnIndex) => {
                                        const cell = group.cells[columnIndex];
                                        const headerName = parsedTable.headers[columnIndex] || `Kolom ${columnIndex + 1}`;
                                        const statusValue = findStatusValue(group, parsedTable.headers);
                                        const isStatusHeader = normalizeColumnName(headerName) === "status";

                                        if (!cell) {
                                          return (
                                            <td
                                              key={`${group.id}-${rowIndex}-${columnIndex}`}
                                              className={cn(
                                                "border-b border-r border-white/10 text-slate-500 last:border-r-0",
                                                rowBaseClass
                                              )}
                                              style={dataCellStyle}
                                            />
                                          );
                                        }

                                        if (cell.mergeDown && rowIndex > 0) {
                                          return null;
                                        }

                                        const hasMultipleItems = cell.items.length > 1;
                                        const shouldRepeatStatus = isStatusHeader && Boolean(group.statusTargetColumn);
                                        const value = shouldRepeatStatus
                                          ? statusValue
                                          : hasMultipleItems
                                            ? cell.items[rowIndex] ?? ""
                                            : rowIndex === 0
                                              ? cell.value
                                              : "";

                                        return (
                                          <td
                                            key={`${group.id}-${rowIndex}-${columnIndex}`}
                                            rowSpan={cell.mergeDown ? group.rowCount : 1}
                                            className={cn(
                                              "border-b border-r border-white/10 align-top text-slate-200 last:border-r-0",
                                              isStatusHeader && "font-medium",
                                              rowBaseClass
                                            )}
                                            style={dataCellStyle}
                                          >
                                            {isStatusHeader ? (
                                              <span
                                                className={cn(
                                                  "inline-flex rounded-full border text-xs font-semibold",
                                                  statusTone(cell.value)
                                                )}
                                                style={statusBadgeStyle}
                                              >
                                                {value || "-"}
                                              </span>
                                            ) : (
                                              value || <span className="text-slate-600">-</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                      {timelineViewMode === "day"
                                        ? timelineDates.map((date, dateIndex) => {
                                          const statusValue = findStatusValue(group, parsedTable.headers);
                                          const isActive = timelineAssignments.get(group.id)?.has(date) ?? false;
                                          const isStartCell =
                                            group.startIndex !== null ? group.startIndex - 1 === dateIndex : false;
                                          const isManual = group.manualIndices.includes(dateIndex + 1);

                                          return (
                                            <td
                                              key={`${group.id}-${rowIndex}-${date}`}
                                              onMouseDown={(event) =>
                                                handleTimelineMouseDown(
                                                  event,
                                                  group,
                                                  dateIndex + 1,
                                                  isActive,
                                                  isManual
                                                )
                                              }
                                              onMouseEnter={() => handleTimelineMouseEnter(group, dateIndex + 1)}
                                              className={cn(
                                                "cursor-pointer border-b border-r border-white/10 text-center transition hover:bg-sky-500/10 last:border-r-0",
                                                isActive
                                                  ? getTimelineCellAppearance(group.timelineStatus, statusValue)
                                                  : rowBaseClass
                                              )}
                                              style={timelineCellStyle}
                                            >
                                              <div
                                                className={cn(
                                                  "rounded-sm border",
                                                  isActive || isStartCell ? "border-white/20" : "border-transparent",
                                                  isActive ? "opacity-100" : "opacity-0"
                                                )}
                                                style={{ minHeight: `${timelineCellMinHeightPx}px` }}
                                              >
                                                &nbsp;
                                              </div>
                                            </td>
                                          );
                                        })
                                        : weekBuckets.map((bucket) => {
                                          const activeDates = bucket.dates.filter((date) =>
                                            timelineAssignments.get(group.id)?.has(date)
                                          );
                                          const statuses = activeDates.map(() => group.timelineStatus || findStatusValue(group, parsedTable.headers) || "backlog");
                                          const isActive = activeDates.length > 0;

                                          return (
                                            <td
                                              key={`${group.id}-${bucket.label}`}
                                              className={cn(
                                                "min-w-24 border-b border-r border-white/10 px-2 py-2 text-center last:border-r-0",
                                                isActive ? getWeeklyCellAppearance(statuses) : rowBaseClass
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "min-h-9 rounded-md border",
                                                  isActive ? "border-white/20 opacity-100" : "border-transparent opacity-0"
                                                )}
                                              >
                                                &nbsp;
                                              </div>
                                            </td>
                                          );
                                        })}
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-950 p-4 text-slate-200 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Input mode</div>
                  <div className="mt-1 text-lg font-semibold text-white">Raw first</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Render mode</div>
                  <div className="mt-1 text-sm leading-6">
                    Per hari, default 30 hari, lalu auto-fill dari kolom acuan dan jumlah hari per task.
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Next step</div>
                  <div className="mt-1 text-sm leading-6">
                    Setelah fondasi harian ini enak, baru kita tambah mode week dan month.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <AppModal
        open={isTimelineSettingsOpen}
        onOpenChange={setIsTimelineSettingsOpen}
        title="Timeline Global"
        description="Atur tanggal mulai, durasi, view timeline, dan opsi global lainnya."
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5 text-sm">
            <span className="text-slate-300">Tanggal mulai</span>
            <div className="grid grid-cols-[72px_72px_1fr] gap-2">
              <Input
                inputMode="numeric"
                placeholder="03"
                value={timelineStartParts.day}
                onChange={(event) => handleTimelinePartChange("day", event.target.value)}
                className="border-slate-700 bg-slate-900 text-center text-white"
              />
              <Input
                inputMode="numeric"
                placeholder="06"
                value={timelineStartParts.month}
                onChange={(event) => handleTimelinePartChange("month", event.target.value)}
                className="border-slate-700 bg-slate-900 text-center text-white"
              />
              <Input
                inputMode="numeric"
                placeholder="2026"
                value={timelineStartParts.year}
                onChange={(event) => handleTimelinePartChange("year", event.target.value)}
                className="border-slate-700 bg-slate-900 text-center text-white"
              />
            </div>
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="text-slate-300">Progress harian</span>
            <div className="grid grid-cols-[96px_1fr] gap-2">
              <Input
                inputMode="numeric"
                value={timelineTargetAmount}
                onChange={(event) =>
                  setTimelineTargetAmount(event.target.value.replace(/\D/g, "").slice(0, 3))
                }
                className="border-slate-700 bg-slate-900 text-center text-white"
              />
              <div className="flex h-9 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200">
                hari
              </div>
            </div>
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="text-slate-300">Kolom acuan task</span>
            <select
              value={timelineTargetColumn}
              onChange={(event) => setTimelineTargetColumn(event.target.value)}
              className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              {parsedTable.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
            {parsedTable.timelineHeader ? (
              <p className="text-xs text-slate-400">
                Header `;timeline` aktif: timeline otomatis mengacu ke `{parsedTable.timelineHeader}`.
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="text-slate-300">Per task berapa hari</span>
            <select
              value={timelineTaskDays}
              onChange={(event) => setTimelineTaskDays(event.target.value)}
              className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              {Array.from({ length: 14 }).map((_, index) => {
                const value = String(index + 1);
                return (
                  <option key={value} value={value}>
                    {value} hari
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid gap-1.5 text-sm">
            <span className="text-slate-300">View timeline</span>
            <select
              value={timelineViewMode}
              onChange={(event) => setTimelineViewMode(event.target.value as TimelineViewMode)}
              className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
            </select>
          </div>

          {parsedTimelineStart ? (
            <div className="grid gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
              <p>
                Range otomatis: <span className="font-semibold text-white">{formatLongDate(timelineStart)}</span>{" "}
                sampai <span className="font-semibold text-white">{formatLongDate(timelineEnd)}</span>
              </p>
              <p>
                Render awal pakai <span className="font-semibold text-white">{timelineDates.length} hari</span>.
              </p>
              <p>
                Mode aktif: <span className="font-semibold text-white">{timelineViewMode === "day" ? "Daily" : "Weekly"}</span>
              </p>
              <p>
                Font table:{" "}
                <span className="font-semibold text-white">
                  {tableFontSize}px
                </span>
              </p>
              <p>
                Padding value:{" "}
                <span className="font-semibold text-white">
                  {tableCellPaddingX}px x {tableCellPaddingY}px
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-300">
              Isi tanggal mulai valid dulu supaya target timeline bisa dihitung otomatis.
            </p>
          )}
        </div>
      </AppModal>

      <AppModal
        open={isRawInputOpen}
        onOpenChange={setIsRawInputOpen}
        title="Input Mentah"
        description="Edit raw input penuh di sini, lalu render ulang untuk melihat hasil table terbaru."
        dialogClassName="h-[92vh] max-w-[calc(100%-2rem)] sm:max-w-6xl"
        contentClassName="flex-1"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsRawInputOpen(false)}>
              Tutup
            </Button>
            <Button variant="outline" onClick={() => setIsParserDialogOpen(true)}>
              Aturan parser
            </Button>
            <Button onClick={handleSubmitRawInput}>Render table</Button>
          </>
        }
      >
        <Textarea
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          className="min-h-full border-white/10 bg-slate-900 font-mono text-sm text-white"
          placeholder="migrasiFunctionA;m | fileA,fileB,fileC,fileD | on progress | deskripsi"
        />
      </AppModal>

      <AppModal
        open={Boolean(editingHeader)}
        onOpenChange={(open) => !open && setEditingHeader(null)}
        title="Edit Header Kolom"
        description="Ubah nama kolom langsung dari header table. Nilai di bawahnya tetap dipertahankan."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingHeader(null)}>
              Batal
            </Button>
            <Button onClick={handleSaveHeaderEdit}>Simpan</Button>
          </>
        }
      >
        <Input
          value={editingHeaderDraft}
          onChange={(event) => setEditingHeaderDraft(event.target.value)}
          className="border-white/10 bg-slate-900 text-white"
        />
      </AppModal>

      <AppModal
        open={isParserDialogOpen}
        onOpenChange={setIsParserDialogOpen}
        title="Aturan Parser"
        description="Referensi cepat untuk format raw input dan interaksi timeline."
      >
        <div className="grid gap-3 text-sm text-slate-300">
          <div>baris pertama = nama kolom / header table</div>
          <div>`|` = pindah ke kolom berikutnya</div>
          <div>`,` = item banyak di dalam satu grup</div>
          <div>`;m` = kolom sebelumnya di-merge vertikal mengikuti jumlah item</div>
          <div>`;status=NamaKolom` = status akan ditempel ke kolom header yang dipilih</div>
          <div>`;timeline` di header = tandai kolom acuan timeline, contoh `Task;timeline`</div>
          <div>`;start=Angka` = posisi mulai timeline hasil klik otomatis akan disimpan ke raw input</div>
          <div>`;manual=2,5,9` = tambahan slot harian manual hasil `Shift+Click`</div>
          <div>Export JSON = simpan seluruh setting dan raw input yang sudah disesuaikan</div>
          <div>Import JSON = overwrite state aktif sesuai isi snapshot JSON</div>
          <div className="text-slate-400">
            Contoh:
            `Task;timeline | Files | Status | Deskripsi`
          </div>
          <div className="text-slate-400">
            `migrasiFunctionA;m;status=Task;start=1;manual=4 | fileA,fileB,fileC,fileD | on progress | deskripsi`
          </div>
          <div className="text-slate-400">klik biasa = tidak mengubah timeline</div>
          <div className="text-slate-400">`Ctrl+Click` = geser task, `Shift+Click` = tambah/hapus hari manual</div>
          <div className="text-slate-400">tahan `Shift` lalu drag = isi beberapa slot manual sekaligus</div>
        </div>
      </AppModal>

      <AppModal
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        title="Import Snapshot JSON"
        description="Paste JSON snapshot di bawah ini. Import akan meng-overwrite semua data aktif."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Batal
            </Button>
            <Button className="bg-sky-500 text-white hover:bg-sky-400" onClick={handleImportJson}>
              Import dan Override
            </Button>
          </>
        }
        contentClassName="max-h-[55vh]"
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm text-slate-300">Pilih file JSON</label>
            <Input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              className="border-white/10 bg-slate-900 text-white file:mr-3 file:rounded-md file:border-0 file:bg-sky-500 file:px-3 file:py-1 file:text-white"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-slate-300">Konten JSON</label>
            <Textarea
              value={importDraft}
              onChange={(event) => setImportDraft(event.target.value)}
              className="min-h-56 border-white/10 bg-slate-900 font-mono text-sm text-white"
              placeholder='{"version":1,"timelineStartParts":{"day":"12","month":"03","year":"2026"}}'
            />
          </div>
          {importError ? <div className="text-sm text-rose-300">{importError}</div> : null}
        </div>
      </AppModal>
    </main>
  );
}
