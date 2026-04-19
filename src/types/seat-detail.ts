/** Yer seçimli biletlerde koltuk satırı (order_seats / baskı bileşeni) */
export type SeatDetail = {
  section_name: string;
  row_label: string;
  seat_label: string;
  ticket_code?: string;
};
