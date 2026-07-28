export interface Role {
  id: number;
  name: string;
  slug: string;
  requires_task_division?: boolean;
  task_divisions?: Array<{ value: string; label: string; description: string }>;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  head_name?: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
  performance_rating?: number;
  total_deliveries?: number;
  notes?: string;
}

export type RealPropertyStatus = 'active' | 'under_construction' | 'leased' | 'inactive' | 'disposed';

export interface RealProperty {
  id: number;
  account_name: string;
  property_no: string;
  article?: string;
  description?: string;
  location?: string;
  qty?: number | string;
  uom?: string;
  unit_cost?: number | string;
  acquisition_cost?: number | string;
  acquisition_date?: string;
  status: RealPropertyStatus;
  office?: string;
  department_id?: number;
  department?: Department;
  obr_no?: string;
  remarks?: string;
  source?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  employee_id?: string;
  phone?: string;
  is_active?: boolean;
  role?: Role;
  department?: Department;
  document_task_division?: string | null;
  permissions: string[];
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  inventory_items_count?: number;
}

export interface InventoryItem {
  id: number;
  item_code: string;
  property_number?: string;
  serial_number?: string;
  brand?: string;
  model?: string;
  name: string;
  description?: string;
  category_id: number;
  category?: Category;
  categories?: Category[];
  unit_of_measure: string;
  quantity: number;
  reorder_level: number;
  unit_cost: number;
  supplier_id?: number;
  storage_location?: string;
  date_acquired?: string;
  condition: string;
  status: string;
  is_asset: boolean;
  is_consumable?: boolean;
  qr_code_data?: string;
  photo_path?: string;
  has_photo?: boolean;
  supplier?: { id: number; name: string };
}

export interface IssuanceRequest {
  id: number;
  request_number: string;
  mr_number?: string;
  department_id: number;
  department?: Department;
  requested_by: number;
  requester?: User;
  status: string;
  purpose: string;
  notes?: string;
  date_requested: string;
  date_approved?: string;
  date_issued?: string;
  items?: IssuanceItem[];
}

export interface IssuanceItem {
  id: number;
  inventory_item_id: number;
  quantity_requested: number;
  quantity_issued: number;
  inventory_item?: InventoryItem;
}

export interface Asset {
  id: number;
  property_number: string;
  qr_code_data: string;
  location?: string;
  condition: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  inventory_item?: InventoryItem;
  custodian?: User;
  department?: Department;
}

