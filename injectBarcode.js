const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let appCode = fs.readFileSync(appPath, 'utf8');

const barcodeEndpoint = `
app.get('/api/vehicles/:id/barcode', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        
        const barcodeString = \`V\${vehicle.truckNumber}\`;
        const pngBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeString,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        });
        
        res.set('Content-Type', 'image/png');
        res.send(pngBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate barcode' });
    }
});
`;

if (!appCode.includes('/api/vehicles/:id/barcode')) {
    appCode = appCode.replace('// --- Maintenance Routes ---', barcodeEndpoint + '\n// --- Maintenance Routes ---');
    fs.writeFileSync(appPath, appCode);
    console.log('Barcode endpoint injected');
} else {
    console.log('Barcode endpoint already exists');
}
