// date.ts — 날짜 유틸리티 (date-fns 미설치 환경용 경량 구현)
export function differenceInDays(dateLeft: Date, dateRight: Date): number {
  const ms = dateLeft.getTime() - dateRight.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
