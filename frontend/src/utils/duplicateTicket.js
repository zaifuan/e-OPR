import { computeServerOffset } from './editTokens';

// Kemas Kini 3: tiket sumber Duplicate bertandatangan server (pengesahan jejak
// sumber sahaja) + masa tamat & offset jam server untuk semakan "hampir tamat".
export function ticketFromSource(data) {
  return {
    value: typeof data.source_ticket === 'string' ? data.source_ticket : null,
    expiresAt: data.source_ticket_expires_at || null,
    serverOffsetMs: computeServerOffset(data.server_time),
  };
}
