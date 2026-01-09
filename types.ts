
export enum BankType {
  SAME = 'SAME',
  DIFFERENT = 'DIFFERENT'
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  bankType: BankType;
  baseSalary: number;
  loanBalance: number;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  date: string;
  baseSalary: number;
  advanceDeduction: number;
  loanEmiDeduction: number;
  penaltyDeduction: number;
  bankCharges: number;
  netSalary: number;
  notes?: string;
}

export interface AdvanceRecord {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  isDeducted: boolean;
  payoutId?: string;
}

export interface PenaltyRecord {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  description: string;
  isDeducted: boolean;
  payoutId?: string;
}

export interface LoanRecord {
  id: string;
  employeeId: string;
  date: string;
  totalAmount: number;
  remainingAmount: number;
  emiAmount: number;
  isPaused: boolean;
}

export interface AppConfig {
  googleSheetId: string;
  googleWebAppUrl: string;
  lastSync: string | null;
}

export interface AppData {
  employees: Employee[];
  salaryRecords: SalaryRecord[];
  advances: AdvanceRecord[];
  penalties: PenaltyRecord[];
  loans: LoanRecord[];
  config: AppConfig;
  lastUpdated: number; // Timestamp for conflict resolution
}
