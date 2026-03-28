/** SeatingKonvaRowEditor ile oturum-plani sayfasındaki otomatik hizalamayı senkron tutar */
export const ROW_EDITOR_STAGE_H = 108;
export const ROW_EDITOR_R = 14;
export const ROW_EDITOR_GAP = 34;
export const ROW_EDITOR_PAD_X = 24;

export const ROW_EDITOR_GRID_BASE_X = ROW_EDITOR_PAD_X + ROW_EDITOR_R;
export const ROW_EDITOR_GRID_CENTER_Y = ROW_EDITOR_STAGE_H / 2;

export function rowEditorStageWidth(seatCount: number) {
  if (seatCount <= 0) return 200;
  return Math.max(
    200,
    ROW_EDITOR_PAD_X + ROW_EDITOR_R + Math.max(0, seatCount - 1) * ROW_EDITOR_GAP + ROW_EDITOR_R + ROW_EDITOR_PAD_X
  );
}
