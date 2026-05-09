export type OrganizerTicketSummaryEvent = {
  eventId: string;
  title: string;
  date: string | null;
  soldTickets: number;
  remainingTickets: number;
  capacity: number;
  grossRevenue: number;
  shippingFeesTotal: number;
  ticketRevenueApprox: number;
};

export type OrganizerTicketSummaryResponse = {
  summary: {
    soldTickets: number;
    remainingTickets: number;
    capacity: number;
    grossRevenue: number;
    shippingFeesTotal: number;
    ticketRevenueApprox: number;
  };
  events: OrganizerTicketSummaryEvent[];
};
