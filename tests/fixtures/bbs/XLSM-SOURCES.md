# XLSM fixtures

- `excel-macro.xlsm`: `SimpleMacro.xlsm` from the Apache POI test data
  (https://github.com/apache/poi, `test-data/spreadsheet/`), Apache License 2.0.
  Saved by Microsoft Excel, contains `xl/vbaProject.bin`. Used to check that a
  real macro-enabled workbook is read and that the macro part is never opened.
- `sample.xlsm`: the BBS Analyzer sample schedule saved as a macro-enabled
  workbook (`application/vnd.ms-excel.sheet.macroEnabled.main+xml`).
  Expected: 860 bars, 1,859.60 m, 2.080 t, the same as the CSV sample.
