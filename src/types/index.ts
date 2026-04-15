export type UserRole = 'customer' | 'owner';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  created_at: string;
}

export interface Coupon {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  total_quantity: number;
  issued_count: number;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCoupon {
  id: string;
  user_id: string;
  coupon_id: string;
  status: 'available' | 'used';
  qr_token: string;
  received_at: string;
  used_at?: string;
  coupon?: Coupon;
}

export interface StampCard {
  id: string;
  user_id: string;
  owner_id: string;
  stamp_count: number;
  required_count: number;
}

export interface StampHistory {
  id: string;
  stamp_card_id: string;
  stamped_at: string;
  stamped_by: string;
}
