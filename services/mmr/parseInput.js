const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { validateRecord } = require('./schema.js');

function parseCsv(fileContent) {
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  return records.map(record => {
    // Convert string booleans
    const maintenancePerformed = record.maintenancePerformed === 'true';
    const outOfService = record.outOfService === 'true';
    
    // Parse maintenanceEntries (06/14/2026:Replaced front brake pads|06/20/2026:Oil change)
    let maintenance = [];
    if (record.maintenanceEntries && record.maintenanceEntries.trim() !== '') {
      maintenance = record.maintenanceEntries.split('|').map(entry => {
        const [date, ...descParts] = entry.split(':');
        return {
          date: date.trim(),
          description: descParts.join(':').trim()
        };
      });
    }

    const payload = {
      unit: record.unit,
      recordMonth: record.recordMonth,
      mileage: parseInt(record.mileage, 10),
      mileageSource: record.mileageSource,
      maintenancePerformed,
      outOfService,
      maintenance
    };

    return validateRecord(payload);
  });
}

module.exports = { parseCsv };
