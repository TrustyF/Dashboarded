/**
 * libinput calibrationMatrix values (as used in pi-setup/rc.xml's
 * <calibrationMatrix> element) for the 4 axis-aligned rotations about the
 * touch surface's center. Degrees are clockwise, matching libinput's own
 * convention - verified against this project's on-device testing history
 * (see pi-setup/rc.xml).
 */
export const CALIBRATION_MATRIX_BY_ROTATION = {
  0: "1 0 0 0 1 0",
  90: "0 -1 1 1 0 0",
  180: "-1 0 1 0 -1 1",
  270: "0 1 0 -1 0 1",
};