export interface AuditLog {
  id: number;
  action: string;
  module: string;
  description?: string;
  ip_address?: string;
  created_at: string;
  user?: User;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface StockTransaction {
  id: number;
  transaction_number: string;
  type: string;
  inventory_item_id: number;
  inventory_item?: InventoryItem;
  quantity: number;
  unit_cost: number;
  performer?: User;
  created_at: string;
}

export interface InventoryAdjustment {
  id: number;
  adjustment_number: string;
  inventory_item_id: number;
  inventory_item?: InventoryItem;
  adjustment_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  status: string;
  adjuster?: User;
  approver?: User;
  created_at: string;
}

export interface ReconciliationItem {
  id: number;
  inventory_item_id: number;
  inventory_item?: InventoryItem;
  system_quantity: number;
  physical_quantity?: number;
  variance?: number;
}

export interface InventoryReconciliation {
  id: number;
  reconciliation_number: string;
  title: string;
  status: string;
  notes?: string;
  starter?: User;
  items?: ReconciliationItem[];
  created_at: string;
}

export interface Batch {
  id: number;
  inventory_item_id: number;
  inventory_item?: InventoryItem;
  batch_number: string;
  lot_number?: string;
  quantity: number;
  expiration_date?: string;
}

export interface ReplenishmentRecommendation {
  id: number;
  item_code: string;
  name: string;
  category?: string;
  quantity: number;
  reorder_level: number;
  recommended_qty: number;
  unit_cost: number;
  estimated_cost: number;
}

export interface AssetAssignment {
  id: number;
  assignment_number: string;
  asset_id: number;
  asset?: Asset;
  accountability_document_id?: number;
  accountability_document?: AccountabilityDocument;
  material_release_id?: number;
  material_release_item_id?: number;
  material_release?: MaterialRelease;
  material_release_item?: MaterialReleaseItem;
  custodian_user_id: number;
  custodian?: User;
  department?: Department;
  assigner?: User;
  assignment_date: string;
  document_type: string;
  acknowledgment_number?: string;
  status: string;
  notes?: string;
}

export interface AccountabilityDocument {
  id: number;
  acknowledgment_number: string;
  document_type: 'ics' | 'par';
  custodian_user_id: number;
  custodian?: User;
  department?: Department;
  material_release_id?: number;
  material_release?: MaterialRelease;
  assignment_date: string;
  fund_code: string;
  fund_name: string;
  obr_reference?: string | null;
  mr_reference?: string | null;
  assigner?: User;
  status: string;
  notes?: string;
  items?: AssetAssignment[];
  items_count?: number;
}

export interface PendingAccountabilityItem {
  id: number;
  material_release_id: number;
  mr_number?: string;
  release_date?: string;
  purpose?: string;
  recipient?: User;
  department?: Department;
  serial_number?: string;
  quantity: number;
  unit_cost: number;
  suggested_document_type: 'ics' | 'par';
  inventory_item?: InventoryItem;
}

export interface AssetTransfer {
  id: number;
  transfer_number: string;
  asset_id: number;
  asset?: Asset;
  from_user?: User;
  to_user?: User;
  from_department?: Department;
  to_department?: Department;
  transfer_date: string;
  reason?: string;
}

export interface BorrowingLog {
  id: number;
  borrow_number: string;
  asset_id: number;
  asset?: Asset;
  borrower?: User;
  department?: Department;
  borrow_date: string;
  expected_return_date: string;
  condition_on_borrow: string;
  status: string;
}

export interface Inspection {
  id: number;
  inspection_number: string;
  asset_id?: number;
  asset?: Asset;
  inventory_item_id?: number;
  inventory_item?: InventoryItem;
  inspector?: User;
  scheduled_date: string;
  completed_date?: string;
  condition?: string;
  findings?: string;
  status: string;
}

export interface MaintenanceRecord {
  id: number;
  maintenance_number: string;
  asset_id: number;
  asset?: Asset;
  type: string;
  scheduled_date?: string;
  completed_date?: string;
  service_provider?: string;
  cost: number;
  description?: string;
  status: string;
  performer?: User;
}

export interface RepairRecord {
  id: number;
  repair_number: string;
  asset_id: number;
  asset?: Asset;
  service_provider?: string;
  repair_date: string;
  cost: number;
  description?: string;
  recorder?: User;
}

export interface DisposalRecord {
  id: number;
  disposal_number: string;
  asset_id?: number;
  asset?: Asset;
  inventory_item_id?: number;
  inventory_item?: InventoryItem;
  recommendation_date: string;
  reason: string;
  status: string;
}

export interface PurchaseRequestItem {
  id: number;
  inventory_item_id?: number;
  description: string;
  unit_of_measure?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  quantity: number;
  unit_cost: number;
  inventory_item?: InventoryItem;
}

export interface PurchaseRequest {
  id: number;
  pr_number: string;
  department_id: number;
  department?: Department;
  requester?: User;
  title: string;
  description?: string;
  date_needed?: string;
  mode_of_procurement?: string;
  budget_allocation_id?: number;
  budget_allocation?: BudgetAllocation;
  total_estimated_cost: number;
  status: string;
  items?: PurchaseRequestItem[];
}

export interface PurchaseOrderItem {
  id: number;
  inventory_item_id?: number;
  description: string;
  unit_of_measure?: string;
  quantity_ordered: number;
  quantity_received?: number;
  unit_cost: number;
  inventory_item?: InventoryItem;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  purchase_request_id: number;
  purchase_request?: PurchaseRequest;
  supplier_id: number;
  supplier?: { id: number; name: string; contact_person?: string; phone?: string; email?: string };
  total_amount: number;
  expected_delivery_date?: string;
  delivery_location?: string;
  payment_terms?: string;
  contact_person?: string;
  notes?: string;
  status: string;
  items?: PurchaseOrderItem[];
}

export interface DeliveryReceipt {
  id: number;
  dr_number: string;
  status?: string;
  purchase_order_id?: number | null;
  po_number?: string;
  purchase_order?: PurchaseOrder;
  delivery_date: string;
  supplier_reference_number?: string;
  delivery_location?: string;
  delivery_condition?: string;
  inspector_name?: string;
  notes?: string;
  draft_items?: {
    supplier_name?: string;
    pr_reference?: string;
    supplier_reference_number?: string;
    delivery_location?: string;
    delivery_condition?: string;
    inspector_name?: string;
    notes?: string;
    trigger_stock_in?: boolean;
    abc_amount?: number;
    amount?: number;
    items?: Array<{
      po_item_id?: string;
      inventory_item_id?: string;
      description?: string;
      unit_of_measure?: string;
      quantity_ordered?: string;
      quantity_received_prior?: string;
      quantity_received?: string;
      unit_cost?: string;
      brand?: string;
      model?: string;
      serial_number?: string;
      serial_numbers?: string[];
    }>;
  };
  receiver?: User;
  stock_receipt?: {
    items?: Array<{
      inventory_item_id?: number;
      unit_cost?: number;
      description?: string;
      unit_of_measure?: string;
      quantity_received?: number;
      brand?: string;
      model?: string;
      serial_number?: string;
      serial_numbers?: string[];
      inventory_item?: InventoryItem;
    }>;
  };
}

export interface AcceptanceInspectionItem {
  description: string;
  unit_of_measure?: string;
  quantity_ordered?: number | string;
  quantity_delivered?: number | string;
  quantity_accepted?: number | string;
  unit_cost?: number | string;
  remarks?: string;
}

export interface AcceptanceInspectionReport {
  id: number;
  air_number: string;
  status: string;
  purchase_order_id?: number | null;
  po_number?: string;
  purchase_order?: PurchaseOrder;
  delivery_receipt_id?: number;
  delivery_receipt?: DeliveryReceipt;
  inspection_date: string;
  acceptance_date?: string;
  place_of_delivery?: string;
  inspector_name?: string;
  inspector_position?: string;
  accepted_by_name?: string;
  accepted_by_position?: string;
  supply_officer_name?: string;
  supply_officer_position?: string;
  inspection_result?: string;
  findings?: string;
  remarks?: string;
  po_date?: string;
  invoice_number?: string;
  invoice_date?: string;
  requisitioning_office?: string;
  obligation_request_no?: string;
  abc_amount?: number | string;
  amount?: number | string;
  remarks_for_use_of?: string;
  acceptance_complete?: boolean;
  acceptance_partial?: boolean;
  acceptance_spec_accepted?: boolean;
  inspection_correct?: boolean;
  items?: AcceptanceInspectionItem[];
  preparer?: User;
}

export interface ReceivedItem {
  id: number;
  acceptance_inspection_report_id: number;
  delivery_receipt_id?: number | null;
  air_number: string;
  dr_number?: string | null;
  po_number?: string | null;
  line_number: number;
  description: string;
  unit_of_measure: string;
  quantity_ordered: number | string;
  quantity_delivered: number | string;
  quantity_accepted: number | string;
  quantity_on_hand: number | string;
  unit_cost: number | string;
  total_cost: number | string;
  supplier_name?: string | null;
  requisitioning_office?: string | null;
  storage_location?: string | null;
  acceptance_date?: string | null;
  remarks?: string | null;
  status: string;
  acceptance_inspection_report?: AcceptanceInspectionReport;
  delivery_receipt?: DeliveryReceipt;
}

export interface BudgetAllocation {
  id: number;
  department_id: number;
  department?: Department;
  fiscal_year: string;
  category?: string;
  description?: string;
  allocated_amount: number;
  spent_amount: number;
}

export interface ProcurementSummary {
  draft_prs: number;
  submitted_prs: number;
  approved_prs: number;
  open_pos: number;
  fulfilled_pos: number;
}

export interface BudgetSummaryRow {
  department?: string;
  allocated: number;
  spent: number;
  remaining: number;
}

export interface AiChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiAnalyticsKpis {
  inventory_value: number;
  total_stock_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  asset_utilization_rate: number;
  inventory_turnover_ratio: number;
  dead_stock_value: number;
  dead_stock_count: number;
  monthly_consumption: number;
  monthly_stock_in: number;
  fast_moving_items: { item_code: string; name: string; total_out: number }[];
  slow_moving_items: { item_code: string; name: string; quantity: number; total_out: number }[];
  procurement_trends: { month: string; count: number; amount: number }[];
}

export interface AiExecutiveSummary {
  period: string;
  date_range: { start: string; end: string };
  narrative: string;
  metrics: {
    inventory_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
    stock_out: number;
    stock_in: number;
    procurement_orders: number;
    procurement_value: number;
    budget_utilization_pct: number;
    asset_utilization_rate: number;
    dead_stock_value: number;
  };
  highlights: { type: string; message: string }[];
}

export interface MaterialReleaseItem {
  id: number;
  inventory_item_id: number;
  serial_number?: string;
  quantity: number;
  unit_cost: number;
  inventory_item?: InventoryItem;
  material_release?: MaterialRelease;
}

export interface MaterialRelease {
  id: number;
  mr_number: string;
  recipient_user_id?: number;
  department_id?: number;
  purpose?: string;
  release_date?: string;
  source: 'direct' | 'request';
  status?: 'draft' | 'completed';
  notes?: string;
  draft_items?: {
    recipient_user_id?: number;
    department_id?: number;
    purpose?: string;
    notes?: string;
    items?: Array<{
      inventory_item_id: number;
      quantity: number;
      serial_number?: string;
    }>;
  };
  recipient?: User;
  department?: Department;
  releaser?: User;
  items?: MaterialReleaseItem[];
  issuance_request?: IssuanceRequest;
}

export interface UserPresence {
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen_at?: string;
}

export interface MessagingUser {
  id: number;
  name: string;
  email?: string;
  employee_id?: string;
  department?: Department;
  role?: Role;
  presence?: UserPresence;
}

export interface ConversationSummary {
  id: number;
  type: 'direct' | 'group';
  title: string;
  name?: string;
  description?: string;
  context_type?: string;
  context_id?: number;
  is_archived: boolean;
  last_message_at?: string;
  unread_count: number;
  last_message?: {
    id: number;
    body: string;
    sender: MessagingUser;
    created_at?: string;
  };
  members: Array<MessagingUser & { role?: string }>;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  body: string;
  is_edited: boolean;
  edited_at?: string;
  created_at?: string;
  status: 'delivered' | 'seen' | 'unread';
  sender: MessagingUser;
  reply_to?: { id: number; body: string; sender: MessagingUser };
  attachments: Array<{ id: number; file_name: string; mime_type: string; file_size: number }>;
  reactions: Array<{ reaction: string; user: MessagingUser }>;
  seen_by: MessagingUser[];
}

export interface AnnouncementItem {
  id: number;
  title: string;
  body: string;
  is_pinned: boolean;
  expires_at?: string;
  requires_acknowledgement: boolean;
  acknowledged: boolean;
  created_at?: string;
  creator?: { id: number; name: string };
}

export type FleetMotionStatus = 'moving' | 'idle' | 'parked' | 'offline';
export type FleetScheduleStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export interface FleetVehicle {
  id: number;
  plate_number: string;
  name: string;
  vehicle_type: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  capacity?: number;
  fuel_type?: string;
  gps_device_id?: string;
  gps_provider?: string;
  assigned_driver_id?: number;
  department_id?: number;
  status: string;
  gps_status: string;
  motion_status: FleetMotionStatus;
  last_latitude?: number | string | null;
  last_longitude?: number | string | null;
  last_speed?: number | string | null;
  last_heading?: number | string | null;
  engine_status?: string | null;
  last_gps_at?: string | null;
  last_address?: string | null;
  notes?: string;
  is_active?: boolean;
  cr_number?: string | null;
  or_number?: string | null;
  mv_file_number?: string | null;
  registration_expiry?: string | null;
  registration_status?: string | null;
  registration_issued_at?: string | null;
  engine_number?: string | null;
  chassis_number?: string | null;
  registration_classification?: string | null;
  registration_series?: string | null;
  registration_gross_weight?: number | string | null;
  registration_net_weight?: number | string | null;
  registration_piston_displacement?: string | null;
  registration_lto_office?: string | null;
  registration_owner_name?: string | null;
  registration_amount_paid?: number | string | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_coverage_type?: string | null;
  insurance_expiry?: string | null;
  insurance_status?: string | null;
  insurance_issued_at?: string | null;
  insurance_certificate_number?: string | null;
  insurance_sum_insured?: number | string | null;
  insurance_broker?: string | null;
  insurance_contact_person?: string | null;
  insurance_contact_phone?: string | null;
  insurance_remarks?: string | null;
  driver?: User;
  department?: Department;
  active_trip?: FleetSchedule | null;
}

export interface FleetSchedule {
  id: number;
  schedule_number: string;
  fleet_vehicle_id: number;
  driver_id?: number | null;
  department_id: number;
  requester_id: number;
  purpose: string;
  destination: string;
  departure_at: string;
  expected_return_at: string;
  actual_departure_at?: string | null;
  actual_return_at?: string | null;
  passengers: number;
  priority: string;
  status: FleetScheduleStatus;
  remarks?: string | null;
  rejection_reason?: string | null;
  conflict_override?: boolean;
  approved_at?: string | null;
  vehicle?: FleetVehicle;
  driver?: User;
  department?: Department;
  requester?: User;
  approver?: User;
  timeline?: FleetScheduleTimeline[];
}

export interface FleetBorrowerSlip {
  id: number;
  slip_number: string;
  borrower_name: string;
  department_id: number;
  contact_no?: string | null;
  purpose: string;
  destination: string;
  departure_at: string;
  expected_return_at: string;
  passengers: number;
  requested_vehicle_type?: string | null;
  driver_needed: boolean;
  preferred_driver_note?: string | null;
  remarks?: string | null;
  requester_id: number;
  fleet_schedule_id?: number | null;
  department?: Department;
  requester?: User;
  created_at?: string;
}

export interface FleetScheduleTimeline {
  id: number;
  event: string;
  description?: string;
  created_at?: string;
  user?: User;
}

export interface FleetDashboardStats {
  total_vehicles: number;
  active_trips: number;
  idle_vehicles: number;
  offline_gps: number;
  moving_vehicles: number;
  under_maintenance: number;
  upcoming_schedules: FleetSchedule[];
}

export interface TrackedDocumentAttachment {
  id: number;
  tracked_document_id: number;
  uploaded_by?: number | null;
  file_name: string;
  file_path: string;
  mime_type?: string | null;
  file_size: number;
  uploader?: Pick<User, 'id' | 'name'>;
  created_at?: string;
  updated_at?: string;
}

export interface TrackedDocumentTask {
  id: number;
  tracked_document_id: number;
  assigned_to?: string | null;
  body: string;
  received_by?: string | null;
  received_at?: string | null;
  created_by?: number | null;
  creator?: Pick<User, 'id' | 'name'>;
  created_at?: string;
  updated_at?: string;
}

export interface TrackedDocument {
  id: number;
  reference_no: string;
  document_no?: string | null;
  title: string;
  description?: string | null;
  direction: 'incoming' | 'outgoing' | 'routing' | 'internal' | string;
  document_type: string;
  file_type: string;
  file_path?: string | null;
  status: 'pending' | 'active' | 'completed' | 'archived' | string;
  is_confidential?: boolean;
  sender_name?: string | null;
  recipient_name?: string | null;
  instruction_for?: string | null;
  instruction_task?: string | null;
  responsible_user_id?: number | null;
  department_id?: number | null;
  responsible?: Pick<User, 'id' | 'name' | 'email'>;
  department?: Department;
  creator?: Pick<User, 'id' | 'name'>;
  tasks?: TrackedDocumentTask[];
  attachments?: TrackedDocumentAttachment[];
  received_at?: string | null;
  released_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}


