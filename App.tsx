
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Users, 
  Wallet, 
  Plus, 
  TrendingUp,
  Banknote,
  AlertCircle,
  FileSpreadsheet,
  Pencil,
  Trash2,
  X,
  RotateCw,
  CheckCircle2,
  Calendar,
  Database,
  Gavel,
  Pause,
  Play,
  ExternalLink,
  Lock,
  History,
  Archive,
  Receipt,
  ClipboardList,
  ArrowRightLeft,
  ShieldAlert,
  Eraser,
  ChevronDown,
  KeyRound,
  ChevronRight
} from 'lucide-react';
import { 
  Employee, 
  SalaryRecord, 
  AdvanceRecord, 
  PenaltyRecord,
  LoanRecord, 
  BankType, 
  AppData 
} from './types';
import { getFinancialSummary } from './geminiService';

const HARDCODED_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz9ehNO0b2MzUxNq7cIwUrS3N5vE1i1IvVBzd7CkfNNwHGu6RHzV_tHqj-YIjC1kAE5pg/exec"; 

const AUTO_SYNC_INTERVAL = 20000;
const SYNC_LOCK_DURATION = 10000;
const MASTER_PASSCODE = "dlyj";

const App: React.FC = () => {
  // --- Auth State ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // --- Data State ---
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('salary_app_data_v6');
    const initialData = saved ? JSON.parse(saved) : {
      employees: [],
      salaryRecords: [],
      advances: [],
      penalties: [],
      loans: [],
      lastUpdated: Date.now(),
      config: {
        googleSheetId: '',
        googleWebAppUrl: '',
        lastSync: null
      }
    };
    if (HARDCODED_WEB_APP_URL) initialData.config.googleWebAppUrl = HARDCODED_WEB_APP_URL;
    return initialData;
  });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [showSheetSettings, setShowSheetSettings] = useState(false);
  
  const lastLocalUpdateRef = useRef<number>(data.lastUpdated || Date.now());
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isProcessingSalary, setIsProcessingSalary] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryRecord | null>(null);
  const [isAddingAdvance, setIsAddingAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceRecord | null>(null);
  const [isAddingPenalty, setIsAddingPenalty] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<PenaltyRecord | null>(null);
  const [isAddingLoan, setIsAddingLoan] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    type: 'employee' | 'salary' | 'advance' | 'penalty' | 'loan' | 'purge';
    label: string;
  } | null>(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitialMount = useRef(true);

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === MASTER_PASSCODE) {
      setIsAuthorized(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setPasscodeInput("");
    }
  };

  const fetchRemoteData = useCallback(async (url: string, force: boolean = false) => {
    if (!url || !url.startsWith('http')) return;
    const timeSinceLastLocalChange = Date.now() - lastLocalUpdateRef.current;
    if (!force && timeSinceLastLocalChange < SYNC_LOCK_DURATION) return;
    setIsFetching(true);
    try {
      const response = await fetch(`${url}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const remoteState = await response.json();
      if (remoteState && typeof remoteState === 'object' && Array.isArray(remoteState.employees)) {
        const remoteTimestamp = remoteState.lastUpdated || 0;
        if (!force && remoteTimestamp < lastLocalUpdateRef.current) {
        } else {
          setData(prev => ({ 
            ...remoteState, 
            config: { 
              ...remoteState.config, 
              googleWebAppUrl: HARDCODED_WEB_APP_URL || prev.config.googleWebAppUrl, 
              lastSync: new Date().toLocaleTimeString() 
            } 
          }));
        }
      }
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const performPushSync = async (latestData: AppData) => {
    const url = HARDCODED_WEB_APP_URL || latestData.config.googleWebAppUrl;
    if (!url) return;
    setIsSyncing(true);
    try {
      await fetch(url, { 
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(latestData) 
      });
      setData(prev => ({ ...prev, config: { ...prev.config, lastSync: new Date().toLocaleTimeString() } }));
    } catch (err) {
      console.error("Push error", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    const url = HARDCODED_WEB_APP_URL || data.config.googleWebAppUrl;
    if (url && url.includes('exec')) {
      fetchRemoteData(url);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(() => { fetchRemoteData(url); }, AUTO_SYNC_INTERVAL);
    }
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [data.config.googleWebAppUrl, fetchRemoteData, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    localStorage.setItem('salary_app_data_v6', JSON.stringify(data));
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const url = HARDCODED_WEB_APP_URL || data.config.googleWebAppUrl;
    if (url && !isFetching) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => { performPushSync(data); }, 2000); 
    }
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [data.employees, data.salaryRecords, data.advances, data.penalties, data.loans, isFetching, isAuthorized]);

  const markLocalChange = () => {
    const now = Date.now();
    lastLocalUpdateRef.current = now;
    setData(prev => ({ ...prev, lastUpdated: now }));
  };

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(val);
  };

  const fetchAiInsight = async (employee: Employee) => {
    setAiInsight("Analyzing...");
    const insight = await getFinancialSummary(data, employee);
    setAiInsight(insight);
  };

  const saveEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); markLocalChange();
    const formData = new FormData(e.currentTarget);
    const payload = { 
      name: formData.get('name') as string, 
      role: formData.get('role') as string, 
      bankType: formData.get('bankType') as BankType, 
      baseSalary: Number(formData.get('baseSalary')) 
    };
    setData(prev => ({ 
      ...prev, 
      employees: editingEmployee 
        ? prev.employees.map(emp => emp.id === editingEmployee.id ? { ...emp, ...payload } : emp) 
        : [...prev.employees, { id: crypto.randomUUID(), ...payload, loanBalance: 0 }] 
    }));
    setIsAddingEmployee(false); setEditingEmployee(null);
  };

  const saveAdvance = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); markLocalChange();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const empId = formData.get('employeeId') as string;
    const date = (formData.get('date') as string) || getTodayStr();
    setData(prev => ({ 
      ...prev, 
      advances: editingAdvance 
        ? prev.advances.map(a => a.id === editingAdvance.id ? { ...a, amount, employeeId: empId, date } : a) 
        : [...prev.advances, { id: crypto.randomUUID(), employeeId: empId, date, amount, isDeducted: false }] 
    }));
    setIsAddingAdvance(false); setEditingAdvance(null);
  };

  const savePenalty = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); markLocalChange();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    const empId = formData.get('employeeId') as string;
    const date = (formData.get('date') as string) || getTodayStr();
    setData(prev => ({ 
      ...prev, 
      penalties: editingPenalty 
        ? prev.penalties.map(p => p.id === editingPenalty.id ? { ...p, amount, description, employeeId: empId, date } : p) 
        : [...prev.penalties, { id: crypto.randomUUID(), employeeId: empId, date, amount, description, isDeducted: false }] 
    }));
    setIsAddingPenalty(false); setEditingPenalty(null);
  };

  const saveLoan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); markLocalChange();
    const formData = new FormData(e.currentTarget);
    const totalAmount = Number(formData.get('amount'));
    const emi = Number(formData.get('emi'));
    const empId = formData.get('employeeId') as string;
    const date = (formData.get('date') as string) || getTodayStr();
    setData(prev => {
      let newEmployees = [...prev.employees];
      if (editingLoan) {
        const diff = totalAmount - editingLoan.totalAmount;
        newEmployees = newEmployees.map(emp => emp.id === empId ? { ...emp, loanBalance: emp.loanBalance + diff } : emp);
      } else {
        newEmployees = newEmployees.map(emp => emp.id === empId ? { ...emp, loanBalance: emp.loanBalance + totalAmount } : emp);
      }
      return { 
        ...prev, 
        loans: editingLoan 
          ? prev.loans.map(l => l.id === editingLoan.id ? { ...l, totalAmount, remainingAmount: totalAmount - (editingLoan.totalAmount - editingLoan.remainingAmount), emiAmount: emi, employeeId: empId, date } : l) 
          : [...prev.loans, { id: crypto.randomUUID(), employeeId: empId, date, totalAmount, remainingAmount: totalAmount, emiAmount: emi, isPaused: false }], 
        employees: newEmployees 
      };
    });
    setIsAddingLoan(false); setEditingLoan(null);
  };

  const saveSalary = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); markLocalChange();
    const formData = new FormData(e.currentTarget);
    const empId = formData.get('employeeId') as string;
    const date = (formData.get('date') as string) || getTodayStr();
    const emp = data.employees.find(e => e.id === empId);
    if (!emp) return;
    const bankCharges = Number(formData.get('bankCharges')) || 0;
    
    if (editingSalary) {
      setData(prev => ({ ...prev, salaryRecords: prev.salaryRecords.map(r => r.id === editingSalary.id ? { ...r, bankCharges, date, employeeId: empId } : r) }));
    } else {
      const payoutId = crypto.randomUUID();
      const pendingAdvances = data.advances.filter(a => a.employeeId === empId && !a.isDeducted);
      const pendingPenalties = data.penalties.filter(p => p.employeeId === empId && !p.isDeducted);
      const advancesTotal = pendingAdvances.reduce((sum, a) => sum + a.amount, 0);
      const penaltiesTotal = pendingPenalties.reduce((sum, p) => sum + p.amount, 0);
      const activeLoan = data.loans.find(l => l.employeeId === empId && l.remainingAmount > 0 && !l.isPaused);
      const emi = activeLoan ? Math.min(activeLoan.emiAmount, activeLoan.remainingAmount) : 0;
      const netSalary = emp.baseSalary - (advancesTotal + penaltiesTotal + emi);
      
      setData(prev => ({
        ...prev,
        salaryRecords: [...prev.salaryRecords, { id: payoutId, employeeId: empId, date, baseSalary: emp.baseSalary, advanceDeduction: advancesTotal, penaltyDeduction: penaltiesTotal, loanEmiDeduction: emi, bankCharges, netSalary }],
        advances: prev.advances.map(a => (a.employeeId === empId && !a.isDeducted) ? { ...a, isDeducted: true, payoutId } : a),
        penalties: prev.penalties.map(p => (p.employeeId === empId && !p.isDeducted) ? { ...p, isDeducted: true, payoutId } : p),
        loans: prev.loans.map(l => (l.employeeId === empId && l.remainingAmount > 0 && !l.isPaused) ? { ...l, remainingAmount: Math.max(0, l.remainingAmount - emi) } : l),
        employees: prev.employees.map(e => e.id === empId ? { ...e, loanBalance: Math.max(0, e.loanBalance - emi) } : e)
      }));
    }
    setIsProcessingSalary(false); setEditingSalary(null); setSelectedEmployeeId(null);
  };

  const handleConfirmAction = () => {
    if (!deleteConfirmation) return;
    markLocalChange();
    const { id, type } = deleteConfirmation;
    setData(prev => {
      const newData = { ...prev };
      switch (type) {
        case 'purge':
          newData.advances = prev.advances.filter(a => !a.isDeducted);
          newData.penalties = prev.penalties.filter(p => !p.isDeducted);
          newData.salaryRecords = []; 
          break;
        case 'employee': newData.employees = prev.employees.filter(e => e.id !== id); break;
        case 'advance': newData.advances = prev.advances.filter(a => a.id !== id); break;
        case 'penalty': newData.penalties = prev.penalties.filter(p => p.id !== id); break;
        case 'loan':
          const loan = prev.loans.find(l => l.id === id);
          if (loan) {
            newData.loans = prev.loans.filter(l => l.id !== id);
            newData.employees = prev.employees.map(e => e.id === loan.employeeId ? { ...e, loanBalance: Math.max(0, e.loanBalance - loan.remainingAmount) } : e);
          }
          break;
        case 'salary': newData.salaryRecords = prev.salaryRecords.filter(r => r.id !== id); break;
      }
      return newData;
    });
    setDeleteConfirmation(null);
  };

  const getEmployeeName = (id: string) => data.employees.find(e => e.id === id)?.name || "Unknown";
  const toggleLoanPause = (id: string) => {
    markLocalChange();
    setData(prev => ({ ...prev, loans: prev.loans.map(l => l.id === id ? { ...l, isPaused: !l.isPaused } : l) }));
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Auth Render ---
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl text-center animate-in zoom-in duration-500">
           <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <KeyRound className="w-10 h-10 text-slate-900" />
           </div>
           <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Access Locked</h1>
           <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-10">Enter Administrative Passcode</p>
           <form onSubmit={handleAuth} className="space-y-6">
              <input 
                type="password" 
                autoFocus
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Passcode"
                className={`w-full p-5 text-center bg-slate-50 border-2 rounded-2xl text-xl font-black transition-all outline-none ${authError ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-100 focus:border-slate-900'}`}
              />
              {authError && <p className="text-rose-500 font-black text-[10px] uppercase">Incorrect Passcode</p>}
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all">
                Authenticate <ChevronRight className="w-4 h-4" />
              </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="sticky top-0 z-50 w-full bg-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <FileSpreadsheet className="text-emerald-400 w-6 h-6" />
            <h1 className="text-lg font-black tracking-tight uppercase">Ledger Pro</h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowSheetSettings(true)} className="p-2.5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                {isFetching || isSyncing ? <RotateCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
             </button>
          </div>
        </div>
        <div className="bg-slate-800 border-t border-white/5 py-2 overflow-x-auto">
          <div className="flex justify-center gap-4 px-4 min-w-max mx-auto text-[9px] font-black uppercase tracking-widest text-slate-400">
            <button onClick={() => scrollTo('directory')} className="hover:text-white">Staff</button>
            <button onClick={() => scrollTo('payouts')} className="hover:text-white">Payouts</button>
            <button onClick={() => scrollTo('advances')} className="hover:text-white">Advances</button>
            <button onClick={() => scrollTo('penalties')} className="hover:text-white">Penalties</button>
            <button onClick={() => scrollTo('loans')} className="hover:text-white">Loans</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-10 space-y-16">
        
        {/* GLOBAL MONTH PICKER */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <Calendar className="w-8 h-8 text-slate-300" />
              <div><h2 className="text-sm font-black uppercase text-slate-400 tracking-widest">Selected Period</h2><p className="text-xl font-black text-slate-900 uppercase">{new Date(selectedMonth + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })}</p></div>
           </div>
           <input type="month" className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black shadow-inner outline-none focus:ring-2 focus:ring-slate-900" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
        </section>

        <section id="directory" className="animate-in fade-in duration-700">
          <div className="flex justify-between items-end mb-6 px-2">
            <div><h2 className="text-2xl font-black">Staff Profiles</h2><p className="text-slate-400 text-xs font-medium">Core directory.</p></div>
            <button onClick={() => { setEditingEmployee(null); setIsAddingEmployee(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95"><Plus className="w-4 h-4" /> Add Profile</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.employees.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 border border-slate-200">{emp.name.charAt(0)}</div>
                    <div><h3 className="font-black text-slate-900">{emp.name}</h3><p className="text-slate-400 text-[9px] font-black uppercase">{emp.role}</p></div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingEmployee(emp); setIsAddingEmployee(true); }} className="p-2 text-slate-300 hover:text-slate-900"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirmation({ id: emp.id, type: 'employee', label: emp.name })} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] border-t border-slate-50 pt-4 mb-6">
                  <div><span className="block text-slate-400 font-black uppercase">Salary</span><span className="font-black text-slate-900">{formatINR(emp.baseSalary)}</span></div>
                  <div className="text-right"><span className="block text-slate-400 font-black uppercase">Debt</span><span className={emp.loanBalance > 0 ? "text-rose-600 font-black" : "text-emerald-600 font-black"}>{formatINR(emp.loanBalance)}</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedEmployeeId(emp.id); setIsProcessingSalary(true); }} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-black">Process Payout</button>
                  <button onClick={() => fetchAiInsight(emp)} className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-200 text-slate-400 transition-all"><TrendingUp className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="payouts" className="animate-in fade-in duration-700 delay-100">
          <div className="flex justify-between items-end mb-6 px-2">
            <div><h2 className="text-2xl font-black">Transfer Records</h2><p className="text-slate-400 text-xs font-medium">Payout history for {selectedMonth}.</p></div>
          </div>
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase border-b">
                <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Employee</th><th className="px-8 py-5">Deductions</th><th className="px-8 py-5">Net Paid</th><th className="px-8 py-5 text-center">Audit</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.salaryRecords.filter(r => r.date.startsWith(selectedMonth)).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-8 py-5 font-bold text-slate-400">{r.date}</td>
                    <td className="px-8 py-5 font-black text-slate-800">{getEmployeeName(r.employeeId)}</td>
                    <td className="px-8 py-5 text-rose-500 font-black">-{formatINR(r.advanceDeduction + r.penaltyDeduction + r.loanEmiDeduction)}</td>
                    <td className="px-8 py-5 font-black text-emerald-600">{formatINR(r.netSalary)}</td>
                    <td className="px-8 py-5 text-center"><div className="flex justify-center gap-1"><button onClick={() => { setEditingSalary(r); setSelectedEmployeeId(r.employeeId); setIsProcessingSalary(true); }} className="p-2 text-slate-300 hover:text-slate-900"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => setDeleteConfirmation({ id: r.id, type: 'salary', label: 'Payout' })} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                  </tr>
                ))}
                {data.salaryRecords.filter(r => r.date.startsWith(selectedMonth)).length === 0 && (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No payouts logged for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="advances" className="animate-in fade-in duration-700">
           <div className="flex justify-between items-end mb-6 px-2">
             <div><h2 className="text-2xl font-black">Advances</h2><p className="text-slate-400 text-xs font-medium">Monthly cash flow.</p></div>
             <button onClick={() => { setEditingAdvance(null); setIsAddingAdvance(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">New Advance</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.advances.filter(a => a.date.startsWith(selectedMonth)).map(a => (
                <div key={a.id} className={`p-5 bg-white rounded-2xl border flex justify-between items-center shadow-sm transition-all ${a.isDeducted ? 'border-slate-100 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-emerald-200'}`}>
                  <div>
                    <p className="font-black text-sm text-slate-900">{getEmployeeName(a.employeeId)}</p>
                    <div className="flex items-center gap-2">
                       <p className="text-[9px] text-slate-400 uppercase font-black">{a.date}</p>
                       <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${a.isDeducted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{a.isDeducted ? 'Settled' : 'Pending'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-rose-600 text-sm">{formatINR(a.amount)}</span>
                    {!a.isDeducted && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingAdvance(a); setIsAddingAdvance(true); }} className="p-2 text-slate-200 hover:text-slate-900"><Pencil className="w-4 h-4"/></button>
                        <button onClick={() => setDeleteConfirmation({ id: a.id, type: 'advance', label: 'Advance' })}><Trash2 className="w-4 h-4 text-slate-200 hover:text-rose-600"/></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {data.advances.filter(a => a.date.startsWith(selectedMonth)).length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-300 font-black uppercase text-[9px] tracking-[0.3em] border-2 border-dashed border-slate-200 rounded-3xl">No records this month.</div>
              )}
           </div>
        </section>

        <section id="penalties" className="animate-in fade-in duration-700">
           <div className="flex justify-between items-end mb-6 px-2">
             <div><h2 className="text-2xl font-black">Penalties</h2><p className="text-slate-400 text-xs font-medium">Fine logs.</p></div>
             <button onClick={() => { setEditingPenalty(null); setIsAddingPenalty(true); }} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">Record Fine</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.penalties.filter(p => p.date.startsWith(selectedMonth)).map(p => (
                <div key={p.id} className={`p-5 bg-white rounded-2xl border shadow-sm space-y-3 transition-all ${p.isDeducted ? 'border-slate-100 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-rose-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-sm text-slate-900">{getEmployeeName(p.employeeId)}</p>
                      <div className="flex items-center gap-2">
                         <p className="text-[9px] text-slate-400 uppercase font-black">{p.date}</p>
                         <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${p.isDeducted ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{p.isDeducted ? 'Settled' : 'Pending'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-rose-600 text-sm">{formatINR(p.amount)}</span>
                      {!p.isDeducted && (
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingPenalty(p); setIsAddingPenalty(true); }} className="p-1.5 text-slate-200 hover:text-slate-900"><Pencil className="w-3.5 h-3.5"/></button>
                          <button onClick={() => setDeleteConfirmation({ id: p.id, type: 'penalty', label: 'Penalty' })}><Trash2 className="w-3.5 h-3.5 text-slate-200 hover:text-rose-600"/></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 italic bg-slate-50 p-2 rounded-lg truncate">{p.description}</p>
                </div>
              ))}
              {data.penalties.filter(p => p.date.startsWith(selectedMonth)).length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-300 font-black uppercase text-[9px] tracking-[0.3em] border-2 border-dashed border-slate-200 rounded-3xl">No records this month.</div>
              )}
           </div>
        </section>

        <section id="loans" className="animate-in fade-in duration-700">
           <div className="flex justify-between items-end mb-6 px-2">
             <div><h2 className="text-2xl font-black">EMI Repayments</h2><p className="text-slate-400 text-xs font-medium">Loans issued/active in {selectedMonth}.</p></div>
             <button onClick={() => { setEditingLoan(null); setIsAddingLoan(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">New EMI</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.loans.filter(l => l.date.startsWith(selectedMonth)).map(l => (
                <div key={l.id} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start">
                    <div><p className="font-black text-sm text-slate-900">{getEmployeeName(l.employeeId)}</p><p className="text-[9px] text-slate-400 uppercase font-black">Issued: {l.date}</p></div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleLoanPause(l.id)}>{l.isPaused ? <Play className="w-3.5 h-3.5 text-emerald-500"/> : <Pause className="w-3.5 h-3.5 text-amber-500" />}</button>
                      <button onClick={() => { setEditingLoan(l); setIsAddingLoan(true); }} className="p-1.5 text-slate-200 hover:text-slate-900"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => setDeleteConfirmation({ id: l.id, type: 'loan', label: 'EMI Loan' })}><Trash2 className="w-3.5 h-3.5 text-slate-200 hover:text-rose-600"/></button>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase"><span className="text-slate-400">Monthly EMI</span><span className="text-indigo-600">{formatINR(l.emiAmount)}</span></div>
                  <div className="space-y-1.5">
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-600" style={{ width: `${((l.totalAmount - l.remainingAmount) / l.totalAmount) * 100}%` }}></div></div>
                    <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase"><span>Rem: {formatINR(l.remainingAmount)}</span><span>{Math.round(((l.totalAmount - l.remainingAmount) / l.totalAmount) * 100)}% Paid</span></div>
                  </div>
                </div>
              ))}
              {data.loans.filter(l => l.date.startsWith(selectedMonth)).length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-300 font-black uppercase text-[9px] tracking-[0.3em] border-2 border-dashed border-slate-200 rounded-3xl">No new loans issued this period.</div>
              )}
           </div>
        </section>
      </main>

      {/* SETTINGS MODAL */}
      {showSheetSettings && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-xl w-full p-10 shadow-2xl border border-slate-200">
             <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-black uppercase">Settings</h2><button onClick={() => setShowSheetSettings(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400"/></button></div>
             <div className="space-y-8">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">Endpoint URL {HARDCODED_WEB_APP_URL && <Lock className="w-3 h-3" />}</label>
                    <input type="text" className={`w-full p-4 border rounded-xl text-xs font-mono bg-slate-50 text-slate-400`} value={HARDCODED_WEB_APP_URL || data.config.googleWebAppUrl} disabled={true} />
                </div>
                <div className="flex gap-4">
                    <button onClick={() => performPushSync(data)} className="flex-1 py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all">Cloud Save</button>
                    <button onClick={() => fetchRemoteData(HARDCODED_WEB_APP_URL || data.config.googleWebAppUrl, true)} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-emerald-700 transition-all">Cloud Pull</button>
                </div>
                <div className="p-8 bg-rose-50 rounded-3xl border border-rose-200 space-y-4">
                    <h4 className="font-black uppercase tracking-widest text-[10px] text-rose-800">Clear Records</h4>
                    <p className="text-[9px] text-rose-700 font-bold uppercase">This wipes settled data to start fresh.</p>
                    <button onClick={() => setDeleteConfirmation({ id: 'purge', type: 'purge', label: 'ALL SETTLED DATA' })} className="w-full py-4 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Eraser className="w-4 h-4" /> Reset Ledger</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* DYNAMIC FORMS */}
      {(isAddingAdvance || isAddingPenalty || isAddingLoan || isAddingEmployee || isProcessingSalary) && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {isProcessingSalary && (
                <form onSubmit={saveSalary} className="space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-black">{editingSalary ? 'Update Payout' : 'Issue Payout'}</h3><button type="button" onClick={() => setIsProcessingSalary(false)}><X className="w-5 h-5"/></button></div>
                    <select name="employeeId" required className="w-full p-3 bg-slate-50 border rounded-xl" value={selectedEmployeeId || ""} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                        <option value="" disabled>Select Staff</option>
                        {data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" name="date" defaultValue={editingSalary?.date || getTodayStr()} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                        <input type="number" step="0.01" name="bankCharges" placeholder="Fees" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingSalary?.bankCharges || 0} />
                    </div>
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Finalize Payout</button>
                </form>
            )}

            {isAddingPenalty && (
                <form onSubmit={savePenalty} className="space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-black">{editingPenalty ? 'Edit Fine' : 'Record Fine'}</h3><button type="button" onClick={() => setIsAddingPenalty(false)}><X className="w-5 h-5"/></button></div>
                    <select name="employeeId" required className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingPenalty?.employeeId}>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" name="date" defaultValue={editingPenalty?.date || getTodayStr()} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                        <input type="number" step="0.01" name="amount" placeholder="Amount" required className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingPenalty?.amount} />
                    </div>
                    <textarea name="description" required className="w-full p-3 bg-slate-50 border rounded-xl h-24" placeholder="Reason..." defaultValue={editingPenalty?.description}></textarea>
                    <button type="submit" className="w-full py-4 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase">Save Record</button>
                </form>
            )}

            {isAddingAdvance && (
                <form onSubmit={saveAdvance} className="space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-black">{editingAdvance ? 'Edit Advance' : 'New Advance'}</h3><button type="button" onClick={() => setIsAddingAdvance(false)}><X className="w-5 h-5"/></button></div>
                    <select name="employeeId" required className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingAdvance?.employeeId}>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" name="date" defaultValue={editingAdvance?.date || getTodayStr()} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                        <input type="number" step="0.01" name="amount" placeholder="Amount" required className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingAdvance?.amount} />
                    </div>
                    <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase">Save Advance</button>
                </form>
            )}

            {isAddingLoan && (
                <form onSubmit={saveLoan} className="space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-black">{editingLoan ? 'Modify EMI' : 'New EMI Setup'}</h3><button type="button" onClick={() => setIsAddingLoan(false)}><X className="w-5 h-5"/></button></div>
                    <select name="employeeId" required className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingLoan?.employeeId}>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" name="amount" required placeholder="Total" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingLoan?.totalAmount} />
                        <input type="number" name="emi" required placeholder="Monthly EMI" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingLoan?.emiAmount} />
                    </div>
                    <input type="date" name="date" defaultValue={editingLoan?.date || getTodayStr()} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                    <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">Save Loan</button>
                </form>
            )}

            {isAddingEmployee && (
                <form onSubmit={saveEmployee} className="space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-black">{editingEmployee ? 'Edit Staff' : 'Add Staff'}</h3><button type="button" onClick={() => setIsAddingEmployee(false)}><X className="w-5 h-5"/></button></div>
                    <input name="name" required placeholder="Name" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingEmployee?.name} />
                    <input name="role" required placeholder="Role" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingEmployee?.role} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" name="baseSalary" required placeholder="Salary" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingEmployee?.baseSalary} />
                        <select name="bankType" className="w-full p-3 bg-slate-50 border rounded-xl" defaultValue={editingEmployee?.bankType}><option value={BankType.SAME}>Local</option><option value={BankType.DIFFERENT}>Other</option></select>
                    </div>
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Save Staff</button>
                </form>
            )}
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[300] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-10 text-center border border-slate-200 shadow-2xl">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${deleteConfirmation.type === 'purge' ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'}`}>{deleteConfirmation.type === 'purge' ? <ShieldAlert /> : <Trash2 />}</div>
            <h2 className="text-xl font-black mb-2">Delete Record?</h2>
            <p className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-widest leading-relaxed">{deleteConfirmation.label}</p>
            <div className="flex gap-4"><button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black text-[10px] uppercase transition-all">Cancel</button><button onClick={handleConfirmAction} className={`flex-1 py-4 text-white rounded-xl font-black text-[10px] uppercase transition-all ${deleteConfirmation.type === 'purge' ? 'bg-amber-600' : 'bg-rose-600'}`}>Delete</button></div>
          </div>
        </div>
      )}

      {aiInsight && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-[2rem] max-w-xl w-full p-8 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black uppercase">Audit Insight</h2><button onClick={() => setAiInsight(null)}><X className="w-6 h-6 text-slate-400"/></button></div>
            <div className="p-6 bg-slate-50 rounded-xl text-xs leading-relaxed text-slate-600 whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{aiInsight}</div>
            <button onClick={() => setAiInsight(null)} className="w-full mt-6 bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
