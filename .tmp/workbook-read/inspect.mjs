import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = process.argv[2];
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheets = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 12,
  tableMaxCellChars: 160,
});
console.log("===WORKBOOK===");
console.log(sheets.ndjson);

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  console.log(`===SHEET:${sheet.name}:USED:${used?.address || "EMPTY"}===`);
  if (!used) continue;
  const table = await workbook.inspect({
    kind: "region",
    sheetId: sheet.name,
    range: used.address,
    include: "values,formulas",
    maxChars: 60000,
    tableMaxRows: 250,
    tableMaxCols: 40,
    tableMaxCellChars: 500,
  });
  console.log(table.ndjson);
}
