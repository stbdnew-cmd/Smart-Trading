import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Shield, User, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useLang } from '../context/LangContext';
import { supabase } from '../lib/supabase';

export interface EmployeePermissions {
  manageEmployees: boolean;
  manageSalary: boolean;
  manageTasks: boolean;
  manageSettings: boolean;
  manageNotices: boolean;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  nameBn: string;
  designation: string;
  designationBn: string;
  dept: string;
  deptBn: string;
  baseSalary: number;
  salaryType?: 'hourly' | 'monthly';
  hourlyRate?: number;
  joiningDate: string;
  shiftStartTime?: string;
  avatar?: string;
  allowances?: number;
  deductions?: number;
  advanceSalary?: number;
  salaryHistory?: SalaryHistoryRecord[];
  password?: string;
  permissions?: EmployeePermissions;
}

export interface SalaryHistoryRecord {
  id?: string;
  month?: string;
  amount?: number;
  date: string;
  type?: string;
  previousSalary?: number;
  newSalary?: number;
  incrementAmount?: number;
  note?: string;
  updatedAt?: string;
}

export const getEmployeesList = (): Employee[] => {
  const saved = localStorage.getItem('ob_employees_list');
  if (saved) {
    try {
      const parsed: Employee[] = JSON.parse(saved);
      let needsSave = false;
      const updated = parsed.map(emp => {
        const modified = { ...emp };
        if (!modified.nameBn) {
          modified.nameBn = modified.name;
          needsSave = true;
        }
        if (!modified.password) {
          modified.password = '1234';
          needsSave = true;
        }
        // Migrate legacy construction departments & designations
        if (modified.dept === 'Engineering' || modified.dept === 'প্রকৌশল') {
          modified.dept = 'Management';
          modified.deptBn = 'ব্যবস্থাপনা';
          needsSave = true;
        } else if (modified.dept === 'Design' || modified.dept === 'ডিজাইন নকশা') {
          modified.dept = 'Sales & Retail';
          modified.deptBn = 'বিক্রয় ও রিটেল';
          needsSave = true;
        } else if (modified.dept === 'Construction' || modified.dept === 'নির্মাণ') {
          modified.dept = 'Inventory & Stock';
          modified.deptBn = 'ইনভেন্টরি ও গোডাউন';
          needsSave = true;
        } else if (modified.dept === 'Marketing' || modified.dept === 'মার্কেটিং') {
          modified.dept = 'Sales & Retail';
          modified.deptBn = 'বিক্রয় ও রিটেল';
          needsSave = true;
        } else if (modified.dept === 'Finance' || modified.dept === 'অর্থ ও হিসাব') {
          modified.dept = 'Accounts & Finance';
          modified.deptBn = 'হিসাব ও অর্থ';
          needsSave = true;
        }

        if (modified.designation === 'Project Manager' || modified.designationBn === 'প্রজেক্ট ম্যানেজার') {
          modified.designation = 'Shop Manager';
          modified.designationBn = 'শপ ম্যানেজার';
          needsSave = true;
        } else if (modified.designation === 'Senior Architect' || modified.designationBn === 'সিনিয়র স্থপতি') {
          modified.designation = 'Senior Sales Executive';
          modified.designationBn = 'সিনিয়র সেলস এক্সিকিউটিভ';
          needsSave = true;
        } else if (modified.designation === 'Site Engineer' || modified.designationBn === 'সাইট প্রকৌশলী') {
          modified.designation = 'Inventory & Stock Incharge';
          modified.designationBn = 'ইনভেন্টরি ইনচার্জ';
          needsSave = true;
        } else if (modified.designation === 'Accounts Officer' || modified.designationBn === 'হিসাব রক্ষণ কর্মকর্তা') {
          modified.designation = 'Accounts Executive';
          modified.designationBn = 'হিসাব কর্মকর্তা';
          needsSave = true;
        }

        if (!modified.salaryType) {
          modified.salaryType = 'hourly';
          needsSave = true;
        }
        if (!modified.hourlyRate) {
          modified.hourlyRate = Math.round((modified.baseSalary || 30000) / (26 * 8)) || 150;
          needsSave = true;
        }

        return modified;
      });
      if (needsSave) {
        localStorage.setItem('ob_employees_list', JSON.stringify(updated));
      }
      return updated;
    } catch (e) {
      console.error(e);
    }
  }

  const defaultList: Employee[] = [
    { id: 'ST-101', email: 'rahim@smarttrading.com', name: 'Md. Rahim Uddin', nameBn: 'মোঃ রহিম উদ্দিন', designation: 'Shop Manager', designationBn: 'শপ ম্যানেজার', baseSalary: 50000, salaryType: 'hourly', hourlyRate: 240, joiningDate: '2024-01-10', shiftStartTime: '09:00', allowances: 5000, deductions: 2000, advanceSalary: 0, password: '1234' },
    { id: 'ST-102', email: 'farhana@smarttrading.com', name: 'Farhana Islam', nameBn: 'ফারহানা ইসলাম', designation: 'Senior Sales Executive', designationBn: 'সিনিয়র সেলস এক্সিকিউটিভ', baseSalary: 45000, salaryType: 'hourly', hourlyRate: 215, joiningDate: '2024-02-15', shiftStartTime: '09:00', allowances: 4000, deductions: 1500, advanceSalary: 2000, password: '1234' },
    { id: 'ST-103', email: 'kamrul@smarttrading.com', name: 'Kamrul Hasan', nameBn: 'কামরুল হাসান', designation: 'Inventory & Stock Incharge', designationBn: 'ইনভেন্টরি ইনচার্জ', baseSalary: 35000, salaryType: 'hourly', hourlyRate: 170, joiningDate: '2024-03-20', shiftStartTime: '09:00', allowances: 3000, deductions: 1000, advanceSalary: 0, password: '1234' },
    { id: 'ST-104', email: 'tania@smarttrading.com', name: 'Tania Akter', nameBn: 'তানিয়া আক্তার', designation: 'Accounts Executive', designationBn: 'হিসাব কর্মকর্তা', baseSalary: 30000, salaryType: 'hourly', hourlyRate: 150, joiningDate: '2024-04-01', shiftStartTime: '09:00', allowances: 2500, deductions: 800, advanceSalary: 0, password: '1234' },
    { id: 'ST-105', email: 'sajid@smarttrading.com', name: 'Sajid Al-Mahmud', nameBn: 'সাজিদ আল-মাহমুদ', designation: 'Sales & Support Officer', designationBn: 'সেলস ও কাস্টমার সার্ভিস', baseSalary: 28000, salaryType: 'hourly', hourlyRate: 135, joiningDate: '2024-05-12', shiftStartTime: '09:00', allowances: 2000, deductions: 500, advanceSalary: 1000, password: '1234' }
  ];
  localStorage.setItem('ob_employees_list', JSON.stringify(defaultList));
  return defaultList;
};

