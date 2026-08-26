import { z } from 'zod';

/** Mirrors `CreateReservationDto`/`WalkInReservationDto`'s shared guest+stay fields (roomick-pms-backend/src/modules/reservations/dto/reservation.dto.ts). `roomId` is added separately by the page itself once a room is picked — not part of the form schema, since it's only required in immediate mode. */
export const walkInBookingSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Required').max(200),
    guestEmail: z.string().trim().toLowerCase().max(320).email('Invalid email').optional().or(z.literal('')),
    guestPhone: z.string().trim().max(20).optional().or(z.literal('')),
    roomTypeId: z.string().uuid('Select a room type'),
    checkInDate: z.string().min(1, 'Required'),
    checkOutDate: z.string().min(1, 'Required'),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20).optional(),
    specialRequests: z.string().max(1000).optional().or(z.literal('')),
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out must be after check-in',
    path: ['checkOutDate'],
  });

export type WalkInBookingFormValues = z.infer<typeof walkInBookingSchema>;
