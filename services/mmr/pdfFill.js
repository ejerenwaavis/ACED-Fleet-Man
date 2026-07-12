const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Fills the MMR PDF template with record data and signature.
 * 
 * @param {object} record - Validated MMR record data
 * @param {object} config - Company config
 * @param {string} signaturePath - Path to signature PNG image
 * @param {string} templatePath - Path to MGBA-355.pdf
 * @param {string} dateCompleted - Calculated submission date
 * @param {string} recordMonthLabel - Formatted month label e.g., "June 2026"
 * @returns {Promise<Uint8Array>}
 */
async function fillMmr(record, config, signaturePath, templatePath, dateCompleted, recordMonthLabel) {
  const existingPdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const form = pdfDoc.getForm();

  // Fill text fields
  form.getTextField('Maintenance Record for the Month and Year of').setText(recordMonthLabel);
  form.getTextField('Domicile StationHub').setText(record.domicile || config.domicile);
  form.getTextField('Service Provider Company Name').setText(record.companyName || config.companyName);
  form.getTextField('Current Mileage Odometer Reading').setText(record.mileage.toString());
  form.getTextField('Vehicle Unit').setText(record.unit);
  form.getTextField('Date Completed').setText(dateCompleted);

  // Fill maintenance rows
  if (record.maintenance && record.maintenance.length > 0) {
    for (let i = 0; i < record.maintenance.length; i++) {
      const entry = record.maintenance[i];
      const row = i + 1; // 1-indexed for the form fields
      form.getTextField(`Date of MaintenanceRow${row}`).setText(entry.date);
      form.getTextField(`Specific Description of Maintenance PerformedRow${row}`).setText(entry.description);
    }
  }

  // Checkbox logic
  const check3 = form.getCheckBox('Check Box3'); // Q1 Yes
  const check1 = form.getCheckBox('Check Box1'); // Q1 No
  const check4 = form.getCheckBox('Check Box4'); // Q2 Yes
  const check2 = form.getCheckBox('Check Box2'); // Q2 No
  const check5 = form.getCheckBox('Check Box5'); // Declaration

  if (record.maintenancePerformed) {
    check3.check();
    check1.uncheck();
    check2.uncheck();
    check4.uncheck();
  } else {
    check1.check();
    check3.uncheck();
    check4.uncheck();
    check2.check(); // always No for second question if no maintenance performed
  }
  // Declaration always checked
  check5.check();

  // Flatten the form
  form.flatten();

  // Overlay Signature
  if (record.applySignature !== false && signaturePath && fs.existsSync(signaturePath)) {
    const signatureImageBytes = fs.readFileSync(signaturePath);
    let signatureImage;
    if (signaturePath.toLowerCase().endsWith('.png')) {
      signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    } else if (signaturePath.toLowerCase().endsWith('.jpg') || signaturePath.toLowerCase().endsWith('.jpeg')) {
      signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
    }

    if (signatureImage) {
      const maxWidth = 308;
      const maxHeight = 27;
      let width = signatureImage.width;
      let height = signatureImage.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      const newWidth = width * ratio;
      const newHeight = height * ratio;

      const xOffset = 37.2 + (maxWidth - newWidth) / 2;
      const yOffset = 124.9 + (maxHeight - newHeight) / 2;

      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      firstPage.drawImage(signatureImage, {
        x: xOffset,
        y: yOffset,
        width: newWidth,
        height: newHeight,
      });
    }
  }

  return await pdfDoc.save();
}

module.exports = { fillMmr };
