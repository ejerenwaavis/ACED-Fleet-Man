const { z } = require('zod');

const mmrSchema = z.object({
  unit: z.string().min(1, 'Unit ID is required'),
  recordMonth: z.string().regex(/^\d{4}-\d{2}$/, 'recordMonth must be YYYY-MM'),
  mileage: z.number().int().nonnegative('Mileage must be a positive integer'),
  mileageSource: z.enum(['actual', 'interpolated']),
  maintenancePerformed: z.boolean(),
  outOfService: z.boolean(),
  companyName: z.string().optional(),
  applySignature: z.boolean().optional(),
  domicile: z.string().optional(),
  maintenance: z.array(
    z.object({
      date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Date must be MM/DD/YYYY'),
      description: z.string().min(1, 'Description is required')
    })
  ).max(5, 'Maximum of 5 maintenance entries allowed').default([])
});

function validateRecord(record) {
  try {
    return mmrSchema.parse(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed for record ${record.unit || 'unknown'}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

module.exports = { mmrSchema, validateRecord };
