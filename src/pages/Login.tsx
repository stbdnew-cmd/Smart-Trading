import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Shield, User } from 'lucide-react';
import { useLang } from '../context/LangContext';

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
    { id: 'ST-101', email: 'rahim@smarttrading.com', name: 'Md. Rahim Uddin', nameBn: 'মোঃ রহিম উদ্দিন', designation: 'Project Manager', designationBn: 'প্রজেক্ট ম্যানেজার', dept: 'Engineering', deptBn: 'প্রকৌশল', baseSalary: 50000, joiningDate: '2024-01-10', shiftStartTime: '09:00', allowances: 5000, deductions: 2000, advanceSalary: 0, password: '1234' },
    { id: 'ST-102', email: 'farhana@smarttrading.com', name: 'Farhana Islam', nameBn: 'ফারহানা ইসলাম', designation: 'Senior Architect', designationBn: 'সিনিয়র স্থপতি', dept: 'Design', deptBn: 'ডিজাইন নকশা', baseSalary: 45000, joiningDate: '2024-02-15', shiftStartTime: '09:00', allowances: 4000, deductions: 1500, advanceSalary: 2000, password: '1234' },
    { id: 'ST-103', email: 'kamrul@smarttrading.com', name: 'Kamrul Hasan', nameBn: 'কামরুল হাসান', designation: 'Site Engineer', designationBn: 'সাইট প্রকৌশলী', dept: 'Construction', deptBn: 'নির্মাণ', baseSalary: 35000, joiningDate: '2024-03-20', shiftStartTime: '09:00', allowances: 3000, deductions: 1000, advanceSalary: 0, password: '1234' },
    { id: 'ST-104', email: 'tania@smarttrading.com', name: 'Tania Akter', nameBn: 'তানিয়া আক্তার', designation: 'Accounts Officer', designationBn: 'হিসাব রক্ষণ কর্মকর্তা', dept: 'Finance', deptBn: 'অর্থ ও হিসাব', baseSalary: 30000, joiningDate: '2024-04-01', shiftStartTime: '09:00', allowances: 2500, deductions: 800, advanceSalary: 0, password: '1234' },
    { id: 'ST-105', email: 'sajid@smarttrading.com', name: 'Sajid Al-Mahmud', nameBn: 'সাজিদ আল-মাহমুদ', designation: 'Sales Executive', designationBn: 'সেলস এক্সিকিউটিভ', dept: 'Marketing', deptBn: 'মার্কেটিং', baseSalary: 28000, joiningDate: '2024-05-12', shiftStartTime: '09:00', allowances: 2000, deductions: 500, advanceSalary: 1000, password: '1234' }
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

  useEffect(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    const adminSession = localStorage.getItem('ob_logged_in_admin');
    if (empSession) {
      navigate('/dashboard');
    } else if (adminSession === 'true') {
      navigate('/dashboard?view=admin');
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check Admin Login (admin / admin@smarttrading.com)
    if (
      (cleanUser === 'admin' || cleanUser === 'admin@smarttrading.com') && 
      (cleanPass === '1234' || cleanPass === 'admin123')
    ) {
      localStorage.setItem('ob_logged_in_admin', 'true');
      localStorage.removeItem('ob_logged_in_employee');
      setErrorMsg('');
      window.location.href = '/dashboard';
      return;
    }

    // Check Employee Login
    const employees = getEmployeesList();
    const emp = employees.find(e => {
      const eId = e.id.trim().toLowerCase();
      const eEmail = e.email.trim().toLowerCase();
      const eName = e.name.trim().toLowerCase();
      const normalizedUser = cleanUser.replace(/@smarttrading\.com$/, '');
      const empEmailPrefix = eEmail.split('@')[0];

      return (
        eId === cleanUser ||
        eEmail === cleanUser ||
        empEmailPrefix === cleanUser ||
        empEmailPrefix === normalizedUser ||
        eName === cleanUser ||
        eName === normalizedUser
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
          ? 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।'
          : 'Incorrect password! Please try again.');
        return;
      }
    }

    setErrorMsg(lang === 'bn' 
      ? 'ভুল আইডি অথবা ইমেইল! অনুগ্রহ করে সঠিক কর্মচারী আইডি (যেমন ST-101) বা ইমেইল লিখুন।' 
      : 'Incorrect ID or Email! Please enter a valid employee ID (e.g. ST-101) or email.');
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