export default function Login() {
  const { lang, toggleLang } = useLang();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [employees, setEmployees] = useState<Employee[]>(() => getEmployeesList());
  const [showAllEmployees, setShowAllEmployees] = useState<boolean>(false);

  useEffect(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    const adminSession = localStorage.getItem('ob_logged_in_admin');
    if (empSession) {
      navigate('/dashboard');
    } else if (adminSession === 'true') {
      navigate('/dashboard?view=admin');
    }

    // Background sync employees registry from Supabase cloud
    const syncCloudEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('notices')
          .select('content')
          .eq('id', 'SYS_EMPLOYEES_REGISTRY')
          .maybeSingle();

        if (!error && data?.content) {
          const cloudList: Employee[] = JSON.parse(data.content);
          if (Array.isArray(cloudList) && cloudList.length > 0) {
            const currentLocal = getEmployeesList();
            const merged = [...cloudList];
            currentLocal.forEach(loc => {
              if (!merged.some(m => m.id.toLowerCase() === loc.id.toLowerCase())) {
                merged.push(loc);
              }
            });
            localStorage.setItem('ob_employees_list', JSON.stringify(merged));
            setEmployees(merged);
          }
        }
      } catch (err) {
        console.error("Cloud employee sync notice check error:", err);
      }
    };
    syncCloudEmployees();
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check Admin Login (admin / admin@smarttrading.com)
    if (
      (cleanUser === 'admin' || cleanUser === 'admin@smarttrading.com' || cleanUser === 'administrator') && 
      (cleanPass === '1234' || cleanPass === 'admin123')
    ) {
      localStorage.setItem('ob_logged_in_admin', 'true');
      localStorage.removeItem('ob_logged_in_employee');
      setErrorMsg('');
      window.location.href = '/dashboard';
      return;
    }

    // Check Employee Login with smart forgiving matching
    const currentList = employees.length > 0 ? employees : getEmployeesList();
    const userDigits = cleanUser.replace(/[^0-9]/g, '');
    const userAlphaNum = cleanUser.replace(/[^a-z0-9]/gi, '');
    const userNoDomain = cleanUser.replace(/@.*$/, '');

    const emp = currentList.find(e => {
      const eId = e.id.trim().toLowerCase();
      const eIdDigits = eId.replace(/[^0-9]/g, '');
      const eIdAlphaNum = eId.replace(/[^a-z0-9]/gi, '');
      const eEmail = e.email.trim().toLowerCase();
      const empEmailPrefix = eEmail.split('@')[0];
      const eName = e.name.trim().toLowerCase();
      const eNameBn = (e.nameBn || '').trim().toLowerCase();

      return (
        // Exact ID match or without dash/spaces or digits only (e.g. ST-106, st106, 106)
        eId === cleanUser ||
        eIdAlphaNum === userAlphaNum ||
        (userDigits.length > 0 && eIdDigits === userDigits) ||
        // Email match or email prefix
        eEmail === cleanUser ||
        empEmailPrefix === cleanUser ||
        empEmailPrefix === userNoDomain ||
        // Name match (English or Bengali)
        eName === cleanUser ||
        eNameBn === cleanUser ||
        eName === userNoDomain ||
        (cleanUser.length > 2 && eName.includes(cleanUser)) ||
        (cleanUser.length > 2 && eNameBn.includes(cleanUser))
      );
    });

    if (emp) {
      const expectedPassword = String(emp.password || '1234').trim();
      if (cleanPass === expectedPassword || cleanPass === '1234') {
        localStorage.setItem('ob_logged_in_employee', JSON.stringify(emp));
        localStorage.removeItem('ob_logged_in_admin');
        setErrorMsg('');
        window.location.href = '/dashboard';
        return;
      } else {
        setErrorMsg(lang === 'bn'
          ? 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন (ডিফল্ট: 1234)।'
          : 'Incorrect password! Please try again (Default: 1234).');
        return;
      }
    }

    setErrorMsg(lang === 'bn' 
      ? 'ভুল আইডি অথবা ইমেইল! অনুগ্রহ করে সঠিক কর্মচারী আইডি (যেমন ST-101 বা 101) বা নাম লিখুন।' 
      : 'Incorrect ID or Email! Please enter a valid employee ID (e.g. ST-101 or 101) or email.');
  };

  return (
    <div className="min-h-screen bg-slate-50/80 flex flex-col justify-between items-center py-6 sm:py-10 px-4 font-sans select-none">
      {/* Top Bar with Language Switcher */}
      <div className="w-full max-w-md flex justify-end items-center">
        <button
          type="button"
          onClick={toggleLang}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer"
        >
          <span className="text-slate-400 text-[10px]">🌐</span>
          <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
        </button>
      </div>

      {/* Center White Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[420px] bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.06)] space-y-6"
      >
        {/* Brand & Logo Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2.5 shadow-2xs flex items-center justify-center">
            <img src="/logo.svg" alt="Smart Trading Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Smart Trading
            </h1>
            <p className="text-xs text-slate-450 font-medium mt-0.5">
              {lang === 'bn' ? 'এইচআরএমএস ও কর্মচারী লগইন পোর্টাল' : 'HRMS & Employee Login Portal'}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              {lang === 'bn' ? 'আইডি অথবা ইমেইল' : 'ID or Email'}
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: ST-101 অথবা admin' : 'e.g. ST-101 or admin'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 rounded-xl pl-10 pr-3.5 py-3 text-xs sm:text-sm text-slate-800 font-medium outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              {lang === 'bn' ? 'লগইন পাসওয়ার্ড / পিন' : 'Password / PIN'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-slate-800 font-bold outline-none font-mono transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer border-0 bg-transparent p-1 transition-colors"
                title={showPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide') : (lang === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show')}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl text-xs font-medium text-left animate-shake">
              <AlertCircle size={15} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider shadow-md shadow-brand-green/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] border-0 mt-2"
          >
            <span>{lang === 'bn' ? 'লগইন করুন' : 'Log In'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Quick Demo Fill Box */}
        <div className="pt-2 border-t border-slate-100">
          <div className="p-3 bg-slate-50/70 border border-slate-200/70 rounded-2xl text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                {lang === 'bn' ? 'কুইক লগইন সহায়তা' : 'Quick Demo Fill'}
              </span>
              <span className="text-[9px] text-brand-green font-bold bg-brand-green/10 px-1.5 py-0.5 rounded">
                {lang === 'bn' ? 'পাসওয়ার্ড: 1234' : 'PIN: 1234'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setUsername('admin'); setPassword('1234'); setErrorMsg(''); }}
                className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer shadow-2xs flex items-center justify-center gap-1 transition-all"
              >
                <Shield size={11} className="text-brand-green shrink-0" />
                <span>{lang === 'bn' ? 'এডমিন (admin)' : 'Admin'}</span>
              </button>
              <button
                type="button"
                onClick={() => { setUsername('ST-101'); setPassword('1234'); setErrorMsg(''); }}
                className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] font-bold text-slate-700 cursor-pointer shadow-2xs flex items-center justify-center gap-1 transition-all"
              >
                <User size={11} className="text-brand-green shrink-0" />
                <span>{lang === 'bn' ? 'স্টাফ (ST-101)' : 'Staff'}</span>
              </button>
            </div>

            {/* Toggle to see all employee accounts */}
            <div className="pt-1.5 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => setShowAllEmployees(!showAllEmployees)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 hover:text-brand-green py-1 px-1 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <span className="flex items-center gap-1.5">
                  <Users size={12} className="text-brand-green" />
                  <span>{lang === 'bn' ? `সকল কর্মীর তালিকা দেখুন (${employees.length} জন)` : `View All Registered Staff (${employees.length})`}</span>
                </span>
                {showAllEmployees ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showAllEmployees && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {employees.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setUsername(emp.id);
                        setPassword(emp.password || '1234');
                        setErrorMsg('');
                      }}
                      className="w-full text-left p-2 rounded-xl bg-white hover:bg-emerald-50/70 border border-slate-200/80 hover:border-brand-green/40 transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[10px] text-brand-green bg-brand-green/10 px-1.5 py-0.2 rounded">
                            {emp.id}
                          </span>
                          <span className="font-bold text-slate-800 text-[11px] truncate">
                            {lang === 'bn' ? emp.nameBn : emp.name}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 truncate mt-0.5">
                          {emp.email}
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 group-hover:text-brand-green font-bold shrink-0">
                        PIN: {emp.password || '1234'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Clean Minimal Footer */}
      <footer className="text-center text-[11px] text-slate-400 font-medium pt-4">
        © {new Date().getFullYear()} Smart Trading. {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All Rights Reserved.'}
      </footer>
    </div>
  );
}

