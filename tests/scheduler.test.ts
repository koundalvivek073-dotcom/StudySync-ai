import assert from "node:assert/strict";
import test from "node:test";
import { addDays, format } from "date-fns";
import { generateSchedule } from "../lib/scheduler";
import type { AvailabilityProfile, DayOfWeek, ParsedSyllabus } from "../lib/types";
import { generateSmartCurriculum } from "../lib/curriculumGenerator";
import { normalizeToParsedSyllabus } from "../lib/syllabusParser";

const days: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function makeProfile(fixedCommitments: AvailabilityProfile["fixedCommitments"]): AvailabilityProfile {
  return {
    occupation: "student",
    fixedCommitments,
    transitionBuffer: 30,
    meals: {
      breakfast: "07:30",
      breakfastDuration: 20,
      lunch: "13:00",
      lunchDuration: 30,
      dinner: "19:30",
      dinnerDuration: 30,
    },
    hygieneSlots: [],
    sleepHours: 8,
    bedtime: "23:00",
    wakeTime: "07:00",
    sessionLength: 45,
    peakEnergy: "morning",
    horizonDays: 2,
    breakBetweenSessions: 10,
  };
}

function makeSyllabus(): ParsedSyllabus {
  return {
    id: "test-syllabus",
    title: "Test Syllabus",
    items: [{
      id: "test-topic",
      subject: "Mathematics",
      chapter: "Algebra",
      topicName: "Equations",
      difficulty: "medium",
      complexity: "medium",
      estimatedHours: 100,
      color: "#6366f1",
    }],
    totalHours: 100,
  };
}

function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function overlaps(block: { startTime: string; endTime: string }, start: number, end: number) {
  return minutes(block.startTime) < end && minutes(block.endTime) > start;
}

test("schedules commitments only on their selected weekdays", () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDate = format(today, "yyyy-MM-dd");
  const secondDate = format(addDays(today, 1), "yyyy-MM-dd");
  const firstDay = days[today.getDay()];
  const profile = makeProfile([{
    start: "08:00",
    end: "18:00",
    days: [firstDay],
    label: "Classes",
  }]);

  const { blocks } = generateSchedule(makeSyllabus(), profile);
  const commitmentBlocks = blocks.filter((block) => block.type === "commitment");
  const firstDayStudy = blocks.filter((block) => block.type === "study" && block.date === firstDate);
  const secondDayStudy = blocks.filter((block) => block.type === "study" && block.date === secondDate);

  assert.ok(commitmentBlocks.some((block) => block.date === firstDate && block.label === "Classes"));
  assert.ok(!commitmentBlocks.some((block) => block.date === secondDate && block.label === "Classes"));
  assert.ok(firstDayStudy.every((block) => !overlaps(block, 8 * 60, 18 * 60)));
  assert.ok(secondDayStudy.some((block) => overlaps(block, 8 * 60, 18 * 60)));
});

test("commitments without selected weekdays still apply every day", () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDate = format(today, "yyyy-MM-dd");
  const secondDate = format(addDays(today, 1), "yyyy-MM-dd");
  const { blocks } = generateSchedule(
    makeSyllabus(),
    makeProfile([{ start: "08:00", end: "09:00", label: "Appointment" }]),
  );
  const dates = new Set(
    blocks
      .filter((block) => block.type === "commitment" && block.label === "Appointment")
      .map((block) => block.date),
  );

  assert.ok(dates.has(firstDate));
  assert.ok(dates.has(secondDate));
});

test("generated estimates do not claim a parser confidence score", () => {
  const generated = generateSmartCurriculum("Mathematics");
  const locallyParsed = normalizeToParsedSyllabus(
    {
      title: "Course",
      subjects: [{
        subjectName: "Mathematics",
        chapters: [{
          chapterName: "Algebra",
          topics: [{ topicName: "Equations", difficulty: "easy", estimatedHours: 1 }],
        }],
      }],
    },
    "Course",
    "local-parser",
  );

  assert.equal(generated.source, "smart-engine");
  assert.equal(generated.parseConfidence, undefined);
  assert.equal(locallyParsed.parseConfidence, undefined);
});
