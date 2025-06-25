"use strict";
const { z } = require('zod');
const appointmentSchema = z.object({
    customer_id: z.number().int(),
    vehicle_id: z.number().int().nullable(),
    service_id: z.number().int(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
    location_address: z.string(),
    notes: z.string().optional(),
});
module.exports = {
    appointmentSchema,
};
