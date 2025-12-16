import { computeTrendScore, computeSentiment } from "../utils/trendUtils.js";

test("computeTrendScore produces higher score for growth + sentiment", () => {
  const s1 = computeTrendScore(100, 10, 0.5);
  const s2 = computeTrendScore(10, 10, 0.5);
  expect(s1).toBeGreaterThan(s2);
});

test("computeSentiment bounds between -1 and 1", () => {
  expect(computeSentiment("I love this!")).toBeLessThanOrEqual(1);
  expect(computeSentiment("I hate this!")).toBeGreaterThanOrEqual(-1);
});
