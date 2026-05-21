const XLSX = require("xlsx");
const fs = require("fs");

const workbook = XLSX.readFile("./Data/bc342823c30831a60c44261bba2c904d.xlsx");
const sheetName = workbook.SheetNames[0];

const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  header: 1
});

// skip first row/header row
const cleanRows = rows.slice(2)
  .filter(row => row[0] && row[1] && row[2] && row[3])
  .map(row => ({
    state: String(row[0]).trim(),
    city: String(row[1]).trim(),
    district: String(row[2]).trim(),
    street: String(row[3]).trim(),
    longitude: row[4] || null,
    latitude: row[5] || null
  }));

fs.writeFileSync(
  "./Data/spx-addresses.json",
  JSON.stringify(cleanRows, null, 2)
);

console.log("SPX addresses converted:", cleanRows.length);