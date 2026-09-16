import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Clock, Calendar, CheckCircle, LogOut, FileSpreadsheet, Users, 
  Settings as SettingsIcon, LayoutDashboard, AlertCircle, PlusCircle, Trash2, 
  UserCheck, DollarSign, Wallet, Megaphone, Bell, History, X, ClipboardList, User, Send, MessageSquare, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Menu, Mail, Check, Copy, Plus, ArrowRight, Printer, FileText, Camera, Upload, Lock, Eye, EyeOff, TrendingUp, ArrowUpRight, ArrowDownRight,
  Download, Smartphone, Monitor, MapPin, Edit3, Sliders, Search, ShieldCheck, ShieldAlert, Sparkles, Building2, Zap, AlertTriangle, CheckCircle2, Phone, Filter, Crosshair,
  LogIn, RotateCcw
} from 'lucide-react';
import { useLang } from '../context/LangContext';
import { Employee, getEmployeesList, SalaryHistoryRecord } from './Login';
import { supabase } from '../lib/supabase';
import ConfirmModal, { ModalType } from '../components/ConfirmModal';

interface AttendanceLog {
  empId?: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'On-Time' | 'Late' | 'Leave' | 'Absent';
  statusBn?: string;
  location?: string;
  note?: string;
  markedBy?: string;
}

interface Holiday {
  date: string;
  name: string;
  nameBn: string;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  type: 'All' | 'Personal';
  targetEmpId?: string;
  date: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  status: 'Pending' | 'In-Progress' | 'Done';
  date: string;
  employeeNote?: string;
}

interface TaskMessage {
  sender: 'admin' | 'employee';
  senderName: string;
  text: string;
  time: string;
}

const parseTaskMessages = (noteStr: string | null | undefined): TaskMessage[] => {
  if (!noteStr || !noteStr.trim()) return [];
  const trimmed = noteStr.trim();
  try {
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      return parsed.map((m: any) => ({
        sender: m.sender || 'employee',
        senderName: m.senderName || (m.sender === 'admin' ? 'Admin' : 'Employee'),
        text: m.text || '',
        time: m.time || ''
      })) as TaskMessage[];
    }
  } catch (e) {
    // legacy fallback
  }
  return [{ sender: 'employee', senderName: 'Employee', text: noteStr, time: '' }];
};


const parseTimeStrToMinutes = (timeStr: string): number => {
  if (!timeStr || timeStr === '-') return 0;
  const isPM = timeStr.toUpperCase().includes('PM');
  const isAM = timeStr.toUpperCase().includes('AM');
  const cleanStr = timeStr.replace(/[^0-9:]/g, '');
  const [hours, minutes] = cleanStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;

  let finalHours = hours;
  if (isPM && hours < 12) finalHours += 12;
  if (isAM && hours === 12) finalHours = 0;
  
  return finalHours * 60 + minutes;
};

const getNextEmployeeId = (list: Employee[]) => {
  const numbers = list
    .map(e => {
      const match = e.id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter(n => n > 0);
  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 101;
  return `ST-${nextNum}`;
};

const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

const compressAndResizeImage = (file: File, callback: (base64Url: string) => void, onError?: (msg: string) => void) => {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    if (onError) {
      onError('দয়া করে একটি সঠিক ছবি ফাইল নির্বাচন করুন (JPG, PNG, WebP)।');
    }
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 320;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        callback(dataUrl);
      } else {
        callback(e.target?.result as string);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

export interface SalaryCalculationResult {
  totalCalendarDays: number;
  dailyRate: number;
  absentDaysCount: number;
  absentDeduction: number;
  fridayWorkedCount: number;
  fridayBonus: number;
  lateCount: number;
  lateCutDays: number;
  lateDeduction: number;
  otHours: number;
  otPay: number;
  baseSalary: number;
  deductions: number;
  advanceSalary: number;
  netPayable: number;
  paidDays: number;
}

const calculateMonthlySalary = (
  emp: Employee, 
  yearMonth: string, 
  holidays: Holiday[]
): SalaryCalculationResult => {
  const [year, month] = yearMonth.split('-').map(Number);
  const jsMonth = month - 1;
  const totalCalendarDays = new Date(year, jsMonth + 1, 0).getDate();
  
  const now = new Date();
  const isCurrentMonth = (now.getFullYear() === year && now.getMonth() === jsMonth);
  const limitDay = isCurrentMonth ? now.getDate() : totalCalendarDays;
  
  const dailyRate = Math.round(emp.baseSalary / totalCalendarDays);
  
  const storageKey = `ob_attendance_logs_${emp.id}`;
  const savedLogs = localStorage.getItem(storageKey);
  const logsList: AttendanceLog[] = savedLogs ? JSON.parse(savedLogs) : [];
  const holidaysDates = holidays.map(h => h.date);
  
  let absentDaysCount = 0;
  let fridayWorkedCount = 0;
  
  for (let day = 1; day <= limitDay; day++) {
    const d = new Date(year, jsMonth, day);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const dateStr = d.toISOString().split('T')[0];
    const log = logsList.find(l => l.date === dateStr);
    
    if (dayOfWeek === 5) {
      // Friday is paid holiday by default
      if (log && log.checkIn) {
        fridayWorkedCount++;
      }
    } else {
      // Regular working day
      if (holidaysDates.includes(dateStr)) {
        // Government or registered holiday
      } else {
        if (!log || !log.checkIn) {
          absentDaysCount++;
        }
      }
    }
  }
  
  // Late calculations: 3 days late in a month = 1 day salary deduction
  const monthLogs = logsList.filter(l => l.date.startsWith(yearMonth));
  const lateCount = monthLogs.filter(l => l.status === 'Late').length;
  const lateCutDays = Math.floor(lateCount / 3);
  const lateDeduction = lateCutDays * dailyRate;
  
  // Absent deduction
  const absentDeduction = absentDaysCount * dailyRate;
  
  // Friday worked bonus
  const fridayBonus = fridayWorkedCount * dailyRate;
  
  // Overtime calculations: daily work beyond 8 hours
  let totalOtMinutes = 0;
  monthLogs.forEach(log => {
    if (log.checkIn && log.checkOut) {
      const inM = parseTimeStrToMinutes(log.checkIn);
      const outM = parseTimeStrToMinutes(log.checkOut);
      if (outM > inM) {
        const workedM = outM - inM;
        if (workedM > 480) { // 8 hours = 480 mins
          totalOtMinutes += (workedM - 480);
        }
      }
    }
  });
  
  const otHours = Math.round((totalOtMinutes / 60) * 10) / 10;
  const hourlyRate = dailyRate / 8;
  const otPay = Math.round(otHours * hourlyRate);
  
  const deductions = emp.deductions || 0;
  const advanceSalary = emp.advanceSalary || 0;
  
  const netPayable = Math.max(
    0,
    emp.baseSalary - absentDeduction - lateDeduction + fridayBonus + otPay - deductions - advanceSalary
  );
  
  const paidDays = Math.max(0, limitDay - absentDaysCount);
  
  return {
    totalCalendarDays,
    dailyRate,
    absentDaysCount,
    absentDeduction,
    fridayWorkedCount,
    fridayBonus,
    lateCount,
    lateCutDays,
    lateDeduction,
    otHours,
    otPay,
    baseSalary: emp.baseSalary,
    deductions,
    advanceSalary,
    netPayable,
    paidDays
  };
};

export default function Dashboard() {
  const { lang, toggleLang } = useLang();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'dashboard';

  // Live Digital Clock State
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Session States
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    if (empSession) {
      try {
        return JSON.parse(empSession) as Employee;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    const adminSession = localStorage.getItem('ob_logged_in_admin');
    if (empSession) return false;
    return adminSession === 'true';
  });
  const [loading, setLoading] = useState<boolean>(true);
  
  // Real-time Clock
  const [time, setTime] = useState<Date>(new Date());
  
  // User/Employee States
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [todayCheckedIn, setTodayCheckedIn] = useState<boolean>(false);
  const [todayCheckedOut, setTodayCheckedOut] = useState<boolean>(false);
  const [empTaskTab, setEmpTaskTab] = useState<'active' | 'completed'>('active');
  const [activeChatTask, setActiveChatTask] = useState<Task | null>(null);
  const [adminTaskFilter, setAdminTaskFilter] = useState<'All' | 'Pending' | 'In-Progress' | 'Done'>('All');
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [activeEmpProfileId, setActiveEmpProfileId] = useState<string | null>(null);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [expandedSalaryEmpId, setExpandedSalaryEmpId] = useState<string | null>(null);
  const [showAddEmpMobileModal, setShowAddEmpMobileModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalEmpId, setPaymentModalEmpId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'advance'>('full');
  const [paymentCustomAmount, setPaymentCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'MFS'>('Cash');

  // Attendance Tab & Manual Adjustment States
  const [attendanceDate, setAttendanceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [attendanceSearch, setAttendanceSearch] = useState<string>('');
  const [attendanceVersion, setAttendanceVersion] = useState<number>(0);
  const [expandedAttendanceEmpId, setExpandedAttendanceEmpId] = useState<string | null>(null);
  const [expandedHistoryDate, setExpandedHistoryDate] = useState<string | null>(null);
  const [showManualAttendanceModal, setShowManualAttendanceModal] = useState<boolean>(false);
  const [manualEmpId, setManualEmpId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualCheckIn, setManualCheckIn] = useState<string>('09:00 AM');
  const [manualCheckOut, setManualCheckOut] = useState<string>('06:00 PM');
  const [manualStatus, setManualStatus] = useState<AttendanceLog['status']>('On-Time');
  const [manualLocation, setManualLocation] = useState<string>('স্মার্ট ট্রেডিং শপ');
  const [manualNote, setManualNote] = useState<string>('');

  // Edit Employee Profile States
  const [editName, setEditName] = useState('');
  const [editNameBn, setEditNameBn] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDesignationBn, setEditDesignationBn] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmailPrefix, setEditEmailPrefix] = useState('');
  const [editSalary, setEditSalary] = useState('30000');
  const [editAllowances, setEditAllowances] = useState('0');
  const [editDeductions, setEditDeductions] = useState('0');
  const [editAdvanceSalary, setEditAdvanceSalary] = useState('0');
  const [editJoiningDate, setEditJoiningDate] = useState('2024-01-01');
  const [editShiftStartTime, setEditShiftStartTime] = useState('09:00');
  const [editAvatar, setEditAvatar] = useState<string>('');
  const [editPassword, setEditPassword] = useState('1234');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSalaryNote, setEditSalaryNote] = useState('');
  const [selectedProfileMonth, setSelectedProfileMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [adminAvatar, setAdminAvatar] = useState<string>(() => localStorage.getItem('ob_admin_avatar') || '');
  
  // Admin Panel States
  const [employeesList, setEmployeesList] = useState<Employee[]>(() => getEmployeesList());
  const [paidStatus, setPaidStatus] = useState<Record<string, boolean>>({});

  // Holiday Configuration States
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayNameBn, setNewHolidayNameBn] = useState('');

  // Notice Board States
  const [noticesList, setNoticesList] = useState<Notice[]>([]);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [newNoticeType, setNewNoticeType] = useState<'All' | 'Personal'>('All');
  const [newNoticeTarget, setNewNoticeTarget] = useState('');

  // Add Employee Form States
  const [newId, setNewId] = useState<string>(() => getNextEmployeeId(getEmployeesList()));
  const [newName, setNewName] = useState('');
  const [newNameBn, setNewNameBn] = useState('');
  const [newEmailPrefix, setNewEmailPrefix] = useState('');
  const [newDesignation, setNewDesignation] = useState('Sales Executive');
  const [newDesignationBn, setNewDesignationBn] = useState('সেলস এক্সিকিউটিভ');
  const [newSalary, setNewSalary] = useState('30000');
  const [newJoiningDate, setNewJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [newShiftStartTime, setNewShiftStartTime] = useState('09:00');
  const [newAllowances, setNewAllowances] = useState('0');
  const [newDeductions, setNewDeductions] = useState('0');
  const [newAdvanceSalary, setNewAdvanceSalary] = useState('0');
  const [newAvatar, setNewAvatar] = useState<string>('');
  const [newPassword, setNewPassword] = useState('1234');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Active Settings Sub-section
  const [activeSettingSection, setActiveSettingSection] = useState<'menu' | 'profile' | 'holidays' | 'notices' | 'logout' | 'office' | 'install'>('menu');

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Left Sidebar / Drawer State (Collapsible on Desktop, Slide-over on Mobile)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('ob_sidebar_collapsed') === 'true';
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ob_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsAppInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // Office / Shop Settings (Configurable by Admin)
  const [officeStartTime, setOfficeStartTime] = useState('09:00'); // 'HH:MM' 24h
  const [officeGracePeriod, setOfficeGracePeriod] = useState(15); // minutes
  const [officeLat, setOfficeLat] = useState<number | ''>(23.7925);
  const [officeLng, setOfficeLng] = useState<number | ''>(90.4078);
  const [officeRadius, setOfficeRadius] = useState<number>(10);
  const [checkInLoading, setCheckInLoading] = useState<boolean>(false);
  const [locatingCurrentGps, setLocatingCurrentGps] = useState<boolean>(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem('ob_office_settings');
    if (savedSettings) {
      try {
        const { checkInTime, gracePeriod, lat, lng, radius } = JSON.parse(savedSettings);
        if (checkInTime) setOfficeStartTime(checkInTime);
        if (gracePeriod !== undefined) setOfficeGracePeriod(Number(gracePeriod));
        if (lat !== undefined) setOfficeLat(lat === '' ? '' : Number(lat));
        if (lng !== undefined) setOfficeLng(lng === '' ? '' : Number(lng));
        if (radius !== undefined) setOfficeRadius(Number(radius));
      } catch (e) {
        console.error('Error loading office settings', e);
      }
    }
  }, []);

  // Premium Punch Confirmation Modal (OurBuilders ERP Style)
  const [punchSuccessData, setPunchSuccessData] = useState<{
    isOpen: boolean;
    type: 'checkin' | 'checkout';
    time: string;
    date: string;
    status: 'On-Time' | 'Late' | 'Checkout';
    statusBn: string;
    empName: string;
    empId: string;
    location: string;
    note?: string;
  } | null>(null);

  // Premium Custom Confirmation & Alert Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type?: ModalType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isAlertOnly?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirmDialog = ({
    title,
    message,
    type = 'warning',
    confirmText,
    cancelText,
    onConfirm,
  }: {
    title: string;
    message: string;
    type?: ModalType;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      type,
      title,
      message,
      confirmText,
      cancelText: cancelText || (lang === 'bn' ? 'বাতিল' : 'Cancel'),
      isAlertOnly: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const showAlertDialog = ({
    title,
    message,
    type = 'success',
    confirmText,
    onConfirm,
  }: {
    title: string;
    message: string;
    type?: ModalType;
    confirmText?: string;
    onConfirm?: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      type,
      title,
      message,
      confirmText: confirmText || (lang === 'bn' ? 'ঠিক আছে' : 'OK'),
      isAlertOnly: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleGetDeviceCurrentLocation = () => {
    if (!navigator.geolocation) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'জিপিএস অনুপস্থিত' : 'GPS Unsupported',
        message: lang === 'bn' ? 'আপনার ডিভাইসে GPS পাওয়া যায়নি।' : 'Geolocation not supported.'
      });
      return;
    }
    setLocatingCurrentGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingCurrentGps(false);
        setOfficeLat(Number(pos.coords.latitude.toFixed(6)));
        setOfficeLng(Number(pos.coords.longitude.toFixed(6)));
        showAlertDialog({
          type: 'success',
          title: lang === 'bn' ? 'জিপিএস লোকেশন সনাক্ত' : 'GPS Acquired',
          message: lang === 'bn' ? 'বর্তমান শপের GPS লোকেশন সফলভাবে চিহ্নিত করা হয়েছে!' : 'Shop GPS location acquired!'
        });
      },
      (err) => {
        setLocatingCurrentGps(false);
        showAlertDialog({
          type: 'warning',
          title: lang === 'bn' ? 'জিপিএস পাওয়া যায়নি' : 'GPS Error',
          message: lang === 'bn' ? 'GPS অবস্থান পাওয়া যায়নি। মোবাইলের লোকেশন অন করুন এবং ব্রাউজারে অনুমতি দিন।' : 'Failed to get GPS location. Enable permissions.'
        });
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (activeEmpProfileId) {
      const emp = employeesList.find(e => e.id === activeEmpProfileId);
      if (emp) {
        setEditName(emp.name);
        setEditNameBn(emp.nameBn || emp.name);
        setEditDesignation(emp.designation);
        setEditDesignationBn(emp.designationBn || emp.designation);
        setEditEmail(emp.email);
        setEditEmailPrefix(emp.email.replace(/@smarttrading\.com$/i, ''));
        setEditSalary(String(emp.baseSalary));
        setEditAllowances(String(emp.allowances || 0));
        setEditDeductions(String(emp.deductions || 0));
        setEditAdvanceSalary(String(emp.advanceSalary || 0));
        setEditJoiningDate(emp.joiningDate || '2024-01-01');
        setEditShiftStartTime(emp.shiftStartTime || '09:00');
        setEditAvatar(emp.avatar || '');
        setEditPassword(emp.password || '1234');
        setEditSalaryNote('');
      }
    }
  }, [activeEmpProfileId, employeesList]);

  // Reports States
  const [reportEmpId, setReportEmpId] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [generatedReportLogs, setGeneratedReportLogs] = useState<{
    dateStr: string;
    dayNum: number;
    dayName: string;
    status: 'Present' | 'Late' | 'Holiday' | 'Weekend' | 'Absent' | 'Future';
    statusBn: string;
    checkInTime: string;
    checkOutTime: string;
    workedHours: string;
    otHours: number;
    location?: string;
  }[] | null>(null);

  const [reportSummary, setReportSummary] = useState<{
    emp: Employee;
    totalCalendarDays: number;
    presentCount: number;
    lateCount: number;
    lateCutDays: number;
    lateDeduction: number;
    absentCount: number;
    absentDeduction: number;
    weekendCount: number;
    fridayWorked: number;
    fridayBonus: number;
    totalOtHours: number;
    totalOtPay: number;
    paidDaysCount: number;
    dailyRate: number;
    baseSalary: number;
    netPayable: number;
  } | null>(null);

  // Selected Notice Modal Details
  const [selectedNoticeDetails, setSelectedNoticeDetails] = useState<Notice | null>(null);

  // Tasks States
  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskTarget, setNewTaskTarget] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Load tasks, notices, and holidays from Supabase (fallback to localStorage if tables don't exist yet)
  const syncFromSupabase = async () => {
    try {
      // 1. Fetch Tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!tasksError && tasksData) {
        const mappedTasks = tasksData.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          assignedTo: t.assigned_to,
          assignedToName: t.assigned_to_name,
          deadline: t.deadline || '-',
          status: t.status,
          date: t.date,
          employeeNote: t.employee_note || ''
        }));
        setTasksList(mappedTasks);
        localStorage.setItem('ob_tasks_list', JSON.stringify(mappedTasks));
      }

      // 2. Fetch Notices & Cloud Registry
      const { data: noticesData, error: noticesError } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!noticesError && noticesData) {
        // Check for cloud employee registry and sync
        const sysRegistry = noticesData.find((n: any) => n.id === 'SYS_EMPLOYEES_REGISTRY');
        if (sysRegistry && sysRegistry.content) {
          try {
            const cloudEmps = JSON.parse(sysRegistry.content) as Employee[];
            if (Array.isArray(cloudEmps) && cloudEmps.length > 0) {
              const currentLocal = getEmployeesList();
              const merged = [...cloudEmps];
              currentLocal.forEach(loc => {
                if (!merged.some(m => m.id.toLowerCase() === loc.id.toLowerCase())) {
                  merged.push(loc);
                }
              });
              localStorage.setItem('ob_employees_list', JSON.stringify(merged));
              setEmployeesList(merged);
            }
          } catch(e) {
            console.error("Cloud employee registry parse error:", e);
          }
        }

        const mappedNotices = noticesData
          .filter((n: any) => !n.id?.startsWith('SYS_'))
          .map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            type: n.type,
            targetEmpId: n.target_emp_id,
            date: n.date
          }));
        setNoticesList(mappedNotices);
        localStorage.setItem('ob_notices_list', JSON.stringify(mappedNotices));
      }

      // 3. Fetch Holidays
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });
      
      if (!holidaysError && holidaysData) {
        const mappedHolidays = holidaysData.map((h: any) => ({
          date: h.date,
          name: h.name,
          nameBn: h.name_bn
        }));
        setHolidaysList(mappedHolidays);
        localStorage.setItem('ob_holidays_list', JSON.stringify(mappedHolidays));
      }
    } catch (err) {
      console.error("Supabase sync error, using local fallback:", err);
    }
  };

  useEffect(() => {
    // Load local cache immediately for responsive feel
    const list = JSON.parse(localStorage.getItem('ob_tasks_list') || '[]');
    setTasksList(list);
    const localNotices = JSON.parse(localStorage.getItem('ob_notices_list') || '[]');
    if (localNotices.length > 0) setNoticesList(localNotices);
    const localHolidays = JSON.parse(localStorage.getItem('ob_holidays_list') || '[]');
    if (localHolidays.length > 0) setHolidaysList(localHolidays);

    // Sync from Supabase in background
    syncFromSupabase();
  }, []);

  // Auto-fill reportEmpId when currentEmployee changes
  useEffect(() => {
    if (currentEmployee) {
      setReportEmpId(currentEmployee.id);
    } else if (employeesList.length > 0 && !reportEmpId) {
      setReportEmpId(employeesList[0].id);
    }
  }, [currentEmployee, employeesList]);

  // Auto-fill newId with next sequential ID if empty
  useEffect(() => {
    if (employeesList.length > 0 && !newId) {
      setNewId(getNextEmployeeId(employeesList));
    }
  }, [employeesList, newId]);

  const generateAttendanceReport = (
    e?: React.FormEvent, 
    overrideEmpId?: string, 
    overrideMonth?: number, 
    overrideYear?: number
  ) => {
    if (e) e.preventDefault();
    const targetId = (!isAdminLoggedIn && currentEmployee) ? currentEmployee.id : (overrideEmpId || reportEmpId);
    if (!targetId) return;

    const m = overrideMonth || reportMonth;
    const y = overrideYear || reportYear;
    const targetEmp = employeesList.find(emp => emp.id === targetId);
    if (!targetEmp) return;

    // Get days in selected month
    const daysInMonth = new Date(y, m, 0).getDate();

    // Read stored logs for this employee
    const empStorageKey = `ob_attendance_logs_${targetId}`;
    const savedLogsStr = localStorage.getItem(empStorageKey);
    let logsList: AttendanceLog[] = savedLogsStr ? JSON.parse(savedLogsStr) : [];

    // Fallback or seed realistic records if empty so reports can be viewed anytime
    if (logsList.length === 0) {
      const seeded: AttendanceLog[] = [];
      const now = new Date();
      const currentDay = (now.getFullYear() === y && (now.getMonth() + 1) === m) ? now.getDate() : daysInMonth;
      for (let d = 1; d <= currentDay; d++) {
        const dObj = new Date(y, m - 1, d);
        if (dObj.getDay() !== 5) { // not Friday
          const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (d % 6 === 2) {
            seeded.push({ date: dStr, checkIn: '09:18 AM', checkOut: '05:30 PM', status: 'Late', statusBn: 'বিলম্ব' });
          } else if (d % 13 !== 0) {
            seeded.push({ date: dStr, checkIn: '08:50 AM', checkOut: '05:40 PM', status: 'On-Time', statusBn: 'যথাসময়ে' });
          }
        }
      }
      localStorage.setItem(empStorageKey, JSON.stringify(seeded));
      logsList = seeded;
    }

    const generatedLogs = [];
    const dayNamesBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let weekendCount = 0;
    let fridayWorked = 0;
    let totalOtMinutes = 0;

    const [shiftH, shiftM] = (targetEmp.shiftStartTime || officeStartTime || '09:00').split(':').map(Number);
    const shiftStartMins = (isNaN(shiftH) ? 9 : shiftH) * 60 + (isNaN(shiftM) ? 0 : shiftM);
    const lateThreshold = shiftStartMins + (officeGracePeriod || 15);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(y, m - 1, day);
      const isFriday = dayDate.getDay() === 5;
      const isFuture = dayDate > new Date();
      const isHoliday = holidaysList.some(h => h.date === dateString);

      const log = logsList.find(l => l.date === dateString);

      let status: 'Present' | 'Late' | 'Holiday' | 'Weekend' | 'Absent' | 'Future' = 'Absent';
      let statusBn = 'অনুপস্থিত';
      let checkInTime = '-';
      let checkOutTime = '-';
      let workedHours = '-';
      let dayOtHours = 0;

      if (log && log.checkIn && log.checkIn !== '-') {
        checkInTime = log.checkIn;
        checkOutTime = log.checkOut || '-';

        const inMins = parseTimeStrToMinutes(log.checkIn);
        const isLate = inMins > lateThreshold || log.status === 'Late';

        if (isFriday) {
          fridayWorked++;
          status = 'Weekend';
          statusBn = lang === 'bn' ? 'সাপ্তাহিক ছুটি (কর্মরত বোনাস)' : 'Friday (Worked Bonus)';
        } else if (isLate) {
          status = 'Late';
          statusBn = lang === 'bn' ? 'বিলম্ব (Late)' : 'Late';
          lateCount++;
        } else {
          status = 'Present';
          statusBn = lang === 'bn' ? 'যথাসময়ে উপস্থিত' : 'Present';
          presentCount++;
        }

        // Calculate hours worked & overtime (standard day = 8 hours / 480 mins)
        if (checkOutTime !== '-') {
          const outMins = parseTimeStrToMinutes(checkOutTime);
          if (outMins > inMins) {
            const diffMins = outMins - inMins;
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            workedHours = lang === 'bn' ? `${hours} ঘণ্টা ${mins} মি.` : `${hours}h ${mins}m`;
            if (diffMins > 480) {
              const otM = diffMins - 480;
              dayOtHours = Math.round((otM / 60) * 10) / 10;
              totalOtMinutes += otM;
            }
          }
        }
      } else if (isFuture) {
        status = 'Future';
        statusBn = lang === 'bn' ? 'ভবিষ্যত দিন' : 'Upcoming';
      } else if (isHoliday) {
        status = 'Holiday';
        statusBn = lang === 'bn' ? 'সরকারি ছুটি (পেইড)' : 'Holiday (Paid)';
      } else if (isFriday) {
        status = 'Weekend';
        statusBn = lang === 'bn' ? 'সাপ্তাহিক ছুটি (পেইড)' : 'Weekly Off (Paid)';
        weekendCount++;
      } else {
        status = 'Absent';
        statusBn = lang === 'bn' ? 'অনুপস্থিত (বেতনহীন)' : 'Absent (Unpaid)';
        absentCount++;
      }

      generatedLogs.push({
        dateStr: dateString,
        dayNum: day,
        dayName: lang === 'bn' ? dayNamesBn[dayDate.getDay()] : dayNamesEn[dayDate.getDay()],
        status,
        statusBn,
        checkInTime,
        checkOutTime,
        workedHours,
        otHours: dayOtHours,
        location: (log && (log.location || (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'))) || (log ? (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop') : '-')
      });
    }

    const dailyRate = Math.round(targetEmp.baseSalary / daysInMonth);
    const lateCutDays = Math.floor(lateCount / 3);
    const lateDeduction = lateCutDays * dailyRate;
    const absentDeduction = absentCount * dailyRate;
    const fridayBonus = fridayWorked * dailyRate;
    const hourlyRate = dailyRate / 8;
    const totalOtHours = Math.round((totalOtMinutes / 60) * 10) / 10;
    const totalOtPay = Math.round(totalOtHours * hourlyRate);
    const paidDaysCount = Math.max(0, daysInMonth - absentCount);
    const netPayable = Math.max(
      0,
      targetEmp.baseSalary - absentDeduction - lateDeduction + fridayBonus + totalOtPay - (targetEmp.deductions || 0) - (targetEmp.advanceSalary || 0)
    );

    setReportSummary({
      emp: targetEmp,
      totalCalendarDays: daysInMonth,
      presentCount,
      lateCount,
      lateCutDays,
      lateDeduction,
      absentCount,
      absentDeduction,
      weekendCount,
      fridayWorked,
      fridayBonus,
      totalOtHours,
      totalOtPay,
      paidDaysCount,
      dailyRate,
      baseSalary: targetEmp.baseSalary,
      netPayable
    });

    setGeneratedReportLogs(generatedLogs);
  };

  // Verify session on mount
  useEffect(() => {
    const empSession = localStorage.getItem('ob_logged_in_employee');
    const adminSession = localStorage.getItem('ob_logged_in_admin');
    
    // Load dynamic employees list from localStorage
    const list = getEmployeesList();
    setEmployeesList(list);
    setNewId(getNextEmployeeId(list));

    // Initialize mock paid status
    const initialPaid: Record<string, boolean> = {};
    list.forEach(emp => {
      initialPaid[emp.id] = emp.id === 'ST-101' || emp.id === 'ST-104';
    });
    setPaidStatus(initialPaid);

    // Load Holidays from localStorage
    const savedHolidays = localStorage.getItem('ob_holidays_list');
    if (savedHolidays) {
      setHolidaysList(JSON.parse(savedHolidays));
    } else {
      const initial = getInitialFridaysHolidays();
      localStorage.setItem('ob_holidays_list', JSON.stringify(initial));
      setHolidaysList(initial);
    }

    // Load Notices from localStorage
    const savedNotices = localStorage.getItem('ob_notices_list');
    if (savedNotices) {
      setNoticesList(JSON.parse(savedNotices));
    } else {
      const initialNotices: Notice[] = [
        {
          id: 'n-1',
          title: 'Welcome to Smart Trading Portal!',
          content: 'Hello everyone! Please remember to check in before 9:00 AM daily to avoid being marked late.',
          type: 'All',
          date: '2026-08-01'
        }
      ];
      localStorage.setItem('ob_notices_list', JSON.stringify(initialNotices));
      setNoticesList(initialNotices);
    }

    if (empSession) {
      try {
        const parsedEmp = JSON.parse(empSession) as Employee;
        setCurrentEmployee(parsedEmp);
        setEditPassword(parsedEmp.password || '1234');
        setIsAdminLoggedIn(false);
        loadEmployeeLogs(parsedEmp.id);
        if (activeTab === 'employees') {
          navigate('/dashboard?tab=dashboard', { replace: true });
        }
      } catch (e) {
        navigate('/login');
      }
    } else if (adminSession === 'true') {
      setIsAdminLoggedIn(true);
      setCurrentEmployee(null);
    } else {
      navigate('/login');
    }
    setLoading(false);
  }, [navigate, activeTab]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getInitialFridaysHolidays = (): Holiday[] => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const fridays: Holiday[] = [];
    
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === 5) {
        const dateStr = d.toISOString().split('T')[0];
        fridays.push({
          date: dateStr,
          name: 'Weekly Holiday',
          nameBn: 'সাপ্তাহিক ছুটি'
        });
      }
    }
    return fridays;
  };

  const loadEmployeeLogs = (empId: string) => {
    const storageKey = `ob_attendance_logs_${empId}`;
    const savedLogs = localStorage.getItem(storageKey);
    
    if (savedLogs) {
      const parsed = JSON.parse(savedLogs);
      setLogs(parsed);
      checkTodayStatus(parsed);
    } else {
      const mockLogs: AttendanceLog[] = [
        { date: '2026-07-28', checkIn: '08:55 AM', checkOut: '05:05 PM', status: 'On-Time', statusBn: 'যথাসময়ে' },
        { date: '2026-07-29', checkIn: '09:12 AM', checkOut: '05:00 PM', status: 'Late', statusBn: 'বিলম্বে' },
        { date: '2026-07-30', checkIn: '08:50 AM', checkOut: '05:10 PM', status: 'On-Time', statusBn: 'যথাসময়ে' },
        { date: '2026-07-31', checkIn: '09:05 AM', checkOut: '05:02 PM', status: 'Late', statusBn: 'বিলম্বে' },
      ];
      localStorage.setItem(storageKey, JSON.stringify(mockLogs));
      setLogs(mockLogs);
      checkTodayStatus(mockLogs);
    }
  };

  const checkTodayStatus = (allLogs: AttendanceLog[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecord = allLogs.find(l => l.date === todayStr);
    if (todayRecord) {
      setTodayCheckedIn(!!todayRecord.checkIn);
      setTodayCheckedOut(!!todayRecord.checkOut);
    } else {
      setTodayCheckedIn(false);
      setTodayCheckedOut(false);
    }
  };

  const handleCheckIn = () => {
    if (!currentEmployee) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    
    // GPS Geofence verification
    if (officeLat !== '' && officeLng !== '' && officeRadius > 0) {
      if (!navigator.geolocation) {
        showAlertDialog({
          type: 'warning',
          title: lang === 'bn' ? 'জিপিএস অনুপস্থিত' : 'GPS Unsupported',
          message: lang === 'bn' ? 'আপনার ডিভাইসে জিপিএস/লোকেশন ব্যবস্থা সাপোর্ট করে না।' : 'GPS Geolocation is not supported by your device.'
        });
        return;
      }

      setCheckInLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCheckInLoading(false);
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          const dist = calculateDistanceMeters(userLat, userLng, Number(officeLat), Number(officeLng));

          if (dist > (officeRadius || 10)) {
            showAlertDialog({
              type: 'warning',
              title: lang === 'bn' ? 'হাজিরা প্রত্যাখ্যাত' : 'Check-In Rejected',
              message: lang === 'bn'
                ? `উপস্থিতি গৃহীত হয়নি!\nআপনি শপ থেকে প্রায় ${dist} মিটার দূরে আছেন।\nশুধুমাত্র শপের ${officeRadius || 10} মিটারের মধ্যে হাজিরা দেওয়া সম্ভব।`
                : `Check-in rejected!\nYou are approx ${dist} meters away from the shop.\nAttendance is only allowed within ${officeRadius || 10} meters.`
            });
            return;
          }

          completeCheckIn(todayStr, nowTimeStr);
        },
        (err) => {
          setCheckInLoading(false);
          showAlertDialog({
            type: 'warning',
            title: lang === 'bn' ? 'লোকেশন পারমিশন প্রয়োজন' : 'Location Required',
            message: lang === 'bn' 
              ? 'হাজিরা প্রদানের জন্য মোবাইলের লোকেশন (GPS) চালু করুন এবং ব্রাউজারে অনুমতি দিন।' 
              : 'Please turn on your device GPS location and grant browser permission to check in.'
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return;
    }

    completeCheckIn(todayStr, nowTimeStr);
  };

  const completeCheckIn = (todayStr: string, nowTimeStr: string) => {
    if (!currentEmployee) return;
    const empShiftStart = currentEmployee.shiftStartTime || officeStartTime || '09:00';
    const [startH, startM] = empShiftStart.split(':').map(Number);
    const shiftStartMinutes = startH * 60 + startM;
    const lateThreshold = shiftStartMinutes + officeGracePeriod;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isLate = currentMinutes > lateThreshold;
    const status: AttendanceLog['status'] = isLate ? 'Late' : 'On-Time';
    const statusBn = isLate 
      ? (lang === 'bn' ? 'বিলম্বে (Late)' : 'Late') 
      : (lang === 'bn' ? 'যথাসময়ে' : 'On-Time');

    const newLog: AttendanceLog = {
      empId: currentEmployee.id,
      date: todayStr,
      checkIn: nowTimeStr,
      checkOut: '',
      status,
      statusBn,
      location: lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop',
      note: '',
      markedBy: lang === 'bn' ? 'ডিজিটাল পাঞ্চ' : 'Digital Punch'
    };

    const updatedLogs = [newLog, ...logs.filter(l => l.date !== todayStr)];
    const storageKey = `ob_attendance_logs_${currentEmployee.id}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedLogs));
    setLogs(updatedLogs);
    setTodayCheckedIn(true);
    setAttendanceVersion(v => v + 1);
    
    // Trigger OurBuilders ERP Style Punch Modal
    setPunchSuccessData({
      isOpen: true,
      type: 'checkin',
      time: nowTimeStr,
      date: todayStr,
      status: isLate ? 'Late' : 'On-Time',
      statusBn,
      empName: lang === 'bn' ? (currentEmployee.nameBn || currentEmployee.name) : currentEmployee.name,
      empId: currentEmployee.id,
      location: lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop',
      note: isLate ? (lang === 'bn' ? 'দেরিতে প্রবেশের কারণে হাজিরা বিলম্ব হিসেবে রেকর্ড হয়েছে।' : 'Late entry recorded.') : (lang === 'bn' ? 'সময়মতো অফিসে উপস্থিত হওয়ার জন্য ধন্যবাদ!' : 'Thank you for arriving on time!')
    });
  };

  const handleCheckOut = () => {
    if (!currentEmployee) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    const updatedLogs = logs.map(l => {
      if (l.date === todayStr) {
        return { 
          ...l, 
          checkOut: nowTimeStr,
          location: l.location || (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop')
        };
      }
      return l;
    });

    const storageKey = `ob_attendance_logs_${currentEmployee.id}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedLogs));
    setLogs(updatedLogs);
    setTodayCheckedOut(true);
    setAttendanceVersion(v => v + 1);

    // Trigger OurBuilders ERP Style Punch Modal
    setPunchSuccessData({
      isOpen: true,
      type: 'checkout',
      time: nowTimeStr,
      date: todayStr,
      status: 'Checkout',
      statusBn: lang === 'bn' ? 'প্রস্থান সম্পন্ন' : 'Checked Out',
      empName: lang === 'bn' ? (currentEmployee.nameBn || currentEmployee.name) : currentEmployee.name,
      empId: currentEmployee.id,
      location: lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop',
      note: lang === 'bn' ? 'আজকের দিনের শিফট সফলভাবে সমাপ্ত হয়েছে। শুভকামনা!' : 'Today\'s shift completed successfully. Have a great evening!'
    });
  };

  // Attendance Helpers
  const formatLocation = (loc?: string): string => {
    if (!loc || loc === '-') return '-';
    const cleaned = loc
      .replace(/\s*\(জিপিএস[^)]*\)/g, '')
      .replace(/\s*\(GPS[^)]*\)/gi, '')
      .trim();
    return cleaned || (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop');
  };

  const calculateExpectedOutTime = (checkInStr: string, hoursToAdd: number = 8): string => {
    if (!checkInStr || checkInStr === '-') return '-';
    const mins = parseTimeStrToMinutes(checkInStr);
    if (mins === 0 && !checkInStr.includes('12')) return '-';
    const targetMins = (mins + hoursToAdd * 60) % 1440;
    const h24 = Math.floor(targetMins / 60);
    const m = targetMins % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h12)}:${pad(m)} ${period}`;
  };

  const getDutyProgress = (checkInStr: string, checkOutStr?: string, targetHours: number = 8) => {
    if (!checkInStr || checkInStr === '-') return null;
    const inM = parseTimeStrToMinutes(checkInStr);
    let currentM = 0;
    if (checkOutStr && checkOutStr !== '-') {
      currentM = parseTimeStrToMinutes(checkOutStr);
    } else {
      const now = new Date();
      currentM = now.getHours() * 60 + now.getMinutes();
    }
    const workedM = currentM >= inM ? currentM - inM : (1440 - inM) + currentM;
    const targetM = targetHours * 60;
    const remainingM = Math.max(0, targetM - workedM);
    const otM = Math.max(0, workedM - targetM);

    const workedHoursStr = `${Math.floor(workedM / 60)}h ${workedM % 60}m`;
    const remainingHoursStr = `${Math.floor(remainingM / 60)}h ${remainingM % 60}m`;
    const otHoursStr = `${Math.floor(otM / 60)}h ${otM % 60}m`;

    return {
      workedM,
      targetM,
      remainingM,
      otM,
      workedHoursStr,
      remainingHoursStr,
      otHoursStr,
      isCompleted: workedM >= targetM
    };
  };

  const toBnDigits = (val: number | string): string => {
    return String(val).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);
  };

  const getEmployeeAttendanceRecord = (empId: string, dateStr: string): AttendanceLog => {
    const storageKey = `ob_attendance_logs_${empId}`;
    const raw = localStorage.getItem(storageKey);
    let logsList: AttendanceLog[] = [];
    if (raw) {
      try {
        logsList = JSON.parse(raw);
      } catch (e) {
        logsList = [];
      }
    }

    const found = logsList.find(l => l.date === dateStr);
    if (found) return found;

    // Seed realistic demo records for today if none exist yet
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) {
      let seed: AttendanceLog | null = null;
      if (empId === 'ST-101') {
        seed = { date: todayStr, checkIn: '08:52 AM', checkOut: '06:22 PM', status: 'On-Time', statusBn: 'যথাসময়ে', location: 'স্মার্ট ট্রেডিং শপ', note: 'দৈনিক নিয়মিত উপস্থিতি', markedBy: 'ডিজিটাল পাঞ্চ' };
      } else if (empId === 'ST-102') {
        seed = { date: todayStr, checkIn: '09:18 AM', checkOut: '05:45 PM', status: 'Late', statusBn: 'বিলম্বে', location: 'স্মার্ট ট্রেডিং শপ', note: 'দেরিতে আগমন', markedBy: 'ডিজিটাল পাঞ্চ' };
      } else if (empId === 'ST-103') {
        seed = { date: todayStr, checkIn: '08:45 AM', checkOut: '04:15 PM', status: 'On-Time', statusBn: 'যথাসময়ে', location: 'স্মার্ট ট্রেডিং শপ', note: 'জরুরি প্রয়োজনে আগে প্রস্থান', markedBy: 'ডিজিটাল পাঞ্চ' };
      } else if (empId === 'ST-104') {
        seed = { date: todayStr, checkIn: '09:00 AM', checkOut: '05:00 PM', status: 'On-Time', statusBn: 'যথাসময়ে', location: 'স্মার্ট ট্রেডিং শপ', note: 'স্ট্যান্ডার্ড ডিউটি', markedBy: 'ডিজিটাল পাঞ্চ' };
      } else if (empId === 'ST-105') {
        seed = { date: todayStr, checkIn: '-', checkOut: '-', status: 'Leave', statusBn: 'ছুটি', location: '-', note: 'অনুমোদিত ছুটি', markedBy: 'অনুমোদিত ছুটি' };
      }
      if (seed) {
        logsList.push(seed);
        localStorage.setItem(storageKey, JSON.stringify(logsList));
        return seed;
      }
    }

    return {
      date: dateStr,
      checkIn: '-',
      checkOut: '-',
      status: 'Absent',
      statusBn: 'অনুপস্থিত',
      location: '-',
      note: ''
    };
  };

  const getAttendanceMetrics = (log: AttendanceLog) => {
    if (log.status === 'Leave') {
      return {
        duration: '-',
        badgeType: 'leave',
        badgeLabel: lang === 'bn' ? 'অনুমোদিত ছুটি' : 'Leave',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }
    if (log.status === 'Absent' || !log.checkIn || log.checkIn === '-') {
      return {
        duration: '-',
        badgeType: 'absent',
        badgeLabel: lang === 'bn' ? 'অনুপস্থিত' : 'Absent',
        badgeColor: 'bg-red-50 text-red-700 border-red-200'
      };
    }

    const inMins = parseTimeStrToMinutes(log.checkIn);
    const hasOut = log.checkOut && log.checkOut !== '-';
    const outMins = hasOut ? parseTimeStrToMinutes(log.checkOut!) : 0;

    if (!hasOut || outMins <= inMins) {
      return {
        duration: lang === 'bn' ? 'কর্মরত (শিফট চলছে)' : 'In Shift',
        badgeType: 'working',
        badgeLabel: lang === 'bn' ? 'রানিং ডিউটি' : 'In Shift',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }

    const diffMins = outMins - inMins;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    const duration = lang === 'bn' 
      ? `${toBnDigits(h)} ঘণ্টা ${m > 0 ? `${toBnDigits(m)} মি.` : ''}` 
      : `${h}h ${m > 0 ? `${m}m` : ''}`;

    const standardMins = 480; // 8 hours standard shift
    if (diffMins > standardMins) {
      const otM = diffMins - standardMins;
      const otH = (otM / 60).toFixed(1);
      return {
        duration,
        badgeType: 'overtime',
        badgeLabel: lang === 'bn' ? `+${toBnDigits(otH)} ঘণ্টা OT` : `+${otH}h OT`,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
      };
    } else if (diffMins < standardMins) {
      const shortM = standardMins - diffMins;
      const shortH = (shortM / 60).toFixed(1);
      return {
        duration,
        badgeType: 'shortfall',
        badgeLabel: lang === 'bn' ? `-${toBnDigits(shortH)} ঘণ্টা কম` : `-${shortH}h Short`,
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200 font-bold'
      };
    } else {
      return {
        duration,
        badgeType: 'standard',
        badgeLabel: lang === 'bn' ? '৮ ঘণ্টা পূর্ণ (Standard)' : '8h Standard',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
      };
    }
  };

  const openManualAdjustmentModal = (empId: string, targetDate?: string) => {
    const d = targetDate || attendanceDate || new Date().toISOString().split('T')[0];
    const rec = getEmployeeAttendanceRecord(empId, d);
    setManualEmpId(empId);
    setManualDate(d);
    setManualCheckIn(rec.checkIn && rec.checkIn !== '-' ? rec.checkIn : '09:00 AM');
    setManualCheckOut(rec.checkOut && rec.checkOut !== '-' ? rec.checkOut : '06:00 PM');
    setManualStatus(rec.status || 'On-Time');
    setManualLocation(rec.location && rec.location !== '-' ? formatLocation(rec.location) : (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'));
    setManualNote(rec.note || '');
    setShowManualAttendanceModal(true);
  };

  const handleSaveManualAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmpId) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'কর্মী নির্বাচন প্রয়োজন' : 'Employee Required',
        message: lang === 'bn' ? 'অনুগ্রহ করে একজন কর্মকর্তা নির্বাচন করুন।' : 'Please select an employee.'
      });
      return;
    }

    const storageKey = `ob_attendance_logs_${manualEmpId}`;
    const raw = localStorage.getItem(storageKey);
    let logsList: AttendanceLog[] = [];
    if (raw) {
      try {
        logsList = JSON.parse(raw);
      } catch (err) {
        logsList = [];
      }
    }

    const statusBnMap: Record<string, string> = {
      'On-Time': 'যথাসময়ে',
      'Late': 'বিলম্বে',
      'Leave': 'ছুটি',
      'Absent': 'অনুপস্থিত'
    };

    const isNonAttendance = manualStatus === 'Absent' || manualStatus === 'Leave';

    const updatedLog: AttendanceLog = {
      empId: manualEmpId,
      date: manualDate,
      checkIn: isNonAttendance ? '-' : (manualCheckIn.trim() || '-'),
      checkOut: isNonAttendance ? '-' : (manualCheckOut.trim() || '-'),
      status: manualStatus,
      statusBn: statusBnMap[manualStatus] || manualStatus,
      location: isNonAttendance ? '-' : (manualLocation.trim() ? formatLocation(manualLocation.trim()) : (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop')),
      note: manualNote.trim() || (lang === 'bn' ? 'এডমিন কর্তৃক সরাসরি সমন্বয়' : 'Admin manual adjustment'),
      markedBy: lang === 'bn' ? 'এডমিন থেকে করা হয়েছে' : 'Admin Adjustment'
    };

    const filtered = logsList.filter(l => l.date !== manualDate);
    const newLogs = [updatedLog, ...filtered];
    localStorage.setItem(storageKey, JSON.stringify(newLogs));

    if (currentEmployee && currentEmployee.id === manualEmpId) {
      setLogs(newLogs);
      checkTodayStatus(newLogs);
    }

    setAttendanceVersion(v => v + 1);
    setShowManualAttendanceModal(false);
    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'হাজিরা সমন্বয় সম্পন্ন' : 'Attendance Adjusted',
      message: lang === 'bn' ? 'হাজিরা রেকর্ড সফলভাবে এডমিন থেকে সমন্বয় ও সংরক্ষণ করা হয়েছে!' : 'Attendance record successfully adjusted and saved!'
    });
  };

  const handleExportAttendanceCSV = () => {
    const targetEmployees = attendanceSearch
      ? employeesList.filter(e => 
          e.name.toLowerCase().includes(attendanceSearch.toLowerCase()) || 
          e.nameBn.includes(attendanceSearch) || 
          e.id.toLowerCase().includes(attendanceSearch.toLowerCase())
        )
      : employeesList;

    const records = targetEmployees.map(emp => {
      const log = getEmployeeAttendanceRecord(emp.id, attendanceDate);
      const metrics = getAttendanceMetrics(log);
      const isPresent = log.status === 'On-Time' || (log.checkIn && log.checkIn !== '-');
      return {
        id: emp.id,
        name: lang === 'bn' ? emp.nameBn : emp.name,
        designation: lang === 'bn' ? emp.designationBn : emp.designation,
        date: attendanceDate,
        checkIn: log.checkIn || '-',
        checkOut: log.checkOut || '-',
        duration: metrics.duration,
        otShortfall: metrics.badgeLabel.trim(),
        location: formatLocation(log.location),
        status: log.statusBn || log.status,
        markedBy: log.markedBy ? log.markedBy : (isPresent ? (lang === 'bn' ? 'ডিজিটাল পাঞ্চ' : 'Digital Punch') : '-'),
        note: log.note || '-'
      };
    });

    const headers = [
      'Employee ID',
      'Employee Name',
      'Designation',
      'Date',
      'Check In',
      'Check Out',
      'Work Duration',
      'OT or Shortfall',
      'Location',
      'Status',
      'Entry Method',
      'Note'
    ];

    const csvRows = [
      headers.join(','),
      ...records.map(r => 
        [
          `"${r.id}"`,
          `"${r.name}"`,
          `"${r.designation}"`,
          `"${r.date}"`,
          `"${r.checkIn}"`,
          `"${r.checkOut}"`,
          `"${r.duration}"`,
          `"${r.otShortfall}"`,
          `"${r.location}"`,
          `"${r.status}"`,
          `"${r.markedBy}"`,
          `"${r.note}"`
        ].join(',')
      )
    ];

    const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SmartTrading_Attendance_${attendanceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    showConfirmDialog({
      type: 'logout',
      title: lang === 'bn' ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout',
      message: lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে স্মার্ট ট্রেডিং শপ থেকে লগআউট করতে চান?' : 'Are you sure you want to log out from Smart Trading Shop?',
      confirmText: lang === 'bn' ? 'হ্যাঁ, লগআউট' : 'Logout',
      onConfirm: () => {
        localStorage.removeItem('ob_logged_in_employee');
        localStorage.removeItem('ob_logged_in_admin');
        window.location.href = '/login';
      }
    });
  };

  // Task Actions
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskTarget) return;

    const targetEmp = employeesList.find(emp => emp.id === newTaskTarget);
    const newTask: Task = {
      id: 'TASK-' + Date.now(),
      title: newTaskTitle,
      description: newTaskDesc,
      assignedTo: newTaskTarget,
      assignedToName: targetEmp ? (lang === 'bn' ? targetEmp.nameBn : targetEmp.name) : newTaskTarget,
      deadline: newTaskDeadline || '-',
      status: 'Pending',
      date: new Date().toISOString().split('T')[0]
    };

    const updated = [newTask, ...tasksList];
    localStorage.setItem('ob_tasks_list', JSON.stringify(updated));
    setTasksList(updated);

    try {
      await supabase.from('tasks').insert({
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        assigned_to: newTask.assignedTo,
        assigned_to_name: newTask.assignedToName,
        deadline: newTask.deadline,
        status: newTask.status,
        date: newTask.date
      });
    } catch (err) {
      console.error("Supabase insert task error:", err);
    }

    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskTarget('');
    setNewTaskDeadline('');
    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'কাজ বরাদ্দ সম্পন্ন' : 'Task Assigned',
      message: lang === 'bn' ? 'কাজ সফলভাবে কর্মকর্তার নিকট বরাদ্দ করা হয়েছে!' : 'Task assigned successfully!'
    });
  };

  const handleDeleteTask = (taskId: string) => {
    showConfirmDialog({
      type: 'danger',
      title: lang === 'bn' ? 'কাজ মুছে ফেলা নিশ্চিতকরণ' : 'Delete Task',
      message: lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই কাজটি তালিকা থেকে মুছে ফেলতে চান?' : 'Are you sure you want to delete this task?',
      confirmText: lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete',
      onConfirm: async () => {
        const updated = tasksList.filter(t => t.id !== taskId);
        localStorage.setItem('ob_tasks_list', JSON.stringify(updated));
        setTasksList(updated);

        try {
          await supabase.from('tasks').delete().eq('id', taskId);
        } catch (err) {
          console.error("Supabase delete task error:", err);
        }
      }
    });
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    const updated = tasksList.map(t => {
      if (t.id === taskId) {
        return { ...t, status: newStatus };
      }
      return t;
    });
    localStorage.setItem('ob_tasks_list', JSON.stringify(updated));
    setTasksList(updated);

    try {
      await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    } catch (err) {
      console.error("Supabase update task status error:", err);
    }
  };

  const handleUpdateTaskEmployeeNote = async (taskId: string, note: string) => {
    const updated = tasksList.map(t => {
      if (t.id === taskId) {
        return { ...t, employeeNote: note };
      }
      return t;
    });
    localStorage.setItem('ob_tasks_list', JSON.stringify(updated));
    setTasksList(updated);

    try {
      await supabase.from('tasks').update({ employee_note: note }).eq('id', taskId);
    } catch (err) {
      console.error("Supabase update task employee note error:", err);
    }
  };

  // Helper to sync employees list to Supabase cloud registry
  const syncEmployeesToCloud = async (list: Employee[]) => {
    try {
      await supabase.from('notices').upsert({
        id: 'SYS_EMPLOYEES_REGISTRY',
        title: 'System Employees Registry',
        content: JSON.stringify(list),
        type: 'Personal',
        target_emp_id: 'SYSTEM',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      console.error('Failed to sync employees to Supabase:', e);
    }
  };

  // Add Employee Form Handler
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newId.trim().toUpperCase();
    const cleanPrefix = newEmailPrefix.trim().toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9._-]/g, '');
    const cleanEmail = cleanPrefix ? `${cleanPrefix}@smarttrading.com` : '';
    const cleanName = newName.trim();
    const cleanNameBn = newNameBn.trim() || cleanName;
    const salaryVal = Math.max(0, parseInt(newSalary) || 30000);
    const joiningDateVal = newJoiningDate || new Date().toISOString().split('T')[0];
    const shiftTimeVal = newShiftStartTime || '09:00';
    const finalDesignation = newDesignation.trim() || 'Executive';
    const finalDesignationBn = newDesignationBn.trim() || (lang === 'bn' ? 'কর্মকর্তা' : 'Executive');

    if (!cleanId || !cleanEmail || !cleanName) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Fields',
        message: lang === 'bn' ? 'দয়া করে আইডি, ইমেইল এবং নাম পূরণ করুন।' : 'Please fill out ID, Email, and Name.'
      });
      return;
    }

    if (employeesList.some(emp => emp.id.toUpperCase() === cleanId || emp.email.toLowerCase() === cleanEmail.toLowerCase())) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'ইতিপূর্বে বিদ্যমান' : 'Already Exists',
        message: lang === 'bn' ? 'এই কর্মকর্তা আইডি বা ইমেল ইতিপূর্বে যোগ করা হয়েছে!' : 'Employee with this ID or Email already exists!'
      });
      return;
    }

    const newEmp: Employee = {
      id: cleanId,
      email: cleanEmail,
      name: cleanName,
      nameBn: cleanNameBn,
      designation: finalDesignation,
      designationBn: finalDesignationBn,
      baseSalary: salaryVal,
      joiningDate: joiningDateVal,
      shiftStartTime: shiftTimeVal,
      allowances: Math.max(0, parseInt(newAllowances) || 0),
      deductions: Math.max(0, parseInt(newDeductions) || 0),
      advanceSalary: Math.max(0, parseInt(newAdvanceSalary) || 0),
      avatar: newAvatar || undefined,
      password: newPassword.trim() || '1234',
      salaryHistory: [
        {
          id: 'sh-' + Date.now(),
          previousSalary: 0,
          newSalary: salaryVal,
          incrementAmount: salaryVal,
          date: joiningDateVal,
          note: lang === 'bn' ? 'যোগদানকালীন প্রারম্ভিক মূল বেতন' : 'Initial Starting Base Salary',
          updatedAt: new Date().toLocaleString()
        }
      ]
    };

    const updated = [...employeesList, newEmp];
    localStorage.setItem('ob_employees_list', JSON.stringify(updated));
    setEmployeesList(updated);
    syncEmployeesToCloud(updated);
    
    setPaidStatus(prev => ({ ...prev, [cleanId]: false }));
    setNewId(getNextEmployeeId(updated));
    setNewName('');
    setNewNameBn('');
    setNewEmailPrefix('');
    setNewDesignation('Sales Executive');
    setNewDesignationBn('সেলস এক্সিকিউটিভ');
    setNewSalary('30000');
    setNewJoiningDate(new Date().toISOString().split('T')[0]);
    setNewShiftStartTime('09:00');
    setNewAllowances('0');
    setNewDeductions('0');
    setNewAdvanceSalary('0');
    setNewAvatar('');
    setNewPassword('1234');
    setShowNewPassword(false);
    
    setShowAddEmpMobileModal(false);

    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'কর্মকর্তা যুক্ত হয়েছে' : 'Employee Added',
      message: lang === 'bn' ? `কর্মকর্তা ${cleanName} (${cleanId}) সফলভাবে সিস্টেমে যোগ করা হয়েছে!` : `Employee ${cleanName} (${cleanId}) added successfully!`
    });
  };

  // Delete Employee Handler
  const handleDeleteEmployee = (empId: string) => {
    showConfirmDialog({
      type: 'danger',
      title: lang === 'bn' ? 'কর্মী অপসারণ নিশ্চিতকরণ' : 'Delete Employee',
      message: lang === 'bn' ? `আপনি কি নিশ্চিতভাবে আইডি ${empId}-কে অপসারণ করতে চান?` : `Are you sure you want to delete employee ${empId}?`,
      confirmText: lang === 'bn' ? 'হ্যাঁ, অপসারণ করুন' : 'Delete',
      onConfirm: () => {
        const updated = employeesList.filter(e => e.id !== empId);
        localStorage.setItem('ob_employees_list', JSON.stringify(updated));
        setEmployeesList(updated);
        syncEmployeesToCloud(updated);
        
        const newPaid = { ...paidStatus };
        delete newPaid[empId];
        setPaidStatus(newPaid);
      }
    });
  };

  // Save Employee Profile Updates Handler
  const handleSaveEmployeeProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmpProfileId) return;

    const cleanPrefix = editEmailPrefix.trim().replace(/@.*$/, '');
    const fullEmail = cleanPrefix ? `${cleanPrefix}@smarttrading.com` : editEmail;

    const newSalaryVal = parseInt(editSalary) || 0;

    const updated = employeesList.map(emp => {
      if (emp.id === activeEmpProfileId) {
        let history = emp.salaryHistory ? [...emp.salaryHistory] : [];
        if (emp.baseSalary !== newSalaryVal) {
          const diff = newSalaryVal - emp.baseSalary;
          const newRecord: SalaryHistoryRecord = {
            id: 'sh-' + Date.now(),
            previousSalary: emp.baseSalary,
            newSalary: newSalaryVal,
            incrementAmount: diff,
            date: new Date().toISOString().split('T')[0],
            note: editSalaryNote.trim() || (diff > 0 ? (lang === 'bn' ? 'বেতন বৃদ্ধি (ইনক্রিমেন্ট)' : 'Salary Increment') : (lang === 'bn' ? 'বেতন সমন্বয়' : 'Salary Adjustment')),
            updatedAt: new Date().toLocaleString()
          };
          history = [newRecord, ...history];
        }

        return {
          ...emp,
          name: editName.trim(),
          nameBn: editNameBn.trim() || editName.trim(),
          designation: editDesignation.trim() || emp.designation,
          designationBn: editDesignationBn.trim() || editDesignation.trim() || emp.designationBn,
          email: fullEmail,
          baseSalary: newSalaryVal,
          deductions: emp.deductions || 0,
          advanceSalary: emp.advanceSalary || 0,
          joiningDate: editJoiningDate,
          shiftStartTime: editShiftStartTime || '09:00',
          avatar: editAvatar || undefined,
          password: editPassword.trim() || emp.password || '1234',
          salaryHistory: history
        };
      }
      return emp;
    });

    localStorage.setItem('ob_employees_list', JSON.stringify(updated));
    setEmployeesList(updated);
    setEditSalaryNote('');
    syncEmployeesToCloud(updated);

    if (currentEmployee && currentEmployee.id === activeEmpProfileId) {
      const currentUpdated = updated.find(e => e.id === activeEmpProfileId);
      if (currentUpdated) {
        setCurrentEmployee(currentUpdated);
        localStorage.setItem('ob_logged_in_employee', JSON.stringify(currentUpdated));
      }
    }

    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'প্রোফাইল আপডেট' : 'Profile Updated',
      message: lang === 'bn' ? 'কর্মকর্তা প্রোফাইল সফলভাবে আপডেট করা হয়েছে!' : 'Employee profile updated successfully!'
    });
  };

  // Helper: Calculate Paid Days for an employee for any given month
  const getPaidDaysForMonth = (empId: string, yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const jsMonth = month - 1;
    const totalDays = new Date(year, jsMonth + 1, 0).getDate();
    
    const storageKey = `ob_attendance_logs_${empId}`;
    const savedLogs = localStorage.getItem(storageKey);
    const checkInDates = savedLogs ? (JSON.parse(savedLogs) as AttendanceLog[]).map(l => l.date) : [];
    
    const holidaysDates = holidaysList.map(h => h.date);
    
    const now = new Date();
    const isCurrentMonth = (now.getFullYear() === year && now.getMonth() === jsMonth);
    const limitDay = isCurrentMonth ? now.getDate() : totalDays;

    let absentDays = 0;
    for (let day = 1; day <= limitDay; day++) {
      const d = new Date(year, jsMonth, day);
      const dateStr = d.toISOString().split('T')[0];
      
      const wasPresent = checkInDates.includes(dateStr);
      const isHoliday = holidaysDates.includes(dateStr);
      
      if (!wasPresent && !isHoliday) {
        absentDays++;
      }
    }
    return limitDay - absentDays;
  };

  // Helper: Load Multi-Month Payment Status
  const loadPaymentStatus = (empId: string, yearMonth: string): boolean => {
    const details = localStorage.getItem(`ob_salary_payment_details_${empId}`);
    if (details) {
      try {
        const parsed = JSON.parse(details);
        const monthDetail = parsed[yearMonth];
        if (monthDetail) {
          return monthDetail.type === 'full' || monthDetail.dueAmount === 0;
        }
      } catch (e) {}
    }
    // Fallback compatibility with old boolean-only keys
    const oldStatus = localStorage.getItem(`ob_salary_payment_status_${empId}`);
    if (oldStatus) {
      try {
        return JSON.parse(oldStatus)[yearMonth] || false;
      } catch (e) {}
    }
    return false;
  };

  // Helper: Toggle Multi-Month Payment Status
  const togglePaymentStatus = (empId: string, yearMonth: string) => {
    const key = `ob_salary_payment_status_${empId}`;
    const statusObj = localStorage.getItem(key);
    let parsed: Record<string, boolean> = {};
    if (statusObj) {
      try {
        parsed = JSON.parse(statusObj);
      } catch (e) {}
    }
    parsed[yearMonth] = !parsed[yearMonth];
    localStorage.setItem(key, JSON.stringify(parsed));
    // Trigger a state update to force re-render
    setPaidStatus(prev => ({ ...prev, [`${empId}-${yearMonth}`]: parsed[yearMonth] }));
  };

  // Confirm Salary / Advance Payment Handler
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalEmpId) return;

    const emp = employeesList.find(x => x.id === paymentModalEmpId);
    if (!emp) return;

    const calc = calculateMonthlySalary(emp, selectedProfileMonth, holidaysList);
    const netPayable = calc.netPayable;

    let finalPaid = 0;
    let finalDue = 0;

    if (paymentType === 'full') {
      finalPaid = netPayable;
      finalDue = 0;
      
      // Reset advance salary to 0 after full payout is made for the month!
      const updatedList = employeesList.map(item => {
        if (item.id === emp.id) {
          return { ...item, advanceSalary: 0 };
        }
        return item;
      });
      localStorage.setItem('ob_employees_list', JSON.stringify(updatedList));
      setEmployeesList(updatedList);
    } else if (paymentType === 'partial') {
      const amt = Number(paymentCustomAmount) || 0;
      finalPaid = Math.min(netPayable, amt);
      finalDue = Math.max(0, netPayable - finalPaid);
    } else if (paymentType === 'advance') {
      const amt = Number(paymentCustomAmount) || 0;
      finalPaid = amt;
      finalDue = 0;

      // Update the employee's advanceSalary in the employee list!
      const updatedList = employeesList.map(item => {
        if (item.id === emp.id) {
          const currentAdvance = item.advanceSalary || 0;
          return { ...item, advanceSalary: currentAdvance + amt };
        }
        return item;
      });
      localStorage.setItem('ob_employees_list', JSON.stringify(updatedList));
      setEmployeesList(updatedList);
    }

    // Save details to storage
    const detailsKey = `ob_salary_payment_details_${emp.id}`;
    const savedDetails = localStorage.getItem(detailsKey);
    let parsed: Record<string, any> = {};
    if (savedDetails) {
      try { parsed = JSON.parse(savedDetails); } catch(err) {}
    }

    parsed[selectedProfileMonth] = {
      type: paymentType,
      paidAmount: finalPaid,
      dueAmount: finalDue,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod
    };

    localStorage.setItem(detailsKey, JSON.stringify(parsed));

    // Force re-render of paid status dictionary
    setPaidStatus(prev => ({
      ...prev,
      [`${emp.id}-${selectedProfileMonth}`]: finalDue === 0
    }));

    setShowPaymentModal(false);
    setPaymentModalEmpId(null);
    setPaymentCustomAmount('');

    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'বেতন পরিশোধ সম্পন্ন' : 'Salary Disbursed',
      message: lang === 'bn' ? 'বেতন পরিশোধ রেকর্ড সফলভাবে সম্পন্ন হয়েছে!' : 'Salary payment record completed!'
    });
  };

  // Add Holiday Handler
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Fields',
        message: lang === 'bn' ? 'অনুগ্রহ করে ছুটির তারিখ এবং নাম পূরণ করুন।' : 'Please select date and fill out holiday name.'
      });
      return;
    }

    const nameBn = newHolidayNameBn.trim() || newHolidayName.trim();
    const newHol: Holiday = {
      date: newHolidayDate,
      name: newHolidayName.trim(),
      nameBn
    };

    const updated = [...holidaysList, newHol].sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem('ob_holidays_list', JSON.stringify(updated));
    setHolidaysList(updated);

    try {
      await supabase.from('holidays').insert({
        date: newHol.date,
        name: newHol.name,
        name_bn: newHol.nameBn
      });
    } catch (err) {
      console.error("Supabase insert holiday error:", err);
    }

    setNewHolidayDate('');
    setNewHolidayName('');
    setNewHolidayNameBn('');
    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'ছুটির দিন যুক্ত' : 'Holiday Added',
      message: lang === 'bn' ? 'ছুটির দিন সফলভাবে যুক্ত করা হয়েছে!' : 'Holiday added successfully!'
    });
  };

  // Delete Holiday Handler
  const handleDeleteHoliday = (date: string) => {
    showConfirmDialog({
      type: 'danger',
      title: lang === 'bn' ? 'ছুটির দিন অপসারণ' : 'Delete Holiday',
      message: lang === 'bn' ? 'আপনি কি এই ছুটির দিনটি তালিকা থেকে মুছে ফেলতে চান?' : 'Are you sure you want to delete this holiday?',
      confirmText: lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Delete',
      onConfirm: async () => {
        const updated = holidaysList.filter(h => h.date !== date);
        localStorage.setItem('ob_holidays_list', JSON.stringify(updated));
        setHolidaysList(updated);

        try {
          await supabase.from('holidays').delete().eq('date', date);
        } catch (err) {
          console.error("Supabase delete holiday error:", err);
        }
      }
    });
  };

  // Add Notice Handler
  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle || !newNoticeContent) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Fields',
        message: lang === 'bn' ? 'দয়া করে নোটিশের শিরোনাম ও বিষয়বস্তু পূরণ করুন।' : 'Please fill out notice title and content.'
      });
      return;
    }

    const targetVal = newNoticeType === 'Personal' ? newNoticeTarget : undefined;
    if (newNoticeType === 'Personal' && !newNoticeTarget) {
      showAlertDialog({
        type: 'warning',
        title: lang === 'bn' ? 'কর্মী নির্বাচন করুন' : 'Select Employee',
        message: lang === 'bn' ? 'ব্যক্তিগত নোটিশের জন্য একজন নির্দিষ্ট কর্মকর্তা নির্বাচন করুন।' : 'Please select a target employee for personal notice.'
      });
      return;
    }

    const newNot: Notice = {
      id: `n-${Date.now()}`,
      title: newNoticeTitle.trim(),
      content: newNoticeContent.trim(),
      type: newNoticeType,
      targetEmpId: targetVal,
      date: new Date().toISOString().split('T')[0]
    };

    const updated = [newNot, ...noticesList];
    localStorage.setItem('ob_notices_list', JSON.stringify(updated));
    setNoticesList(updated);

    try {
      await supabase.from('notices').insert({
        id: newNot.id,
        title: newNot.title,
        content: newNot.content,
        type: newNot.type,
        target_emp_id: newNot.targetEmpId,
        date: newNot.date
      });
    } catch (err) {
      console.error("Supabase notice insert error:", err);
    }

    setNewNoticeTitle('');
    setNewNoticeContent('');
    setNewNoticeTarget('');
    showAlertDialog({
      type: 'success',
      title: lang === 'bn' ? 'নোটিশ প্রকাশিত' : 'Notice Published',
      message: lang === 'bn' ? 'নোটিশ সফলভাবে প্রচার করা হয়েছে!' : 'Notice published successfully!'
    });
  };

  // Delete Notice Handler
  const handleDeleteNotice = (id: string) => {
    showConfirmDialog({
      type: 'danger',
      title: lang === 'bn' ? 'নোটিশ অপসারণ' : 'Delete Notice',
      message: lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই নোটিশটি তালিকা থেকে ডিলিট করতে চান?' : 'Are you sure you want to delete this notice?',
      confirmText: lang === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Delete',
      onConfirm: async () => {
        const updated = noticesList.filter(n => n.id !== id);
        localStorage.setItem('ob_notices_list', JSON.stringify(updated));
        setNoticesList(updated);

        try {
          await supabase.from('notices').delete().eq('id', id);
        } catch (err) {
          console.error("Supabase notice delete error:", err);
        }
      }
    });
  };

  // Helper: Find total calendar days in the current month
  const getDaysInCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  };

  // Helper: Calculate Payable Days for an employee based on calendar days, holidays, and their attendance log
  const getPaidDaysCount = (empId: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = getDaysInCurrentMonth();
    const todayDateNum = now.getDate();
    
    const storageKey = `ob_attendance_logs_${empId}`;
    const savedLogs = localStorage.getItem(storageKey);
    const checkInDates = savedLogs ? (JSON.parse(savedLogs) as AttendanceLog[]).map(l => l.date) : [];
    
    const holidaysDates = holidaysList.map(h => h.date);
    
    let absentDays = 0;

    for (let day = 1; day <= todayDateNum; day++) {
      const d = new Date(year, month, day);
      const dateStr = d.toISOString().split('T')[0];
      
      const wasPresent = checkInDates.includes(dateStr);
      const isHoliday = holidaysDates.includes(dateStr);
      
      if (!wasPresent && !isHoliday) {
        absentDays++;
      }
    }

    return Math.max(0, totalDays - absentDays);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredEmployees = employeesList;

  const activeEmployeeNotices = currentEmployee 
    ? noticesList.filter(n => n.type === 'All' || (n.targetEmpId && n.targetEmpId.trim().toLowerCase() === currentEmployee.id.trim().toLowerCase())) 
    : [];

  const totalCalendarDays = getDaysInCurrentMonth();

  const hasEmployeesAccess = isAdminLoggedIn;
  const hasSalaryAccess = isAdminLoggedIn;
  const hasOfficeSettingsAccess = isAdminLoggedIn;
  const hasHolidaysAccess = isAdminLoggedIn;
  const hasNoticesAdminAccess = isAdminLoggedIn;

  const quickAccessItems = isAdminLoggedIn
    ? [
        {
          label: lang === 'bn' ? 'কর্মকর্তা' : 'Employees',
          icon: <Users size={18} />,
          iconBg: 'bg-emerald-50 hover:bg-emerald-100/90 text-brand-green',
          action: () => navigate('/dashboard?tab=employees'),
        },
        {
          label: lang === 'bn' ? 'লাইভ হাজিরা' : 'Attendance',
          icon: <UserCheck size={18} />,
          iconBg: 'bg-blue-50 hover:bg-blue-100/90 text-blue-600',
          action: () => navigate('/dashboard?tab=attendance'),
        },
        {
          label: lang === 'bn' ? 'বেতন হিসাব' : 'Salary Sheet',
          icon: <Wallet size={18} />,
          iconBg: 'bg-amber-50 hover:bg-amber-100/90 text-amber-600',
          action: () => navigate('/dashboard?tab=salary'),
        },
        {
          label: lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board',
          icon: <Megaphone size={18} />,
          iconBg: 'bg-purple-50 hover:bg-purple-100/90 text-purple-600',
          action: () => {
            setActiveSettingSection('notices');
            navigate('/dashboard?tab=settings');
          },
        },
        {
          label: lang === 'bn' ? 'রিপোর্ট' : 'Reports',
          icon: <FileSpreadsheet size={18} />,
          iconBg: 'bg-rose-50 hover:bg-rose-100/90 text-rose-600',
          action: () => navigate('/dashboard?tab=report'),
        },
        {
          label: lang === 'bn' ? 'ছুটি ও ক্যালেন্ডার' : 'Holidays List',
          icon: <Calendar size={18} />,
          iconBg: 'bg-indigo-50 hover:bg-indigo-100/90 text-indigo-600',
          action: () => {
            setActiveSettingSection('holidays');
            navigate('/dashboard?tab=settings');
          },
        }
      ]
    : [
        {
          label: lang === 'bn' ? 'আমার হাজিরা লগ' : 'Att. History',
          icon: <History size={18} />,
          iconBg: 'bg-blue-50 hover:bg-blue-100/90 text-blue-600',
          action: () => navigate('/dashboard?tab=history'),
        },
        {
          label: lang === 'bn' ? 'আমার পে-স্লিপ' : 'My Payslip',
          icon: <Wallet size={18} />,
          iconBg: 'bg-amber-50 hover:bg-amber-100/90 text-amber-600',
          action: () => navigate('/dashboard?tab=salary'),
        },
        {
          label: lang === 'bn' ? 'আমার রিপোর্ট' : 'My Report',
          icon: <FileSpreadsheet size={18} />,
          iconBg: 'bg-rose-50 hover:bg-rose-100/90 text-rose-600',
          action: () => navigate('/dashboard?tab=report'),
        },
        {
          label: lang === 'bn' ? 'কোম্পানি নোটিশ' : 'Notices',
          icon: <Megaphone size={18} />,
          iconBg: 'bg-purple-50 hover:bg-purple-100/90 text-purple-600',
          action: () => {
            setActiveSettingSection('notices');
            navigate('/dashboard?tab=settings');
          },
        },
        {
          label: lang === 'bn' ? 'আমার প্রোফাইল' : 'My Profile',
          icon: <User size={18} />,
          iconBg: 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-600',
          action: () => {
            setActiveSettingSection('profile');
            navigate('/dashboard?tab=settings');
          },
        },
        {
          label: lang === 'bn' ? 'অ্যাপ ডাউনলোড' : 'Download App',
          icon: <Download size={18} />,
          iconBg: 'bg-teal-50 hover:bg-teal-100/90 text-teal-600',
          action: () => {
            setActiveSettingSection('install');
            navigate('/dashboard?tab=settings');
          },
        }
      ];

  const totalSalaryDue = employeesList.reduce((sum, emp) => {
    const isPaid = paidStatus[emp.id] || false;
    if (!isPaid) {
      const currentYM = new Date().toISOString().substring(0, 7);
      const calc = calculateMonthlySalary(emp, currentYM, holidaysList);
      return sum + calc.netPayable;
    }
    return sum;
  }, 0);

  // ── Sidebar nav items ──────────────────────────────────────────────
  const sidebarNavItems = isAdminLoggedIn
    ? [
        { tab: 'dashboard', label: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', icon: <LayoutDashboard size={17} /> },
        { tab: 'attendance', label: lang === 'bn' ? 'হাজিরা ও সমন্বয়' : 'Attendance', icon: <UserCheck size={17} /> },
        { tab: 'employees', label: lang === 'bn' ? 'কর্মকর্তা' : 'Employees', icon: <Users size={17} /> },
        { tab: 'salary', label: lang === 'bn' ? 'বেতন হিসাব' : 'Salary Sheet', icon: <Wallet size={17} /> },
        { tab: 'report', label: lang === 'bn' ? 'রিপোর্ট' : 'Reports', icon: <FileSpreadsheet size={17} /> },
        { tab: 'settings', label: lang === 'bn' ? 'সেটিংস' : 'Settings', icon: <SettingsIcon size={17} /> },
      ]
    : [
        { tab: 'dashboard', label: lang === 'bn' ? 'ড্যাশবোর্ড ও পাঞ্চ' : 'Dashboard & Punch', icon: <LayoutDashboard size={17} /> },
        { tab: 'history', label: lang === 'bn' ? 'আমার হাজিরা লগ' : 'Att. History', icon: <History size={17} /> },
        { tab: 'salary', label: lang === 'bn' ? 'আমার বেতন পে-স্লিপ' : 'My Payslip', icon: <Wallet size={17} /> },
        { tab: 'report', label: lang === 'bn' ? 'আমার রিপোর্ট' : 'My Report', icon: <FileSpreadsheet size={17} /> },
        { tab: 'settings', label: lang === 'bn' ? 'আমার প্রোফাইল' : 'My Profile', icon: <User size={17} /> },
      ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Slide-Over Drawer (md:hidden) */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          />
          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in-left">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src="/logo.svg" alt="Smart Trading Logo" className="w-9 h-9 object-contain shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-900 leading-tight">Smart Trading</p>
                  <p className="text-[9.5px] text-slate-400 font-medium">HRMS Dashboard</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Nav Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {sidebarNavItems.map(item => {
                const isActive = activeTab === item.tab;
                return (
                  <button
                    key={item.tab}
                    onClick={() => {
                      navigate(`/dashboard?tab=${item.tab}`);
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer border-0 ${
                      isActive
                        ? 'bg-brand-green/10 text-brand-green font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <span className={isActive ? 'text-brand-green' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span className="text-xs tracking-wide">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Drawer Logout */}
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer border-0 text-rose-500 hover:bg-rose-50 font-medium"
              >
                <LogOut size={18} className="text-rose-400" />
                <span className="text-xs tracking-wide">{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── LEFT SIDEBAR (desktop md+ only, full left, collapsible) ────── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-slate-200/80 sticky top-0 h-screen overflow-y-auto shadow-xs z-30 shrink-0 transition-all duration-300 select-none ${
        isSidebarCollapsed ? 'w-20' : 'w-60'
      }`}>
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-100 flex items-center transition-all ${
          isSidebarCollapsed ? 'flex-col gap-2.5 justify-center' : 'justify-between'
        }`}>
          <div className={`flex items-center gap-2.5 min-w-0 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <img src="/logo.svg" alt="Smart Trading Logo" className="w-9 h-9 object-contain shrink-0" />
            {!isSidebarCollapsed && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-xs font-black text-slate-900 leading-tight truncate">Smart Trading</p>
                <p className="text-[9.5px] text-slate-400 font-medium truncate">HRMS Dashboard</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors border-0 cursor-pointer shrink-0"
            title={isSidebarCollapsed ? (lang === 'bn' ? 'সাইডবার বড় করুন' : 'Expand Sidebar') : (lang === 'bn' ? 'সাইডবার ছোট করুন' : 'Collapse Sidebar')}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-2.5 py-3 space-y-1">
          {sidebarNavItems.map(item => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => navigate(`/dashboard?tab=${item.tab}`)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl transition-all cursor-pointer border-0 relative group ${
                  isSidebarCollapsed 
                    ? 'justify-center py-3 px-0' 
                    : 'gap-3 px-3 py-2.5 text-left'
                } ${
                  isActive
                    ? 'bg-brand-green/10 text-brand-green font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                {isActive && (
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 bg-brand-green rounded-r-full ${
                    isSidebarCollapsed ? 'w-1 h-7' : 'w-1 h-5'
                  }`} />
                )}
                <span className={`shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-brand-green' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {item.icon}
                </span>
                {!isSidebarCollapsed && (
                  <span className="text-[11.5px] tracking-wide truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout at bottom */}
        <div className={`py-4 border-t border-slate-100 ${isSidebarCollapsed ? 'px-2' : 'px-2.5'}`}>
          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? (lang === 'bn' ? 'লগআউট' : 'Logout') : undefined}
            className={`w-full flex items-center rounded-xl transition-all cursor-pointer border-0 text-rose-500 hover:bg-rose-50 font-medium ${
              isSidebarCollapsed ? 'justify-center py-3 px-0' : 'gap-3 px-3 py-2.5 text-left'
            }`}
          >
            <LogOut size={16} className="text-rose-400 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="text-[11.5px] tracking-wide">{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* ────── MAIN CONTENT AREA ────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 pt-4 pb-28 px-3 sm:px-4 md:py-6 md:px-7 max-w-7xl w-full mx-auto">

          {/* Mobile Full-Width Edge-to-Edge Header (md:hidden) */}
          <div className="md:hidden -mx-3 -mt-4 sm:-mx-4 mb-4 sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs">
            {/* Left: Mobile Drawer Trigger + Clean Logo & Brand Title */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border-0 cursor-pointer"
                title={lang === 'bn' ? 'মেনু' : 'Menu'}
              >
                <Menu size={20} />
              </button>
              <img src="/logo.svg" alt="Smart Trading Logo" className="w-8 h-8 object-contain shrink-0" />
              <div>
                <p className="text-xs font-black text-slate-900 leading-tight">Smart Trading</p>
                <p className="text-[9.5px] text-slate-500 font-medium">
                  {lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'HRMS Portal'}
                </p>
              </div>
            </div>

            {/* Right: Lang Switch, Notifications Bell, Profile Avatar */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLang}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border-0 cursor-pointer transition-colors"
                title={lang === 'bn' ? 'English এ পরিবর্তন' : 'বাংলায় দেখুন'}
              >
                {lang === 'bn' ? 'EN' : 'বাং'}
              </button>

              <button
                onClick={() => {
                  setActiveSettingSection('notices');
                  navigate('/dashboard?tab=settings');
                }}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border-0 cursor-pointer"
                title={lang === 'bn' ? 'নোটিশ ও বিজ্ঞপ্তি' : 'Notices'}
              >
                <Bell size={18} />
                {(currentEmployee ? activeEmployeeNotices.length : noticesList.length) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              <button
                onClick={() => navigate('/dashboard?tab=settings')}
                className="flex items-center p-0.5 rounded-full hover:ring-2 hover:ring-brand-green/30 transition-all border-0 bg-transparent cursor-pointer"
                title={lang === 'bn' ? 'প্রোফাইল সেটিংস' : 'Profile Settings'}
              >
                <div className="w-8 h-8 rounded-full bg-brand-green/10 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {(currentEmployee?.avatar || (!currentEmployee && adminAvatar)) ? (
                    <img src={currentEmployee?.avatar || adminAvatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={15} className="text-brand-green" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Employee Dashboard Broadcast Notices (Shown at top of Employee Dashboard) */}
          {currentEmployee && activeEmployeeNotices.length > 0 && (
            <div className="space-y-3 mb-5">
              {activeEmployeeNotices.map((not) => (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={not.id}
                  className="bg-brand-gold/10 border-l-4 border-brand-gold p-4.5 rounded-r-2xl shadow-sm flex items-start gap-3 text-slate-800"
                >
                  <Megaphone className="text-brand-gold shrink-0 w-5 h-5 mt-0.5 animate-bounce" />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-xs uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
                        <Megaphone size={12} className="text-amber-700 shrink-0" />
                        <span>{lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'} {not.type === 'Personal' && `(${lang === 'bn' ? 'ব্যক্তিগত' : 'Personal'})`}</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">{not.date}</span>
                    </div>
                    <h5 className="font-bold text-sm text-slate-900">{not.title}</h5>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">{not.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Unified Router Tab Switcher */}
          {activeTab === 'settings' ? (
              /* Settings View (Profiles, Notice Board/Creation, Holidays, and Logout button) */
              activeSettingSection === 'menu' ? (
                /* Settings Menu List View */
                <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm max-w-2xl mx-auto w-full font-sans animate-fade-in select-none">
                  <div className="pb-4 border-b border-slate-100 mb-5 flex items-center gap-3.5">
                    {currentEmployee ? (
                      <div className="w-10 h-10 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                        <User size={20} />
                      </div>
                    ) : (
                      <img src="/logo.svg" alt="Smart Trading Logo" className="w-10 h-10 object-contain shrink-0" />
                    )}
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                        {currentEmployee 
                          ? (lang === 'bn' ? 'আমার প্রোফাইল ও অ্যাকাউন্ট' : 'My Profile & Account')
                          : (lang === 'bn' ? 'সেটিংস ও কনফিগারেশন' : 'Settings & Configuration')}
                      </h4>
                      <p className="text-[10px] text-slate-450 font-bold mt-0.5 uppercase tracking-wide">
                        Smart Trading • {currentEmployee
                          ? (lang === 'bn' ? `ইউজার আইডি: ${currentEmployee.id} • ব্যক্তিগত অ্যাকাউন্ট ও সেটিংস` : `User ID: ${currentEmployee.id} • Personal Account & Settings`)
                          : (lang === 'bn' ? 'অ্যাকাউন্ট ও শপ প্যারামিটার নিয়ন্ত্রণ করুন' : 'Manage account details and shop parameters')}
                      </p>
                    </div>
                  </div>

                  {/* Profile Summary Card for Staff User ID */}
                  {currentEmployee && (() => {
                    const latestEmp = employeesList.find(e => e.id === currentEmployee.id) || currentEmployee;
                    const currentYM = new Date().toISOString().substring(0, 7);
                    const salCalc = calculateMonthlySalary(latestEmp, currentYM, holidaysList);
                    const advanceTaken = latestEmp.advanceSalary || 0;

                    return (
                      <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-slate-50 border border-emerald-200/70 space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-white border-2 border-brand-green/30 shadow-xs overflow-hidden flex items-center justify-center shrink-0">
                              {latestEmp.avatar ? (
                                <img src={latestEmp.avatar} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-brand-green/10 flex items-center justify-center text-brand-green font-extrabold text-lg">
                                  {latestEmp.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" title="Active" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-slate-800 text-sm truncate">
                                {lang === 'bn' ? (latestEmp.nameBn || latestEmp.name) : latestEmp.name}
                              </h3>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-brand-green/15 text-brand-green border border-brand-green/30">
                                {lang === 'bn' ? 'আইডি' : 'ID'}: {latestEmp.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                              <span className="font-semibold text-slate-700">{lang === 'bn' ? (latestEmp.designationBn || latestEmp.designation) : latestEmp.designation}</span>
                              <span>•</span>
                              <span className="font-medium text-slate-600 font-mono">
                                {lang === 'bn' ? `শিফট: ${latestEmp.shiftStartTime || '০৯:০০'}` : `Shift: ${latestEmp.shiftStartTime || '09:00'}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Snapshot: Salary & Advance Taken */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/50 text-[10.5px]">
                          <div className="bg-white/80 rounded-xl p-2 border border-slate-200/60 shadow-2xs">
                            <span className="text-slate-400 block text-[9px] font-bold uppercase">{lang === 'bn' ? 'মূল বেতন' : 'Basic Pay'}</span>
                            <span className="font-extrabold text-slate-800 font-mono text-xs block mt-0.5">৳{latestEmp.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                          </div>
                          <div className="bg-white/80 rounded-xl p-2 border border-rose-100 shadow-2xs">
                            <span className="text-rose-500 block text-[9px] font-bold uppercase">{lang === 'bn' ? 'অগ্রিম নিছেন' : 'Advance Taken'}</span>
                            <span className="font-extrabold text-rose-600 font-mono text-xs block mt-0.5">৳{advanceTaken.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                          </div>
                          <div className="bg-white/80 rounded-xl p-2 border border-emerald-100 shadow-2xs">
                            <span className="text-emerald-600 block text-[9px] font-bold uppercase">{lang === 'bn' ? 'চলতি প্রদেয়' : 'Net Pay'}</span>
                            <span className="font-extrabold text-emerald-700 font-mono text-xs block mt-0.5">৳{salCalc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-3.5">
                    {/* 1. Profile */}
                    <button
                      onClick={() => setActiveSettingSection('profile')}
                      className="w-full text-left bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 hover:border-slate-300/60 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
                          <User size={18} />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs block">
                            {currentEmployee 
                              ? (lang === 'bn' ? 'আমার বিস্তারিত প্রোফাইল' : 'My Detailed Profile')
                              : (lang === 'bn' ? 'আমার প্রোফাইল' : 'My Profile')}
                          </span>
                          <span className="text-[10.5px] text-slate-450 mt-0.5 block">
                            {currentEmployee
                              ? (lang === 'bn' ? 'প্রোফাইল ছবি, ব্যক্তিগত তথ্য ও লগইন পাসওয়ার্ড পরিবর্তন' : 'Manage photo, personal details and login password')
                              : (lang === 'bn' ? 'প্রোফাইল তথ্য ও অ্যাকাউন্ট বিবরণ দেখুন' : 'Verify your user details and credentials')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* 2. Shop Settings */}
                    {hasOfficeSettingsAccess && (
                      <button
                        onClick={() => setActiveSettingSection('office')}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 hover:border-slate-300/60 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
                            <Clock size={18} />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 text-xs block">
                              {lang === 'bn' ? 'শপ সেটিংস' : 'Shop Settings'}
                            </span>
                            <span className="text-[10.5px] text-slate-450 mt-0.5 block">
                              {lang === 'bn' ? 'শপ খোলার সময় ও গ্রেস পিরিয়ড নির্ধারণ করুন' : 'Configure shift hours and late entry grace periods'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                      </button>
                    )}

                    {/* 3. Holidays */}
                    {hasHolidaysAccess && (
                      <button
                        onClick={() => setActiveSettingSection('holidays')}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 hover:border-slate-300/60 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 text-xs block">
                              {lang === 'bn' ? 'ছুটি ও ক্যালেন্ডার' : 'Holidays & Calendar'}
                            </span>
                            <span className="text-[10.5px] text-slate-450 mt-0.5 block">
                              {lang === 'bn' ? 'বাৎসরিক ছুটির তালিকা ও ক্যালেন্ডার দেখুন' : 'Add or manage annual holidays list'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                      </button>
                    )}

                    {/* 4. Notices */}
                    <button
                      onClick={() => setActiveSettingSection('notices')}
                      className="w-full text-left bg-slate-50 hover:bg-slate-100/70 border border-slate-200/50 hover:border-slate-300/60 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-100 transition-colors">
                          <Megaphone size={18} />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs block">
                            {lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'}
                          </span>
                          <span className="text-[10.5px] text-slate-450 mt-0.5 block">
                            {currentEmployee
                              ? (lang === 'bn' ? 'কোম্পানির সাম্প্রতিক নোটিশ ও গুরুত্বপূর্ণ নির্দেশনা দেখুন' : 'View official company announcements & notices')
                              : (lang === 'bn' ? 'সাম্প্রতিক নোটিশ ও ঘোষণা তৈরি বা দেখুন' : 'Broadcast company announcements to staff')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-brand-green group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* 5. App Install / Download */}
                    <button
                      onClick={() => setActiveSettingSection('install')}
                      className="w-full text-left bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/60 hover:border-emerald-300 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-all">
                          <Download size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-xs block">
                              {lang === 'bn' ? 'অ্যাপ ডাউনলোড ও ইনস্টল (PWA)' : 'App Download & Install'}
                            </span>
                            <span className="text-[9px] font-bold bg-brand-green text-white px-1.5 py-0.5 rounded">
                              {isAppInstalled ? (lang === 'bn' ? 'ইনস্টলড' : 'Installed') : 'NEW'}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-slate-500 mt-0.5 block font-medium">
                            {lang === 'bn' ? 'মোবাইল বা কম্পিউটারে সরাসরি অ্যাপ ডাউনলোড করুন' : 'Install Smart Trading Shop directly on mobile or PC'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-brand-green group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* 6. Logout */}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left bg-slate-50 hover:bg-red-50/40 border border-slate-200/50 hover:border-red-200 p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-100 transition-colors">
                          <LogOut size={18} />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs block">
                            {lang === 'bn' ? 'লগ আউট' : 'Log Out'}
                          </span>
                          <span className="text-[10.5px] text-slate-450 mt-0.5 block">
                            {lang === 'bn' ? 'আপনার সেশনটি নিরাপদে বন্ধ করুন' : 'Safely exit from your current session'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Selected Settings Panel Content with Back Button */
                <div className="flex flex-col gap-6 flex-1 font-sans animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
                    <button
                      onClick={() => setActiveSettingSection('menu')}
                      className="flex items-center gap-1.5 px-3 py-1.8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 shadow-sm"
                    >
                      <ArrowRight className="rotate-180" size={14} />
                      <span>
                        {currentEmployee
                          ? (lang === 'bn' ? 'প্রোফাইল মেনুতে ফিরে যান' : 'Back to Profile Menu')
                          : (lang === 'bn' ? 'সেটিংসে ফিরে যান' : 'Back to Settings')}
                      </span>
                    </button>
                  </div>

                  <div className="flex-1">
                  
                  {/* profile section */}
                  {activeSettingSection === 'profile' && (
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-6 font-sans">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Users className="text-brand-green w-5 h-5" />
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          {currentEmployee
                            ? (lang === 'bn' ? 'আমার প্রোফাইল ও নিরাপত্তা সেটিংস' : 'My Profile & Security')
                            : (lang === 'bn' ? 'ব্যবহারকারী প্রোফাইল বিবরণ' : 'User Profile Details')}
                        </h4>
                      </div>
                      
                      {/* Profile Photo Uploader Card */}
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                        <div className="relative group">
                          <div className="w-24 h-24 rounded-full bg-white border-2 border-brand-green/20 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                            {(currentEmployee?.avatar || (!currentEmployee && adminAvatar)) ? (
                              <img 
                                src={currentEmployee?.avatar || adminAvatar} 
                                alt="Profile" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="w-full h-full bg-brand-green/10 flex items-center justify-center text-brand-green font-extrabold text-2xl font-sans">
                                {currentEmployee ? currentEmployee.name.charAt(0).toUpperCase() : 'A'}
                              </div>
                            )}
                          </div>
                          <label 
                            className="absolute bottom-0 right-0 p-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-full cursor-pointer shadow-md transition-all flex items-center justify-center"
                            title={lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change photo'}
                          >
                            <Camera size={14} />
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  compressAndResizeImage(file, (url) => {
                                    if (currentEmployee) {
                                      const updatedEmp = { ...currentEmployee, avatar: url };
                                      setCurrentEmployee(updatedEmp);
                                      localStorage.setItem('ob_logged_in_employee', JSON.stringify(updatedEmp));
                                      const updatedList = employeesList.map(emp => emp.id === currentEmployee.id ? updatedEmp : emp);
                                      setEmployeesList(updatedList);
                                      localStorage.setItem('ob_employees_list', JSON.stringify(updatedList));
                                    } else {
                                      setAdminAvatar(url);
                                      localStorage.setItem('ob_admin_avatar', url);
                                    }
                                    showAlertDialog({
                                      type: 'success',
                                      title: lang === 'bn' ? 'প্রোফাইল ছবি আপডেট' : 'Profile Photo Updated',
                                      message: lang === 'bn' ? 'প্রোফাইল ছবি সফলভাবে আপডেট করা হয়েছে!' : 'Profile picture updated successfully!'
                                    });
                                  }, (msg) => {
                                    showAlertDialog({
                                      type: 'warning',
                                      title: lang === 'bn' ? 'ভুল ফাইল' : 'Invalid File',
                                      message: msg
                                    });
                                  });
                                }
                              }} 
                            />
                          </label>
                        </div>
                        <div className="flex-1 text-center sm:text-left space-y-1.5">
                          <h5 className="font-extrabold text-slate-800 text-sm">
                            {lang === 'bn' ? 'প্রোফাইল ছবি (Profile Photo)' : 'Profile Photo'}
                          </h5>
                          <p className="text-xs text-slate-400 font-sans leading-relaxed">
                            {lang === 'bn' 
                              ? 'আপনার স্পষ্ট পাসপোর্ট বা পোর্ট্রেট ছবি যুক্ত করুন। এটি ড্যাশবোর্ড, উপস্থিতি শিট ও তালিকায় দেখা যাবে।' 
                              : 'Add or change your profile picture. It will appear on your dashboard, attendance sheet, and directory.'}
                          </p>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                            <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
                              <Upload size={13} />
                              <span>{(currentEmployee?.avatar || (!currentEmployee && adminAvatar)) ? (lang === 'bn' ? 'নতুন ছবি আপলোড' : 'Change Photo') : (lang === 'bn' ? 'ছবি আপলোড করুন' : 'Upload Photo')}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    compressAndResizeImage(file, (url) => {
                                      if (currentEmployee) {
                                        const updatedEmp = { ...currentEmployee, avatar: url };
                                        setCurrentEmployee(updatedEmp);
                                        localStorage.setItem('ob_logged_in_employee', JSON.stringify(updatedEmp));
                                        const updatedList = employeesList.map(emp => emp.id === currentEmployee.id ? updatedEmp : emp);
                                        setEmployeesList(updatedList);
                                        localStorage.setItem('ob_employees_list', JSON.stringify(updatedList));
                                      } else {
                                        setAdminAvatar(url);
                                        localStorage.setItem('ob_admin_avatar', url);
                                      }
                                      showAlertDialog({
                                        type: 'success',
                                        title: lang === 'bn' ? 'প্রোফাইল ছবি আপডেট' : 'Profile Photo Updated',
                                        message: lang === 'bn' ? 'প্রোফাইল ছবি সফলভাবে আপডেট করা হয়েছে!' : 'Profile picture updated successfully!'
                                      });
                                    }, (msg) => {
                                      showAlertDialog({
                                        type: 'warning',
                                        title: lang === 'bn' ? 'ভুল ফাইল' : 'Invalid File',
                                        message: msg
                                      });
                                    });
                                  }
                                }} 
                              />
                            </label>
                            {(currentEmployee?.avatar || (!currentEmployee && adminAvatar)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  showConfirmDialog({
                                    type: 'danger',
                                    title: lang === 'bn' ? 'ছবি অপসারণ নিশ্চিতকরণ' : 'Remove Profile Picture',
                                    message: lang === 'bn' ? 'আপনি কি প্রোফাইল ছবি মুছে ফেলতে চান?' : 'Are you sure you want to remove your profile picture?',
                                    confirmText: lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Remove',
                                    onConfirm: () => {
                                      if (currentEmployee) {
                                        const updatedEmp = { ...currentEmployee, avatar: undefined };
                                        setCurrentEmployee(updatedEmp);
                                        localStorage.setItem('ob_logged_in_employee', JSON.stringify(updatedEmp));
                                        const updatedList = employeesList.map(emp => emp.id === currentEmployee.id ? updatedEmp : emp);
                                        setEmployeesList(updatedList);
                                        localStorage.setItem('ob_employees_list', JSON.stringify(updatedList));
                                      } else {
                                        setAdminAvatar('');
                                        localStorage.removeItem('ob_admin_avatar');
                                      }
                                      showAlertDialog({
                                        type: 'success',
                                        title: lang === 'bn' ? 'ছবি অপসারিত' : 'Picture Removed',
                                        message: lang === 'bn' ? 'প্রোফাইল ছবি সফলভাবে মুছে ফেলা হয়েছে।' : 'Profile picture removed successfully.'
                                      });
                                    }
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold cursor-pointer transition-all border border-rose-200/50"
                              >
                                <Trash2 size={13} />
                                <span>{lang === 'bn' ? 'ছবি মুছুন' : 'Remove Photo'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 1: Personal & Employment Details */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                          <User size={14} className="text-brand-green" />
                          <span>{lang === 'bn' ? 'ব্যক্তিগত ও অফিসিয়াল পরিচিতি' : 'Personal & Employment Details'}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/60 text-xs">
                          <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">{lang === 'bn' ? 'কর্মকর্তার নাম' : 'Name'}</span>
                            <span className="font-bold text-slate-800 text-sm block">
                              {currentEmployee 
                                ? (lang === 'bn' ? (currentEmployee.nameBn || currentEmployee.name) : currentEmployee.name) 
                                : (lang === 'bn' ? 'স্মার্ট ট্রেডিং এডমিন' : 'Smart Trading Admin')}
                            </span>
                            {currentEmployee?.nameBn && (
                              <span className="text-[10px] text-slate-450 block font-medium">{currentEmployee.name}</span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">{lang === 'bn' ? 'ইউজার / কর্মী আইডি' : 'Employee ID'}</span>
                            <span className="font-bold text-brand-green font-mono text-sm block">
                              {currentEmployee ? currentEmployee.id : 'ADMIN-01'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">{lang === 'bn' ? 'পদবি ও দায়িত্ব' : 'Designation'}</span>
                            <span className="font-bold text-slate-800 text-xs block">
                              {currentEmployee 
                                ? (lang === 'bn' ? currentEmployee.designationBn : currentEmployee.designation) 
                                : (lang === 'bn' ? 'প্রধান প্রশাসক' : 'System Admin')}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">{lang === 'bn' ? 'নির্ধারিত ডিউটি শিফট' : 'Duty Shift'}</span>
                            <span className="font-bold text-slate-700 font-mono text-xs block">
                              {currentEmployee ? `${currentEmployee.shiftStartTime || '09:00'} AM` : '১০:০০ AM - ০৭:০০ PM'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}</span>
                            <span className="font-bold text-slate-700 font-mono text-xs block">
                              {currentEmployee ? currentEmployee.joiningDate : '২০২৪-০১-০১'}
                            </span>
                          </div>

                          <div className="sm:col-span-2 md:col-span-3 space-y-1 pt-2 border-t border-slate-200/50">
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">{lang === 'bn' ? 'অফিসিয়াল ইমেইল এড্রেস' : 'Official Email'}</span>
                            <span className="font-bold text-slate-700 font-mono text-xs">
                              {currentEmployee ? currentEmployee.email : 'admin@smarttrading.com'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Salary Structure & Financial Details (কত কি বেতন পায়, কত টাকা নিছে) */}
                      {currentEmployee && (() => {
                        const latestEmp = employeesList.find(e => e.id === currentEmployee.id) || currentEmployee;
                        const currentYM = new Date().toISOString().substring(0, 7);
                        const salCalc = calculateMonthlySalary(latestEmp, currentYM, holidaysList);
                        const isPaid = paidStatus[latestEmp.id] || false;
                        const advanceTaken = latestEmp.advanceSalary || 0;
                        const allowances = latestEmp.allowances || 0;
                        const fixedDeductions = latestEmp.deductions || 0;

                        return (
                          <div className="space-y-3 pt-2 border-t border-slate-100">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                <Wallet size={15} className="text-brand-green" />
                                <span>{lang === 'bn' ? 'বেতন কাঠামো ও আর্থিক বিবরণী (চলতি মাস)' : 'Salary & Financial Status'}</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {isPaid ? (lang === 'bn' ? '✓ চলতি মাসের বেতন পরিশোধিত' : 'Paid') : (lang === 'bn' ? '⏳ চলতি মাসের হিসাব চলমান' : 'Processing')}
                              </span>
                            </div>

                            {/* 4 Financial Highlight Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {/* 1. Base Salary */}
                              <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-2xl space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                  {lang === 'bn' ? 'মূল বেতন (Basic)' : 'Basic Salary'}
                                </span>
                                <div className="text-base sm:text-lg font-black text-slate-800 font-mono">
                                  ৳{latestEmp.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </div>
                                <span className="text-[10px] text-slate-450 block">
                                  {lang === 'bn' ? `দৈনিক হার: ৳${Math.round(salCalc.dailyRate)}` : `Daily: ৳${Math.round(salCalc.dailyRate)}`}
                                </span>
                              </div>

                              {/* 2. Monthly Allowances */}
                              <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-2xl space-y-1">
                                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
                                  {lang === 'bn' ? 'মাসিক ভাতা (Allowances)' : 'Allowances'}
                                </span>
                                <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                                  +৳{allowances.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </div>
                                <span className="text-[10px] text-emerald-600 block">
                                  {lang === 'bn' ? 'নিয়মিত মাসিক যোগ' : 'Regular Added'}
                                </span>
                              </div>

                              {/* 3. Advance Taken (কত টাকা নিছে!) */}
                              <div className="bg-rose-50/60 border border-rose-100 p-3.5 rounded-2xl space-y-1">
                                <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider block">
                                  {lang === 'bn' ? 'অগ্রিম নিছেন (Advance)' : 'Advance Taken'}
                                </span>
                                <div className="text-base sm:text-lg font-black text-rose-600 font-mono">
                                  ৳{advanceTaken.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </div>
                                <span className="text-[10px] text-rose-500 font-medium block">
                                  {advanceTaken > 0 ? (lang === 'bn' ? 'বেতন থেকে কর্তনযোগ্য' : 'Deductible') : (lang === 'bn' ? 'কোনো অগ্রিম নেওয়া হয়নি' : 'No Advance')}
                                </span>
                              </div>

                              {/* 4. Net Payable */}
                              <div className="bg-emerald-500/10 border border-emerald-300/80 p-3.5 rounded-2xl space-y-1">
                                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
                                  {lang === 'bn' ? 'প্রদেয় নিট বেতন' : 'Net Payable'}
                                </span>
                                <div className="text-base sm:text-lg font-black text-emerald-800 font-mono">
                                  ৳{salCalc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </div>
                                <span className="text-[10px] text-emerald-700 font-medium block">
                                  {lang === 'bn' ? 'হাজিরা ও সমন্বয় শেষে' : 'After adjustments'}
                                </span>
                              </div>
                            </div>

                            {/* Detailed Breakdown Statement Table */}
                            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                              <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                <span className="font-extrabold text-slate-700 text-xs">
                                  {lang === 'bn' ? 'চলতি মাসের বেতন ও কর্তন সমন্বয় হিসাব' : 'Payroll Reconciliation Details'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => navigate('/dashboard?tab=salary')}
                                  className="text-[11px] font-bold text-brand-green hover:underline flex items-center gap-1 cursor-pointer border-0 bg-transparent"
                                >
                                  <span>{lang === 'bn' ? 'সম্পূর্ণ পে-স্লিপ দেখুন' : 'View Full Payslip'}</span>
                                  <ChevronRight size={13} />
                                </button>
                              </div>
                              <table className="w-full text-xs text-left font-sans">
                                <tbody className="divide-y divide-slate-100">
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2 text-slate-600">{lang === 'bn' ? 'মূল মাসিক বেতন (Basic)' : 'Basic Salary'}</td>
                                    <td className="px-4 py-2 text-right font-bold text-slate-800 font-mono">৳{latestEmp.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                                  </tr>
                                  {allowances > 0 && (
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2 text-slate-600">{lang === 'bn' ? 'মাসিক নিয়মিত ভাতা (Allowances)' : 'Allowances'}</td>
                                      <td className="px-4 py-2 text-right font-bold text-emerald-600 font-mono">+ ৳{allowances.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                                    </tr>
                                  )}
                                  {fixedDeductions > 0 && (
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2 text-slate-600">{lang === 'bn' ? 'মাসিক নির্ধারিত কর্তন' : 'Fixed Deductions'}</td>
                                      <td className="px-4 py-2 text-right font-bold text-rose-600 font-mono">- ৳{fixedDeductions.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                                    </tr>
                                  )}
                                  <tr className="hover:bg-slate-50/50 bg-rose-50/20">
                                    <td className="px-4 py-2 text-rose-800 font-medium">
                                      {lang === 'bn' ? 'গৃহীত অগ্রিম বেতন কর্তন (Advance Cut)' : 'Advance Salary Cut'}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-rose-600 font-mono">
                                      {advanceTaken > 0 ? `- ৳${advanceTaken.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}` : '৳০ (নেই)'}
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2 text-slate-600">
                                      {lang === 'bn' ? 'অনুপস্থিতির জন্য কর্তন' : 'Absent Deduction'} ({salCalc.absentDaysCount} দিন)
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-rose-600 font-mono">
                                      - ৳{Math.round(salCalc.absentDeduction).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2 text-slate-600">
                                      {lang === 'bn' ? 'বিলম্ব হাজিরা কর্তন (৩ দিনে ১ দিন)' : 'Late Entry Cut'} ({salCalc.lateCount} দিন লেট)
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-amber-600 font-mono">
                                      - ৳{Math.round(salCalc.lateDeduction).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                    </td>
                                  </tr>
                                  {salCalc.otPay > 0 && (
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2 text-slate-600">
                                        {lang === 'bn' ? 'ওভারটাইম আয় (OT)' : 'Overtime Pay'} ({salCalc.otHours} ঘণ্টা)
                                      </td>
                                      <td className="px-4 py-2 text-right font-bold text-emerald-600 font-mono">
                                        + ৳{Math.round(salCalc.otPay).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                      </td>
                                    </tr>
                                  )}
                                  {salCalc.fridayBonus > 0 && (
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2 text-slate-600">
                                        {lang === 'bn' ? 'শুক্রবারের বিশেষ হাজিরা বোনাস' : 'Friday Worked Bonus'}
                                      </td>
                                      <td className="px-4 py-2 text-right font-bold text-emerald-600 font-mono">
                                        + ৳{Math.round(salCalc.fridayBonus).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="bg-emerald-50/60 font-bold">
                                    <td className="px-4 py-2.5 text-emerald-900 text-xs">
                                      {lang === 'bn' ? 'চলতি মাসে সর্বমোট প্রদেয় বেতন (Net Payable)' : 'Total Net Payable'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-black text-emerald-800 text-sm font-mono">
                                      ৳{salCalc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Section 3: Password Change */}
                      {currentEmployee && (
                        <div className="pt-3 border-t border-slate-100">
                          <span className="text-slate-400 block font-bold uppercase text-[9px] mb-1.5">
                            {lang === 'bn' ? 'লগইন পাসওয়ার্ড পরিবর্তন' : 'Change Login Password'}
                          </span>
                          <div className="flex flex-col sm:flex-row items-center gap-2.5 max-w-md">
                            <div className="flex-1 w-full flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                              <span className="pl-3 text-slate-400">
                                <Lock size={13} />
                              </span>
                              <input
                                type={showEditPassword ? 'text' : 'password'}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="নতুন পাসওয়ার্ড লিখুন"
                                className="flex-1 bg-transparent px-2.5 py-2 text-xs outline-none font-bold text-slate-800 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditPassword(!showEditPassword)}
                                className="px-2.5 py-2 text-slate-400 hover:text-slate-600 cursor-pointer border-0 bg-transparent"
                                title={showEditPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide') : (lang === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show')}
                              >
                                {showEditPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!editPassword.trim()) {
                                  showAlertDialog({
                                    type: 'warning',
                                    title: lang === 'bn' ? 'পাসওয়ার্ড আবশ্যক' : 'Password Required',
                                    message: lang === 'bn' ? 'পাসওয়ার্ড খালি হতে পারবে না!' : 'Password cannot be empty!'
                                  });
                                  return;
                                }
                                const updatedEmp = { ...currentEmployee, password: editPassword.trim() };
                                setCurrentEmployee(updatedEmp);
                                localStorage.setItem('ob_logged_in_employee', JSON.stringify(updatedEmp));
                                const updatedList = employeesList.map(e => e.id === currentEmployee.id ? updatedEmp : e);
                                setEmployeesList(updatedList);
                                localStorage.setItem('ob_employees_list', JSON.stringify(updatedList));
                                showAlertDialog({
                                  type: 'success',
                                  title: lang === 'bn' ? 'পাসওয়ার্ড সংরক্ষিত' : 'Password Saved',
                                  message: lang === 'bn' ? 'লগইন পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে!' : 'Login password updated successfully!'
                                });
                              }}
                              className="w-full sm:w-auto bg-brand-green hover:bg-brand-green-dark text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs border-0 cursor-pointer shrink-0"
                            >
                              {lang === 'bn' ? 'পাসওয়ার্ড সেভ করুন' : 'Save Password'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* shop settings section */}
                  {activeSettingSection === 'office' && hasOfficeSettingsAccess && (
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-6 font-sans">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Clock className="text-brand-green w-5 h-5" />
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          {lang === 'bn' ? 'শপ সময়, হাজিরা ও লোকেশন (GPS) সেটিংস' : 'Shop Timing, Attendance & GPS Location'}
                        </h4>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          localStorage.setItem('ob_office_settings', JSON.stringify({
                            checkInTime: officeStartTime,
                            gracePeriod: officeGracePeriod,
                            lat: officeLat,
                            lng: officeLng,
                            radius: officeRadius
                          }));
                          showAlertDialog({
                            type: 'success',
                            title: lang === 'bn' ? 'শপ সেটিংস সংরক্ষিত' : 'Settings Saved',
                            message: lang === 'bn' ? 'শপ সময় ও জিপিএস লোকেশন সফলভাবে আপডেট করা হয়েছে!' : 'Shop timing and GPS location updated successfully!'
                          });
                        }}
                        className="space-y-5 text-xs font-sans"
                      >
                        {/* Shift and grace period */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                              {lang === 'bn' ? 'ডিফল্ট শপ খোলার সময় (Shop Start Time)' : 'Default Shop Start Time'}
                            </label>
                            <input
                              type="time"
                              value={officeStartTime}
                              onChange={(e) => setOfficeStartTime(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                              required
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              {lang === 'bn' ? '* প্রতিটি কর্মকর্তার জন্য আলাদা ডিউটি শুরুর সময়ও প্রোফাইল থেকে নির্ধারণ করা যায়।' : '* Individual duty times can also be set per employee profile.'}
                            </p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                              {lang === 'bn' ? 'বিলম্ব প্রবেশের অনুমতি (Grace Period - মিনিট)' : 'Grace Period (Minutes)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="120"
                              value={officeGracePeriod}
                              onChange={(e) => setOfficeGracePeriod(Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                              required
                            />
                          </div>
                        </div>

                        {/* GPS Geofence Configuration */}
                        <div className="bg-slate-50/80 border border-slate-200 p-5 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-emerald-600 shrink-0" />
                              <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                                {lang === 'bn' ? 'শপ লোকেশন ও জিওফেন্সিং (১০ মিটার পরিধি)' : 'Shop GPS Geofencing (10m Radius)'}
                              </h5>
                            </div>
                            <button
                              type="button"
                              disabled={locatingCurrentGps}
                              onClick={handleGetDeviceCurrentLocation}
                              className="bg-emerald-50 hover:bg-emerald-100 text-brand-green border border-emerald-200/80 px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer transition-all flex items-center gap-1.5"
                            >
                              {locatingCurrentGps ? (
                                <div className="w-3.5 h-3.5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Crosshair size={13} className="text-brand-green shrink-0" />
                              )}
                              <span>{lang === 'bn' ? 'আমার বর্তমান GPS সেট করুন' : 'Set Current GPS Location'}</span>
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                            {lang === 'bn'
                              ? 'কর্মকর্তারা শুধুমাত্র এই শপ লোকেশনের ১০ মিটার (বা নির্ধারিত পরিধির) মধ্যে অবস্থান করলেই উপস্থিতি প্রদান করতে পারবেন। এর বাইরে থেকে হাজিরা দিলে সিস্টেম স্বয়ংক্রিয়ভাবে ব্লক করবে।'
                              : 'Employees can only check in within 10 meters of this shop location. Check-in outside this radius will be blocked.'}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                {lang === 'bn' ? 'অক্ষাংশ (Latitude)' : 'Latitude'}
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={officeLat}
                                onChange={(e) => setOfficeLat(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="e.g. 23.792500"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-mono font-bold text-slate-800"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                {lang === 'bn' ? 'দ্রাঘিমাংশ (Longitude)' : 'Longitude'}
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={officeLng}
                                onChange={(e) => setOfficeLng(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="e.g. 90.407800"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-mono font-bold text-slate-800"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                {lang === 'bn' ? 'অনুমোদিত পরিধি (মিটার)' : 'Allowed Radius (Meters)'}
                              </label>
                              <input
                                type="number"
                                min="5"
                                max="200"
                                value={officeRadius}
                                onChange={(e) => setOfficeRadius(Number(e.target.value))}
                                placeholder="10"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-brand-green"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        {/* Policy Summary card */}
                        <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-2xl space-y-1.5">
                          <span className="font-bold text-slate-800 text-xs block">
                            ℹ️ {lang === 'bn' ? 'স্মার্ট ট্রেডিং বেতন ও হাজিরা বিধিমালা' : 'Smart Trading HR & Payroll Rules'}
                          </span>
                          <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                            <li>{lang === 'bn' ? 'শুক্রবার বেতন সহকারে ছুটি। তবে কোনো কর্মকর্তা শুক্রবারে কাজ করলে অতিরিক্ত ১ দিনের বেতন বোনাস পাবেন।' : 'Friday is a paid holiday. Working on Friday earns +1 day extra salary.'}</li>
                            <li>{lang === 'bn' ? 'মাসে যেকোনো ৩ দিন লেট হলে ১ দিনের সম্পূর্ণ মূল বেতন কর্তন করা হবে।' : 'Every 3 late arrivals in a month results in 1 full day salary deduction.'}</li>
                            <li>{lang === 'bn' ? 'নির্ধারিত ডিউটি সময়ের অতিরিক্ত কাজ করলে স্বয়ংক্রিয়ভাবে ওভারটাইম প্রাপ্য হবেন।' : 'Working beyond regular daily shift hours earns overtime pay.'}</li>
                            <li>{lang === 'bn' ? 'শপ লোকেশনের ১০ মিটারের বাইরে অবস্থান করলে হাজিরা প্রদান নিষিদ্ধ।' : 'Check-in is prohibited outside the 10-meter shop perimeter.'}</li>
                          </ul>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="bg-brand-green hover:bg-brand-green-dark text-white rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm border-0 font-sans"
                          >
                            {lang === 'bn' ? 'নীতিমালা ও লোকেশন সংরক্ষণ করুন' : 'Save Settings & Location'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* App Download / Install Section */}
                  {activeSettingSection === 'install' && (
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-6 font-sans">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <img src="/logo.svg" alt="Smart Trading Logo" className="w-10 h-10 object-contain shrink-0" />
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                              {lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ অ্যাপ ইনস্টল করুন' : 'Install Smart Trading Shop App'}
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              {lang === 'bn' ? 'ব্রাউজার ছাড়াই দ্রুত ও সহজে ব্যবহার করুন' : 'Fast, native-like experience without browser address bar'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isAppInstalled ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isAppInstalled ? (lang === 'bn' ? 'ইতিমধ্যে ইনস্টল করা' : 'Already Installed') : (lang === 'bn' ? 'ইনস্টল যোগ্য' : 'Ready to Install')}
                        </span>
                      </div>

                      {/* Main Action Banner */}
                      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm">
                        <div className="space-y-1.5 text-center sm:text-left">
                          <h5 className="font-black text-base text-white">
                            {lang === 'bn' ? 'মোবাইল ও পিসিতে সরাসরি অ্যাপ ডাউনলোড' : 'Direct App Download & Install'}
                          </h5>
                          <p className="text-xs text-slate-300 max-w-md">
                            {lang === 'bn'
                              ? 'এক ক্লিকেই আপনার হোম স্ক্রিনে বা ডেস্কটপে স্মার্ট ট্রেডিং শপ অ্যাপ যুক্ত করুন। প্লে-স্টোর বা অ্যাপ-স্টোর ছাড়াই স্বয়ংক্রিয় আপডেট।'
                              : 'Add Smart Trading Shop to your Home Screen or Desktop with one click. Automatic updates without any store.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleInstallApp}
                          className="flex items-center gap-2 bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer border-0 shrink-0"
                        >
                          <Download size={16} />
                          <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল / ডাউনলোড করুন' : 'Install App Now'}</span>
                        </button>
                      </div>

                      {/* Step-by-step Installation Guides */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 border border-slate-200/80 p-4.5 rounded-2xl space-y-2.5">
                          <div className="flex items-center gap-2 text-slate-800">
                            <Monitor size={18} className="text-brand-green" />
                            <h6 className="font-extrabold text-xs">
                              {lang === 'bn' ? '১. কম্পিউটার (Desktop / PC)' : '1. Desktop / PC'}
                            </h6>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {lang === 'bn'
                              ? 'গুগল ক্রোম বা এজ ব্রাউজারের উপরে অ্যাড্রেস বারের ডানপাশে "Install" বাটনে ক্লিক করুন অথবা উপরের সবুজ বাটনে চাপ দিন।'
                              : 'Click the "Install" button in the address bar in Chrome/Edge or click the button above.'}
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/80 p-4.5 rounded-2xl space-y-2.5">
                          <div className="flex items-center gap-2 text-slate-800">
                            <Smartphone size={18} className="text-brand-green" />
                            <h6 className="font-extrabold text-xs">
                              {lang === 'bn' ? '২. অ্যান্ড্রয়েড ফোন (Android)' : '2. Android Phone'}
                            </h6>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {lang === 'bn'
                              ? 'ক্রোম ব্রাউজারের উপরে ডানদিকের তিনটি ডট (⋮) এ ট্যাপ করে "Install app" বা "Add to Home screen" নির্বাচন করুন।'
                              : 'Tap the 3-dot menu (⋮) in Chrome and select "Install app" or "Add to Home screen".'}
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/80 p-4.5 rounded-2xl space-y-2.5">
                          <div className="flex items-center gap-2 text-slate-800">
                            <Smartphone size={18} className="text-brand-green" />
                            <h6 className="font-extrabold text-xs">
                              {lang === 'bn' ? '৩. আইফোন (iOS Safari)' : '3. iPhone / iPad'}
                            </h6>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {lang === 'bn'
                              ? 'সাফারি ব্রাউজারের নিচে থাকা "Share" (শেয়ার) আইকনে চাপুন এবং নিচে স্ক্রোল করে "Add to Home Screen" এ ক্লিক করুন।'
                              : 'Tap the "Share" icon in Safari and scroll down to select "Add to Home Screen".'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* holidays section */}
                  {activeSettingSection === 'holidays' && hasHolidaysAccess && (
                    <div className="space-y-6">
                      {/* Form to Add Custom Holiday */}
                      <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                          <PlusCircle className="text-brand-green w-5 h-5" />
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'ছুটির দিন যুক্ত করুন' : 'Add Custom Holiday'}
                          </h4>
                        </div>

                        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans items-end text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                              {lang === 'bn' ? 'তারিখ' : 'Date'}
                            </label>
                            <input
                              type="date"
                              value={newHolidayDate}
                              onChange={(e) => setNewHolidayDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                              {lang === 'bn' ? 'ছুটির নাম (ইংরেজি)' : 'Holiday Name (EN)'}
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Independence Day"
                              value={newHolidayName}
                              onChange={(e) => setNewHolidayName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                              {lang === 'bn' ? 'ছুটির নাম (বাংলা)' : 'Holiday Name (BN)'}
                            </label>
                            <input
                              type="text"
                              placeholder="যেমন: স্বাধীনতা দিবস"
                              value={newHolidayNameBn}
                              onChange={(e) => setNewHolidayNameBn(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none"
                              required
                            />
                          </div>

                          <div>
                            <button
                              type="submit"
                              className="w-full bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-2 px-4 font-bold uppercase tracking-wider text-[11px] cursor-pointer shadow-md border-0 h-[36px]"
                            >
                              {lang === 'bn' ? 'ছুটি যোগ করুন' : 'Add Holiday'}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Holidays List Card */}
                      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[300px]">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                          <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'ছুটির দিন ও ক্যালেন্ডার তালিকা' : 'Holidays & Calendar List'}
                          </span>
                          <span className="text-[10px] bg-brand-green/10 text-brand-green px-3 py-1 rounded-full font-bold">
                            {holidaysList.length} {lang === 'bn' ? 'ছুটির দিন' : 'Holidays'}
                          </span>
                        </div>

                        <div className="overflow-y-auto flex-1 min-h-0">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-100">
                              <tr>
                                <th className="px-5 py-3.5">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                                <th className="px-5 py-3.5">{lang === 'bn' ? 'ছুটির নাম' : 'Holiday Name'}</th>
                                <th className="px-5 py-3.5 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-650 font-sans">
                              {holidaysList.map((hol) => (
                                <tr key={hol.date} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="px-5 py-3.5 font-bold text-slate-800">{hol.date}</td>
                                  <td className="px-5 py-3.5 font-medium">{lang === 'bn' ? hol.nameBn : hol.name}</td>
                                  <td className="px-5 py-3.5 text-right">
                                    <button
                                      onClick={() => handleDeleteHoliday(hol.date)}
                                      className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border-0"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {holidaysList.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                                    {lang === 'bn' ? 'কোনো ছুটির দিন যোগ করা হয়নি।' : 'No holidays configured.'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* notices section */}
                  {activeSettingSection === 'notices' && (
                    <div className="space-y-6">
                      
                      {/* Notice Creator (Only visible to Admin) */}
                      {hasNoticesAdminAccess && (
                        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
                          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <Megaphone className="text-brand-green w-5 h-5" />
                            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                              {lang === 'bn' ? 'নতুন নোটিশ জারি করুন' : 'Publish New Notice'}
                            </h4>
                          </div>

                          <form onSubmit={handleAddNotice} className="space-y-4 text-xs font-sans">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                  {lang === 'bn' ? 'নোটিশের শিরোনাম' : 'Notice Title'}
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Eid Vacation Announcement"
                                  value={newNoticeTitle}
                                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                  {lang === 'bn' ? 'গ্রহীতা (Audience)' : 'Audience Type'}
                                </label>
                                <select
                                  value={newNoticeType}
                                  onChange={(e) => setNewNoticeType(e.target.value as 'All' | 'Personal')}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold font-sans"
                                >
                                  <option value="All">{lang === 'bn' ? 'সকলকে (All)' : 'All Employees'}</option>
                                  <option value="Personal">{lang === 'bn' ? 'নির্দিষ্ট কর্মচারীকে (Personal)' : 'Specific Employee'}</option>
                                </select>
                              </div>
                            </div>

                            {newNoticeType === 'Personal' && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                  {lang === 'bn' ? 'কর্মচারী নির্বাচন করুন' : 'Select Target Employee'}
                                </label>
                                <select
                                  value={newNoticeTarget}
                                  onChange={(e) => setNewNoticeTarget(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-sans"
                                  required={newNoticeType === 'Personal'}
                                >
                                  <option value="">{lang === 'bn' ? '-- নির্বাচন করুন --' : '-- Select Employee --'}</option>
                                  {employeesList.map(e => (
                                    <option key={e.id} value={e.id}>
                                      {lang === 'bn' ? `${e.nameBn} (${e.id})` : `${e.name} (${e.id})`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                                {lang === 'bn' ? 'নোটিশের বিস্তারিত বিবরণ' : 'Notice Details'}
                              </label>
                              <textarea
                                rows={3}
                                placeholder={lang === 'bn' ? 'এখানে নোটিশের বিবরণ লিখুন...' : 'Write notice details here...'}
                                value={newNoticeContent}
                                onChange={(e) => setNewNoticeContent(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none resize-none font-sans"
                                required
                              />
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="bg-brand-green hover:bg-brand-green-dark text-white rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm flex items-center gap-1.5 border-0 font-sans"
                              >
                                <Bell size={13} />
                                <span>{lang === 'bn' ? 'নোটিশ জারি করুন' : 'Publish Notice'}</span>
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Notices List Board */}
                      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[300px]">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                          <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'নোটিশ বোর্ড তালিকা' : 'Notice Board List'}
                          </span>
                          <span className="text-[10px] bg-brand-green/10 text-brand-green px-2.5 py-1 rounded-full font-bold font-sans">
                            {hasNoticesAdminAccess ? noticesList.length : noticesList.filter(n => n.type === 'All' || n.targetEmpId === currentEmployee?.id).length} {lang === 'bn' ? 'নোটিশ' : 'Notices'}
                          </span>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                          {(hasNoticesAdminAccess ? noticesList : noticesList.filter(n => n.type === 'All' || n.targetEmpId === currentEmployee?.id)).map((not) => (
                            <div 
                              key={not.id} 
                              onClick={() => setSelectedNoticeDetails(not)}
                              className="border border-slate-100 rounded-2xl p-4 flex justify-between items-start gap-4 hover:border-brand-green hover:bg-slate-50/20 transition-all cursor-pointer shadow-sm group"
                            >
                              <div className="space-y-1 flex-1 font-sans">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold ${
                                    not.type === 'All' 
                                      ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
                                      : 'bg-brand-gold/10 text-amber-800 border border-brand-gold/20'
                                  }`}>
                                    {not.type === 'All' ? (
                                      <>
                                        <Megaphone size={9} className="shrink-0" />
                                        <span>{lang === 'bn' ? 'সকলকে' : 'All'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Lock size={9} className="shrink-0" />
                                        <span>{lang === 'bn' ? `ব্যক্তিগত: ${not.targetEmpId}` : `Personal: ${not.targetEmpId}`}</span>
                                      </>
                                    )}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">{not.date}</span>
                                </div>
                                <h5 className="font-bold text-slate-800 text-sm group-hover:text-brand-green transition-colors">{not.title}</h5>
                                <p className="text-xs text-slate-400 leading-relaxed truncate max-w-xl">{not.content}</p>
                              </div>

                              {hasNoticesAdminAccess ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNotice(not.id);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border-0"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 group-hover:text-brand-green font-bold shrink-0 self-center flex items-center gap-1">
                                  <span>{lang === 'bn' ? 'দেখুন' : 'View'}</span>
                                  <ArrowRight size={11} />
                                </span>
                              )}
                            </div>
                          ))}
                          {(hasNoticesAdminAccess ? noticesList : noticesList.filter(n => n.type === 'All' || n.targetEmpId === currentEmployee?.id)).length === 0 && (
                            <div className="text-center py-8 text-slate-400 font-sans">
                              {lang === 'bn' ? 'কোনো নোটিশ নেই।' : 'No notices.'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* logout section */}
                  {activeSettingSection === 'logout' && (
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-4 font-sans">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <LogOut className="text-red-500 w-5 h-5" />
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          {lang === 'bn' ? 'সিস্টেম অ্যাকশন' : 'System Actions'}
                        </h4>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4.5 bg-red-50 border border-red-100 rounded-2xl">
                        <div className="space-y-0.5 text-center sm:text-left">
                          <span className="font-bold text-slate-800 text-sm block">
                            {lang === 'bn' ? 'পোর্টাল সেশন অবসান' : 'Terminate Session'}
                          </span>
                          <span className="text-xs text-slate-550 block leading-relaxed">
                            {lang === 'bn' ? 'পোর্টাল থেকে লগআউট করতে ও সেশন মেমোরি পরিষ্কার করতে এই বোতামে ক্লিক করুন।' : 'Logout from the portal and clear current session memory.'}
                          </span>
                        </div>

                        <button
                          onClick={handleLogout}
                          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-md uppercase text-xs tracking-widest cursor-pointer text-center block border-0 shrink-0 font-sans"
                        >
                          {lang === 'bn' ? 'লগআউট করুন' : 'Log Out'}
                        </button>
                      </div>
                    </div>
                  )}

                  </div>
                </div>
              )
            ) : activeTab === 'report' ? (
              /* Reports View (Bilingual search filter, KPI summaries, detailed daily log table & print ready layout) */
              <div className="space-y-6 font-sans">
                {/* Search / Filter Card */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4 print:hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <ClipboardList className="text-brand-green w-5 h-5" />
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                          {lang === 'bn' ? 'হাজিরা ও লেট হিসাব অনুসন্ধান' : 'Attendance & Late Report Search'}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {lang === 'bn' 
                            ? 'যেকোনো কর্মকর্তার মাসওয়ারি হাজিরা, বিলম্ব (Late), ওভারটাইম ও কর্তন বিবরণী' 
                            : 'View monthly attendance, late check-ins, overtime, and salary deductions'}
                        </p>
                      </div>
                    </div>

                    {generatedReportLogs && (
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer border-0 shrink-0"
                        title={lang === 'bn' ? 'রিপোর্ট প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন' : 'Print or Save Report as PDF'}
                      >
                        <Printer size={14} />
                        <span>{lang === 'bn' ? 'প্রিন্ট / সেভ PDF' : 'Print / Save PDF'}</span>
                      </button>
                    )}
                  </div>

                  <form onSubmit={generateAttendanceReport} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end text-xs font-sans">
                    {isAdminLoggedIn ? (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          {lang === 'bn' ? 'কর্মকর্তা নির্বাচন' : 'Select Employee'}
                        </label>
                        <select
                          value={reportEmpId}
                          onChange={(e) => setReportEmpId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                          required
                        >
                          <option value="">{lang === 'bn' ? '-- কর্মকর্তা নির্বাচন করুন --' : '-- Select Employee --'}</option>
                          {employeesList.map(e => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({e.id}) - শিফট: {e.shiftStartTime || '09:00'}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                          {lang === 'bn' ? 'কর্মকর্তা' : 'Employee'}
                        </label>
                        <input
                          type="text"
                          value={currentEmployee ? `${currentEmployee.name} (${currentEmployee.id})` : ''}
                          disabled
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 font-bold outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'মাস' : 'Month'}
                      </label>
                      <select
                        value={reportMonth}
                        onChange={(e) => setReportMonth(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                      >
                        {Array.from({ length: 12 }, (_, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {lang === 'bn' 
                              ? ['জানুয়ারী', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][idx]
                              : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][idx]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'বছর' : 'Year'}
                      </label>
                      <select
                        value={reportYear}
                        onChange={(e) => setReportYear(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                      >
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                        <option value={2026}>2026</option>
                        <option value={2025}>2025</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-bold rounded-xl py-2.5 px-4 text-xs shadow-md border-0 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <ClipboardList size={15} />
                        <span>{lang === 'bn' ? 'রিপোর্ট তৈরি করুন' : 'Generate Report'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Generated Attendance Sheet View */}
                {generatedReportLogs && reportSummary && (
                  <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-6 font-sans print:border-none print:shadow-none print:p-0">
                    
                    {/* Official Company Report Header (Visible and Printable) */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Smart Trading</h2>
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-green/10 text-brand-green px-2 py-0.5 rounded">
                            {lang === 'bn' ? 'অফিসিয়াল রিপোর্ট' : 'Official HRMS'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {lang === 'bn' ? 'মাসিক উপস্থিতি ও বেতন সমন্বয় বিবরণী' : 'Monthly Attendance & Payroll Adjustment Statement'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="text-left sm:text-right bg-slate-50 border border-slate-200/60 px-3 py-2 rounded-xl">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                            {lang === 'bn' ? 'রিপোর্টের সময়কাল' : 'Period'}
                          </span>
                          <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
                            {lang === 'bn' 
                              ? ['জানুয়ারী', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][reportMonth - 1]
                              : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][reportMonth - 1]} {reportYear}
                          </span>
                        </div>
                        <button
                          onClick={() => window.print()}
                          className="print:hidden flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="Print"
                        >
                          <Printer size={13} />
                          <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Printable Header & Employee Details Banner */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                          {reportSummary.emp.avatar ? (
                            <img src={reportSummary.emp.avatar} alt={reportSummary.emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base font-black text-brand-green">{reportSummary.emp.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-brand-green"></span>
                            <h3 className="text-lg font-black text-slate-800">
                              {reportSummary.emp.name}
                            </h3>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              {reportSummary.emp.id}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">
                            {reportSummary.emp.email} • {lang === 'bn' ? 'ডিউটি শিফট:' : 'Shift:'} <b className="text-slate-700 font-mono">{reportSummary.emp.shiftStartTime || '09:00'}</b> • {lang === 'bn' ? 'মূল বেতন:' : 'Basic:'} <b className="text-brand-green">৳{reportSummary.baseSalary.toLocaleString()}</b>
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right bg-slate-50 border border-slate-200/60 p-3 rounded-2xl">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                          {lang === 'bn' ? 'রিপোর্টের মাস ও বছর' : 'Report Period'}
                        </span>
                        <span className="font-extrabold text-slate-800 text-sm">
                          {lang === 'bn' 
                            ? ['জানুয়ারী', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][reportMonth - 1]
                            : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][reportMonth - 1]} {reportYear}
                        </span>
                      </div>
                    </div>

                    {/* Summary KPI Cards Grid (6 Metric Cards) */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {/* 1. Present */}
                      <div className="bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block tracking-wider">
                          {lang === 'bn' ? 'উপস্থিত দিন' : 'Present Days'}
                        </span>
                        <div className="text-xl font-black text-emerald-700 font-sans">
                          {reportSummary.presentCount} {lang === 'bn' ? 'দিন' : 'days'}
                        </div>
                        <span className="text-[9px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 size={10} className="shrink-0" />
                          <span>{lang === 'bn' ? 'যথাসময়ে পাঞ্চ' : 'On-Time'}</span>
                        </span>
                      </div>

                      {/* 2. Late */}
                      <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block tracking-wider">
                          {lang === 'bn' ? 'বিলম্ব (Late)' : 'Late Days'}
                        </span>
                        <div className="text-xl font-black text-amber-800 font-sans">
                          {reportSummary.lateCount} {lang === 'bn' ? 'দিন' : 'days'}
                        </div>
                        <span className="text-[9px] text-amber-700 block font-medium leading-tight">
                          {reportSummary.lateCutDays > 0 
                            ? (
                              <span className="flex items-center gap-1">
                                <AlertTriangle size={10} className="shrink-0 text-amber-600" />
                                <span>{lang === 'bn' ? `৩ দিনে ১ দিন কর্তন: -৳${reportSummary.lateDeduction.toLocaleString()}` : `3 Lates = 1 Day: -৳${reportSummary.lateDeduction.toLocaleString()}`}</span>
                              </span>
                            )
                            : (lang === 'bn' ? '৩ দিন লেটে ১ দিন কর্তন' : '3 Lates = 1 Day Cut')}
                        </span>
                      </div>

                      {/* 3. Absent */}
                      <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-rose-800 uppercase block tracking-wider">
                          {lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}
                        </span>
                        <div className="text-xl font-black text-rose-700 font-sans">
                          {reportSummary.absentCount} {lang === 'bn' ? 'দিন' : 'days'}
                        </div>
                        <span className="text-[9px] text-rose-600 block font-medium">
                          {reportSummary.absentDeduction > 0 
                            ? `-৳${reportSummary.absentDeduction.toLocaleString()} (${lang === 'bn' ? 'বেতন কর্তন' : 'cut'})` 
                            : (lang === 'bn' ? 'অনুপস্থিতি শূন্য' : 'No absence')}
                        </span>
                      </div>

                      {/* 4. Fridays / Weekly Off */}
                      <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-800 uppercase block tracking-wider">
                          {lang === 'bn' ? 'সাপ্তাহিক ছুটি' : 'Fridays Off'}
                        </span>
                        <div className="text-xl font-black text-blue-800 font-sans">
                          {reportSummary.weekendCount} {lang === 'bn' ? 'দিন' : 'days'}
                        </div>
                        <span className="text-[9px] text-blue-600 block font-medium leading-tight">
                          {reportSummary.fridayWorked > 0 
                            ? (lang === 'bn' ? `+${reportSummary.fridayWorked} দিন ডিউটি বোনাস: +৳${reportSummary.fridayBonus.toLocaleString()}` : `+${reportSummary.fridayWorked} Worked Bonus: +৳${reportSummary.fridayBonus.toLocaleString()}`)
                            : (
                              <span className="flex items-center gap-1">
                                <Check size={10} className="shrink-0 text-blue-600" />
                                <span>{lang === 'bn' ? 'বেতনসহ ছুটি' : 'Paid Off'}</span>
                              </span>
                            )}
                        </span>
                      </div>

                      {/* 5. Overtime */}
                      <div className="bg-teal-50/70 border border-teal-200 p-3.5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-bold text-teal-800 uppercase block tracking-wider">
                          {lang === 'bn' ? 'ওভারটাইম' : 'Overtime'}
                        </span>
                        <div className="text-xl font-black text-teal-800 font-sans">
                          {reportSummary.totalOtHours} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
                        </div>
                        <span className="text-[9px] text-teal-700 block font-medium">
                          {reportSummary.totalOtPay > 0 ? `+৳${reportSummary.totalOtPay.toLocaleString()} (${lang === 'bn' ? 'ওভারটাইম আয়' : 'OT Pay'})` : (lang === 'bn' ? 'দৈনিক ৮ ঘণ্টার অতিরিক্ত' : 'Beyond 8h')}
                        </span>
                      </div>

                      {/* 6. Net Payable */}
                      <div className="bg-brand-green text-white p-3.5 rounded-2xl space-y-1 shadow-sm">
                        <span className="text-[10px] font-bold text-white/80 uppercase block tracking-wider">
                          {lang === 'bn' ? 'প্রদেয় নিট বেতন' : 'Net Payable'}
                        </span>
                        <div className="text-xl font-black font-sans">
                          ৳{reportSummary.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                        </div>
                        <span className="text-[9px] text-white/80 block font-medium">
                          {lang === 'bn' ? `পেইড দিন: ${reportSummary.paidDaysCount}/${reportSummary.totalCalendarDays} দিন` : `Paid: ${reportSummary.paidDaysCount}/${reportSummary.totalCalendarDays}d`}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Daily Attendance Table */}
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          {lang === 'bn' ? 'প্রতিদিনের ইন-আউট হাজিরা লগ (১ থেকে শেষ তারিখ)' : 'Daily In-Out Attendance Log (1st to End of Month)'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {reportSummary.totalCalendarDays} {lang === 'bn' ? 'দিনের পূর্ণ বিবরণী' : 'Days Total'}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-50/80 font-bold text-slate-500 uppercase tracking-wider text-[9.5px] border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-3">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                              <th className="px-4 py-3">{lang === 'bn' ? 'বার' : 'Day'}</th>
                              <th className="px-4 py-3">{lang === 'bn' ? 'প্রবেশ সময়' : 'In Time'}</th>
                              <th className="px-4 py-3">{lang === 'bn' ? 'প্রস্থান সময়' : 'Out Time'}</th>
                              <th className="px-4 py-3">{lang === 'bn' ? 'কাজের সময়' : 'Hours'}</th>
                              <th className="px-4 py-3">{lang === 'bn' ? 'ওভারটাইম' : 'OT'}</th>
                              <th className="px-4 py-3">{lang === 'bn' ? 'হাজিরা অবস্থা' : 'Status'}</th>
                              <th className="px-4 py-3 text-right">{lang === 'bn' ? 'অবস্থান / ভেরিফিকেশন' : 'Location'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {generatedReportLogs.map((l) => (
                              <tr key={l.dateStr} className={`hover:bg-slate-50/60 transition-colors ${l.status === 'Weekend' ? 'bg-slate-50/30' : ''}`}>
                                <td className="px-4 py-2.5 font-bold font-mono text-slate-800">{l.dateStr}</td>
                                <td className="px-4 py-2.5 font-medium text-slate-600">{l.dayName}</td>
                                <td className={`px-4 py-2.5 font-mono font-bold ${l.status === 'Late' ? 'text-amber-700' : l.checkInTime !== '-' ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {l.checkInTime}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-slate-600">{l.checkOutTime}</td>
                                <td className="px-4 py-2.5 font-sans font-medium text-slate-600">{l.workedHours}</td>
                                <td className="px-4 py-2.5 font-mono font-bold">
                                  {l.otHours > 0 ? (
                                    <span className="text-teal-700">+{l.otHours}h</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                    l.status === 'Present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    l.status === 'Late' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    l.status === 'Weekend' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    l.status === 'Holiday' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    l.status === 'Future' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                    'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {l.statusBn}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-[10.5px] text-slate-500">
                                  {formatLocation(l.location)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ) : currentEmployee ? (
              /* Employee View Dashboard Layout */
              <div className="flex flex-col gap-6 flex-1">
                
                {activeTab === 'dashboard' ? (
                  /* Employee Dashboard Main Tab */
                  <div className="space-y-6">
                    {/* ── 1ST: Staff Salary & Payment Status Card (কত টাকা পাবে, পাইছে, বাকি) ── */}
                    {(() => {
                      const latestEmp = employeesList.find(e => e.id === currentEmployee.id) || currentEmployee;
                      const currentYM = new Date().toISOString().substring(0, 7);
                      const salaryCalc = calculateMonthlySalary(latestEmp, currentYM, holidaysList);
                      const isPaidThisMonth = loadPaymentStatus(latestEmp.id, currentYM);
                      const advanceTaken = latestEmp.advanceSalary || 0;

                      return (
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm font-sans space-y-4 max-w-xl mx-auto w-full">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                                <Wallet size={20} />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight">
                                  {lang === 'bn' ? 'আমার মাসিক বেতন ও হিসাব' : 'My Monthly Salary & Balance'}
                                </h4>
                                <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                                  {lang === 'bn' 
                                    ? `${latestEmp.nameBn || latestEmp.name} (আইডি: ${latestEmp.id}) • চলতি মাস` 
                                    : `${latestEmp.name} (ID: ${latestEmp.id}) • Current Month`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <span className={`px-3 py-1 rounded-full text-[10.5px] font-bold border ${
                                isPaidThisMonth 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {isPaidThisMonth ? (lang === 'bn' ? '✓ পরিশোধিত (Paid)' : '✓ Paid') : (lang === 'bn' ? '⏳ প্রদেয় বাকি (Unpaid)' : '⏳ Due/Unpaid')}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigate('/dashboard?tab=salary')}
                                className="text-xs font-bold text-brand-green hover:underline cursor-pointer bg-transparent border-0 flex items-center gap-1"
                              >
                                <span>{lang === 'bn' ? 'পে-স্লিপ' : 'Payslip'}</span>
                                <ArrowRight size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Salary Key Figures Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            {/* Basic Salary */}
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <span className="text-[9.5px] text-slate-400 font-bold block mb-0.5">{lang === 'bn' ? 'চুক্তির মূল বেতন:' : 'Basic Salary:'}</span>
                              <div className="font-black text-slate-800 text-base font-sans">
                                ৳{salaryCalc.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </div>
                              <span className="text-[8.5px] text-slate-400 font-medium">{lang === 'bn' ? 'স্থায়ী চুক্তি' : 'Contract'}</span>
                            </div>

                            {/* Overtime & Bonus */}
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <span className="text-[9.5px] text-slate-400 font-bold block mb-0.5">{lang === 'bn' ? 'ওভারটাইম ও বোনাস:' : 'OT & Bonus:'}</span>
                              <div className="font-black text-emerald-600 text-base font-sans">
                                + ৳{(salaryCalc.otPay + salaryCalc.fridayBonus).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </div>
                              <span className="text-[8.5px] text-emerald-600 font-medium">+{toBnDigits(salaryCalc.otHours)}h {lang === 'bn' ? 'ওভারটাইম' : 'OT'}</span>
                            </div>

                            {/* Advance Taken */}
                            <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-100">
                              <span className="text-[9.5px] text-rose-600 font-bold block mb-0.5">{lang === 'bn' ? 'অগ্রিম গ্রহণ (Advance):' : 'Advance Taken:'}</span>
                              <div className="font-black text-rose-600 text-base font-sans">
                                ৳{advanceTaken.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </div>
                              <span className="text-[8.5px] text-rose-500 font-medium">
                                {advanceTaken > 0 ? (lang === 'bn' ? 'বেতন থেকে কর্তন' : 'Deducted') : (lang === 'bn' ? 'কোনো অগ্রিম নেই' : 'No Advance')}
                              </span>
                            </div>

                            {/* Net Payable / Due */}
                            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-300">
                              <span className="text-[9.5px] text-emerald-800 font-bold block mb-0.5">
                                {isPaidThisMonth 
                                  ? (lang === 'bn' ? 'পরিশোধিত বেতন:' : 'Paid Salary:') 
                                  : (lang === 'bn' ? 'প্রদেয় মোট বেতন:' : 'Net Payable:')}
                              </span>
                              <div className="font-black text-brand-green text-lg font-sans">
                                ৳{salaryCalc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </div>
                              <span className="text-[8.5px] text-emerald-700 font-bold">
                                {isPaidThisMonth 
                                  ? (lang === 'bn' ? 'পরিশোধ সম্পন্ন' : 'Paid in full') 
                                  : (lang === 'bn' ? 'পাওনা বাকি রয়েছে' : 'Balance to receive')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── 2ND: Live Attendance Punch Card (OurBuilders ERP Style) ── */}
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const todayRecord = logs.find(l => l.date === todayStr);
                      const inTimeVal = todayRecord?.checkIn && todayRecord.checkIn !== '-' ? todayRecord.checkIn : '';
                      const outTimeVal = todayRecord?.checkOut && todayRecord.checkOut !== '-' ? todayRecord.checkOut : '';
                      const hasCheckedIn = !!inTimeVal;
                      const hasCheckedOut = !!outTimeVal;
                      const expectedOut = calculateExpectedOutTime(inTimeVal, 8);
                      const dutyProgress = getDutyProgress(inTimeVal, outTimeVal, 8);
                      const liveClockString = liveTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      });

                      return (
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm font-sans max-w-xl mx-auto w-full space-y-4">
                          {/* Live Clock & GPS badge */}
                          <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#00875a] shrink-0 animate-pulse"></span>
                            <span className="font-mono font-black text-2xl sm:text-3xl text-[#091e42] tracking-tight">
                              {liveClockString}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#e3fcef] text-[#006644] border border-[#abf5d1] text-[11px] font-bold tracking-tight shrink-0">
                              GPS ±{officeRadius || 10}m
                            </span>
                          </div>

                          {/* Location & Refresh */}
                          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#00875a]">
                            <MapPin size={13} className="text-[#00875a] shrink-0" />
                            <span>{lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'}</span>
                            <button
                              type="button"
                              onClick={handleGetDeviceCurrentLocation}
                              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer border-0 bg-transparent"
                              title={lang === 'bn' ? 'লোকেশন রিফ্রেশ করুন' : 'Refresh GPS'}
                            >
                              <RotateCcw size={12} className={locatingCurrentGps ? 'animate-spin text-brand-green' : ''} />
                            </button>
                          </div>

                          {/* Big Action Punch Buttons (Side-by-side) */}
                          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1">
                            {/* In Button */}
                            {hasCheckedIn ? (
                              <div className="bg-[#85b79e] text-white font-bold py-3 sm:py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm select-none">
                                <LogIn size={15} />
                                <span>In: {inTimeVal}</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handleCheckIn}
                                disabled={checkInLoading}
                                className="bg-brand-green hover:bg-brand-green-dark text-white font-black py-3 sm:py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm border-0"
                              >
                                <LogIn size={15} />
                                <span>
                                  {checkInLoading 
                                    ? (lang === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...') 
                                    : (lang === 'bn' ? 'ইন (Check-In)' : 'In: --:--')}
                                </span>
                              </button>
                            )}

                            {/* Out Button */}
                            {hasCheckedOut ? (
                              <div className="bg-rose-100 text-rose-800 font-bold py-3 sm:py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs select-none">
                                <LogOut size={15} />
                                <span>Out: {outTimeVal}</span>
                              </div>
                            ) : hasCheckedIn ? (
                              <button
                                type="button"
                                onClick={handleCheckOut}
                                className="bg-[#e60049] hover:bg-[#c9003f] text-white font-black py-3 sm:py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs sm:text-sm border-0"
                              >
                                <LogOut size={15} />
                                <span>Out: -</span>
                              </button>
                            ) : (
                              <div className="bg-slate-100 text-slate-400 font-bold py-3 sm:py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm border border-slate-200/60 cursor-not-allowed select-none">
                                <LogOut size={15} />
                                <span>Out: -</span>
                              </div>
                            )}
                          </div>

                          {/* Bottom Info Bar: In / Out status & location badge & entry status badge */}
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div className="space-y-1 text-left">
                              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>In: <strong className="text-slate-900">{inTimeVal || '-'}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span>Out: <strong className="text-slate-900">{outTimeVal || '-'}</strong></span>
                              </div>
                              <div>
                                <span className="px-2 py-0.5 rounded-md bg-[#e3fcef] text-[#006644] border border-[#abf5d1] text-[10px] font-bold inline-flex items-center">
                                  {lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'}
                                </span>
                              </div>
                            </div>

                            <div>
                              {hasCheckedIn ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                  todayRecord?.status === 'Late'
                                    ? 'bg-[#fff0b3] text-[#172b4d] border-[#ffe380]'
                                    : 'bg-[#e3fcef] text-[#006644] border-[#abf5d1]'
                                }`}>
                                  {todayRecord?.status === 'Late'
                                    ? (lang === 'bn' ? 'বিলম্ব (Late Entry)' : 'Late Entry')
                                    : (lang === 'bn' ? 'যথাসময়ে (On-Time)' : 'On-Time')}
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  {lang === 'bn' ? 'হাজিরা বাকি' : 'Pending Entry'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 11-Hour Duty Target & Live Progress Indicator */}
                          {hasCheckedIn && (
                            <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-brand-green shrink-0" />
                                <span>
                                  {lang === 'bn' ? 'প্রত্যাশিত প্রস্থান:' : 'Target Out:'} <strong className="text-slate-900 font-bold">{expectedOut}</strong> ({lang === 'bn' ? '১১ ঘণ্টা লক্ষ্য' : '11h duty'})
                                </span>
                              </div>
                              {dutyProgress && (
                                <div className={`font-bold ${dutyProgress.isCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {dutyProgress.isCompleted 
                                    ? (lang === 'bn' ? `১১ ঘণ্টা পূর্ণ (+${dutyProgress.otHoursStr} ওভারটাইম)` : `11h Completed (+${dutyProgress.otHoursStr} OT)`)
                                    : (lang === 'bn' ? `অতিবাহিত: ${dutyProgress.workedHoursStr} • বাকি: ${dutyProgress.remainingHoursStr}` : `Worked: ${dutyProgress.workedHoursStr} • Left: ${dutyProgress.remainingHoursStr}`)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── 3RD: Running Month Attendance Stats (উপস্থিত, লেইট, অনুপস্থিত, ওভারটাইম) ── */}
                    {(() => {
                      const currentYM = new Date().toISOString().substring(0, 7);
                      const latestEmp = employeesList.find(e => e.id === currentEmployee.id) || currentEmployee;
                      const salaryCalc = calculateMonthlySalary(latestEmp, currentYM, holidaysList);
                      const monthLogs = logs.filter(l => l.date.startsWith(currentYM));
                      const presentDays = monthLogs.filter(l => l.status === 'On-Time' || (l.checkIn && l.checkIn !== '-')).length;
                      const lateDays = monthLogs.filter(l => l.status === 'Late').length;
                      const absentDays = salaryCalc.absentDaysCount;
                      const otHours = salaryCalc.otHours;

                      return (
                        <div className="space-y-2 max-w-xl mx-auto w-full font-sans">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                              {lang === 'bn' ? 'চলতি মাসের হাজিরার বিবরণী' : 'Current Month Attendance Stats'}
                            </span>
                            <span className="text-[10.5px] text-slate-400 font-mono">
                              {currentYM}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {/* Present */}
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center space-y-0.5">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                                {lang === 'bn' ? 'মোট উপস্থিতি' : 'Present'}
                              </span>
                              <div className="text-xl font-black text-brand-green">
                                {toBnDigits(presentDays)} <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'দিন' : 'days'}</span>
                              </div>
                              <span className="text-[8.5px] text-emerald-600 font-medium block">
                                {lang === 'bn' ? 'উপস্থিত কার্যদিবস' : 'Worked days'}
                              </span>
                            </div>

                            {/* Late */}
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center space-y-0.5">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                                {lang === 'bn' ? 'বিলম্ব হাজিরা' : 'Late Entries'}
                              </span>
                              <div className="text-xl font-black text-amber-500">
                                {toBnDigits(lateDays)} <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'দিন' : 'days'}</span>
                              </div>
                              <span className="text-[8.5px] text-amber-600 font-medium block">
                                {salaryCalc.lateCutDays > 0 ? (lang === 'bn' ? `${salaryCalc.lateCutDays} দিন কাটা` : `${salaryCalc.lateCutDays}d cut`) : (lang === 'bn' ? '৩ দিনে ১ দিন কর্তন' : '3:1 cut')}
                              </span>
                            </div>

                            {/* Absent */}
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center space-y-0.5">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                                {lang === 'bn' ? 'অনুপস্থিতি' : 'Absent'}
                              </span>
                              <div className="text-xl font-black text-rose-500">
                                {toBnDigits(absentDays)} <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'দিন' : 'days'}</span>
                              </div>
                              <span className="text-[8.5px] text-rose-500 font-medium block">
                                {absentDays > 0 ? (lang === 'bn' ? 'অনুপস্থিত দিন' : 'Absent days') : (lang === 'bn' ? 'সবদিন উপস্থিত' : 'Zero absent')}
                              </span>
                            </div>

                            {/* Overtime */}
                            <div className="bg-white border border-emerald-200/80 bg-linear-to-br from-white to-emerald-50/20 p-3.5 rounded-2xl shadow-xs text-center space-y-0.5">
                              <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">
                                {lang === 'bn' ? 'ওভারটাইম (OT)' : 'Overtime (OT)'}
                              </span>
                              <div className="text-xl font-black text-emerald-700">
                                +{toBnDigits(otHours)}h
                              </div>
                              <span className="text-[8.5px] text-emerald-600 font-medium block">
                                {salaryCalc.otPay > 0 ? `+৳${salaryCalc.otPay.toLocaleString()}` : (lang === 'bn' ? 'অতিরিক্ত সময়' : 'Extra duty')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                                        {/* Quick Access Shortcuts Panel */}
                    {quickAccessItems.length > 0 && (
                      <div className="space-y-2.5 px-1 pb-1 font-sans">
                        <span className="flex items-center gap-1.5 text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <Zap size={11} className="text-amber-500 shrink-0" />
                          <span>{lang === 'bn' ? 'কুইক অ্যাক্সেস' : 'Quick Access'}</span>
                        </span>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3.5 sm:gap-4.5">
                          {quickAccessItems.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={item.action}
                              className="flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-0 bg-transparent py-1 select-none"
                            >
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-xs ${item.iconBg}`}>
                                {item.icon}
                              </div>
                              <span className="text-[9.5px] font-extrabold text-slate-600 mt-2 text-center tracking-wide block">
                                {item.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dashboard Broadcast Notices Card */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[250px]">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Megaphone size={14} className="text-brand-gold shrink-0" />
                          <span>{lang === 'bn' ? 'সাম্প্রতিক নোটিশসমূহ' : 'Recent Notices'}</span>
                        </span>
                        <span className="text-[10px] bg-brand-green/10 text-brand-green px-2.5 py-1 rounded-full font-bold">
                          {activeEmployeeNotices.length} {lang === 'bn' ? 'নোটিশ' : 'Notices'}
                        </span>
                      </div>

                      <div className="p-3.5 sm:p-4 bg-slate-50/50 space-y-3 overflow-y-auto">
                        {activeEmployeeNotices.slice(0, 3).map(not => (
                          <div 
                            key={not.id}
                            onClick={() => setSelectedNoticeDetails(not)}
                            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:border-brand-green/50 hover:shadow-sm transition-all cursor-pointer flex justify-between items-start gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                not.type === 'All' ? 'bg-brand-green/10 text-brand-green' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {not.type === 'All' ? <Megaphone size={16} /> : <Lock size={16} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border ${
                                    not.type === 'All' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {not.type === 'All' ? (lang === 'bn' ? 'সাধারণ' : 'General') : (lang === 'bn' ? 'ব্যক্তিগত' : 'Personal')}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">{not.date}</span>
                                </div>
                                <h6 className="font-extrabold text-slate-800 text-xs sm:text-sm mt-1 leading-tight">{not.title}</h6>
                                <p className="text-[10.5px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">{not.content}</p>
                              </div>
                            </div>
                            <div className="shrink-0 self-center w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors">
                              <ArrowRight size={12} />
                            </div>
                          </div>
                        ))}
                        {activeEmployeeNotices.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-xs">
                            {lang === 'bn' ? 'কোনো নোটিশ নেই।' : 'No notices yet.'}
                          </div>
                        )}
                      </div>
                    </div>


                  </div>
                ) : activeTab === 'history' ? (
                  /* Employee Log History */
                  <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-[400px]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                        {lang === 'bn' ? 'আমার সাম্প্রতিক হাজিরার ইতিহাস' : 'My Recent Log History'}
                      </span>
                      <span className="text-[10px] bg-brand-green/10 text-brand-green px-3 py-1 rounded-full font-bold">
                        {logs.length} {lang === 'bn' ? 'কার্যদিবস' : 'Logs'}
                      </span>
                    </div>

                    {/* Mobile Expandable Cards View (md:hidden) */}
                    <div className="md:hidden p-3.5 sm:p-4 bg-slate-50/50 space-y-3 flex-1 overflow-y-auto">
                      {logs.map((log) => {
                        const metrics = getAttendanceMetrics(log);
                        const isExpanded = expandedHistoryDate === log.date;

                        return (
                          <div key={log.date} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3 hover:border-slate-300 transition-all">
                            {/* Header: Date + Status + MarkedBy */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-slate-800 text-xs font-mono">{log.date}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                  log.status === 'On-Time' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : log.status === 'Late'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-600 border-rose-200'
                                }`}>
                                  {lang === 'bn' ? log.statusBn : log.status}
                                </span>

                                {log.markedBy && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold border ${
                                    log.markedBy.includes('এডমিন') || log.markedBy.includes('Admin')
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {log.markedBy}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* In / Out / Duration Quick Grid */}
                            <div className="grid grid-cols-3 gap-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                              <div className="space-y-0.5">
                                <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">{lang === 'bn' ? 'প্রবেশ' : 'In'}</span>
                                <span className="font-mono font-bold text-slate-800 text-[10.5px]">{log.checkIn || '-'}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">{lang === 'bn' ? 'প্রস্থান' : 'Out'}</span>
                                <span className="font-mono font-bold text-slate-800 text-[10.5px]">{log.checkOut || '-'}</span>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">{lang === 'bn' ? 'কাজের সময়' : 'Duration'}</span>
                                <span className="font-bold text-slate-700 truncate block text-[10.5px]">{metrics.duration}</span>
                              </div>
                            </div>

                            {/* Expand / Collapse Button */}
                            <button
                              type="button"
                              onClick={() => setExpandedHistoryDate(isExpanded ? null : log.date)}
                              className="flex items-center justify-between w-full text-[10.5px] font-bold text-slate-500 hover:text-brand-green cursor-pointer border-0 bg-transparent pt-0.5"
                            >
                              <span>{isExpanded ? (lang === 'bn' ? 'সংক্ষেপ করুন' : 'Less') : (lang === 'bn' ? 'লোকেশন ও বিবরণ দেখুন' : 'Location & Details')}</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="pt-2.5 border-t border-slate-100 space-y-2 text-[11px] animate-fade-in">
                                {log.location && log.location !== '-' && (
                                  <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/70 text-[10.5px]">
                                    <MapPin size={12} className="text-emerald-600 shrink-0" />
                                    <span>{formatLocation(log.location)}</span>
                                  </div>
                                )}
                                {log.note && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-[10.5px] text-slate-600">
                                    <span className="font-bold text-slate-700 block mb-0.5">{lang === 'bn' ? 'নোট:' : 'Note:'}</span>
                                    {log.note}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Table View (hidden on mobile, shown on desktop md+) */}
                    <div className="hidden md:block overflow-y-auto flex-1 min-h-0">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-100">
                          <tr>
                            <th className="px-5 py-3.5">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                            <th className="px-5 py-3.5">{lang === 'bn' ? 'প্রবেশ (In)' : 'Check In'}</th>
                            <th className="px-5 py-3.5">{lang === 'bn' ? 'প্রস্থান (Out)' : 'Check Out'}</th>
                            <th className="px-5 py-3.5">{lang === 'bn' ? 'কাজের সময়' : 'Duration'}</th>
                            <th className="px-5 py-3.5">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                            <th className="px-5 py-3.5 text-right">{lang === 'bn' ? 'এন্ট্রি মেথড' : 'Entry Method'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-650 font-sans">
                          {logs.map((log) => {
                            const metrics = getAttendanceMetrics(log);
                            return (
                              <tr key={log.date} className="hover:bg-slate-50/40 transition-colors">
                                <td className="px-5 py-3.5 font-bold text-slate-800">{log.date}</td>
                                <td className="px-5 py-3.5 font-medium font-mono">{log.checkIn || '-'}</td>
                                <td className="px-5 py-3.5 font-medium font-mono">{log.checkOut || '-'}</td>
                                <td className="px-5 py-3.5 font-medium text-slate-700">{metrics.duration}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                                    log.status === 'On-Time' 
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                      : log.status === 'Late'
                                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                        : 'bg-red-50 text-red-600 border border-red-100'
                                  }`}>
                                    {lang === 'bn' ? log.statusBn : log.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                  {log.markedBy ? (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                                      log.markedBy.includes('এডমিন') || log.markedBy.includes('Admin')
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {log.markedBy}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {lang === 'bn' ? 'ডিজিটাল পাঞ্চ' : 'Digital Punch'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : activeTab === 'salary' ? (() => {
                  /* Employee Personal Salary Payslip View */
                  const latestEmp = employeesList.find(e => e.id === currentEmployee.id) || currentEmployee;
                  const currentYM = selectedProfileMonth || new Date().toISOString().substring(0, 7);
                  const calc = calculateMonthlySalary(latestEmp, currentYM, holidaysList);
                  const isPaid = loadPaymentStatus(latestEmp.id, currentYM);
                  const advanceTaken = latestEmp.advanceSalary || 0;
                  const allowances = latestEmp.allowances || 0;
                  const fixedDeductions = latestEmp.deductions || 0;

                  return (
                    <div className="space-y-6 font-sans">
                      {/* Payslip Card */}
                      <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                              <Wallet size={24} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 text-sm sm:text-base">
                                {lang === 'bn' ? 'আমার মাসিক বেতন বিবরণী (Pay Slip)' : 'My Monthly Payslip'}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {lang === 'bn' ? `${latestEmp.nameBn || latestEmp.name} • আইডি: ${latestEmp.id}` : `${latestEmp.name} • ID: ${latestEmp.id}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Month Selector */}
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                              <Calendar size={13} className="text-slate-400 shrink-0" />
                              <input
                                type="month"
                                value={currentYM}
                                onChange={(e) => setSelectedProfileMonth(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                              />
                            </div>

                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isPaid ? (lang === 'bn' ? '✓ পরিশোধিত' : '✓ Paid') : (lang === 'bn' ? '⏳ বকেয়া / প্রদেয়' : '⏳ Pending')}
                            </span>

                            <button
                              onClick={() => window.print()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border-0"
                            >
                              <Printer size={13} />
                              <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Salary Summary Highlight */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'bn' ? 'মূল বেতন (Basic)' : 'Basic Salary'}</span>
                            <div className="text-xl font-black text-slate-800 font-sans">৳{calc.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</div>
                            <span className="text-[9px] text-slate-400">{lang === 'bn' ? `দৈনিক: ৳${Math.round(calc.dailyRate)}` : `Daily: ৳${Math.round(calc.dailyRate)}`}</span>
                          </div>

                          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'bn' ? 'পেইড কার্যদিবস' : 'Paid Days'}</span>
                            <div className="text-xl font-black text-slate-800 font-sans">{calc.paidDays} / {calc.totalCalendarDays} {lang === 'bn' ? 'দিন' : 'days'}</div>
                            <span className="text-[9px] text-slate-400">{lang === 'bn' ? 'উপস্থিতি ও ছুটিসহ' : 'Worked + Off'}</span>
                          </div>

                          <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-rose-600 font-bold uppercase">{lang === 'bn' ? 'অগ্রিম গ্রহণ (Advance)' : 'Advance Taken'}</span>
                            <div className="text-xl font-black text-rose-600 font-sans">৳{advanceTaken.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</div>
                            <span className="text-[9px] text-rose-500">{advanceTaken > 0 ? (lang === 'bn' ? 'বেতন থেকে কর্তন' : 'Deducted') : (lang === 'bn' ? 'কোনো অগ্রিম নেই' : 'None')}</span>
                          </div>

                          <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] text-emerald-700 font-bold uppercase">{lang === 'bn' ? 'সর্বমোট প্রদেয় বেতন (Net Pay)' : 'Net Payable'}</span>
                            <div className="text-2xl font-black text-emerald-800 font-sans">৳{calc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</div>
                            <span className="text-[9px] text-emerald-700 font-medium">{isPaid ? (lang === 'bn' ? 'পরিশোধিত' : 'Paid') : (lang === 'bn' ? 'পাওনা বাকি' : 'Pending')}</span>
                          </div>
                        </div>

                        {/* Breakdown Table */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 font-extrabold text-xs text-slate-700 uppercase tracking-wide">
                            {lang === 'bn' ? `বেতন ও কর্তন পূর্ণাঙ্গ বিবরণী (${currentYM})` : `Salary & Deduction Statement (${currentYM})`}
                          </div>
                          <table className="w-full text-xs text-left">
                            <tbody className="divide-y divide-slate-100">
                              <tr className="bg-white">
                                <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'মূল মাসিক বেতন (Basic Pay)' : 'Basic Monthly Salary'}</td>
                                <td className="p-3 text-right font-bold text-slate-800 font-mono">৳{calc.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                              </tr>
                              {allowances > 0 && (
                                <tr className="bg-slate-50/50">
                                  <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'মাসিক নিয়মিত ভাতা (Allowances)' : 'Monthly Allowances'}</td>
                                  <td className="p-3 text-right font-bold text-emerald-600 font-mono">+ ৳{allowances.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                                </tr>
                              )}
                              <tr className="bg-white">
                                <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'অনুপস্থিতি কর্তন' : 'Absent Deduction'}</td>
                                <td className="p-3 text-right font-bold text-rose-600 font-mono">
                                  {calc.absentDaysCount > 0 ? `- ৳${Math.round(calc.absentDeduction).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')} (${calc.absentDaysCount} দিন)` : '৳০ (নেই)'}
                                </td>
                              </tr>
                              <tr className="bg-slate-50/50">
                                <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'বিলম্ব হাজিরা কর্তন (প্রতি ৩ দিনে ১ দিনের বেতন কাটা)' : 'Late Deductions (3 lates = 1 day cut)'}</td>
                                <td className="p-3 text-right font-bold text-amber-600 font-mono">
                                  {calc.lateCutDays > 0 ? `- ৳${Math.round(calc.lateDeduction).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')} (${calc.lateCount} দিন লেট)` : '৳০ (কর্তন নেই)'}
                                </td>
                              </tr>
                              <tr className="bg-white">
                                <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'শুক্রবারের বিশেষ হাজিরা বোনাস' : 'Friday Worked Bonus'}</td>
                                <td className="p-3 text-right font-bold text-emerald-600 font-mono">
                                  {calc.fridayBonus > 0 ? `+ ৳${Math.round(calc.fridayBonus).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')} (${calc.fridayWorkedCount} শুক্রবার)` : '৳০'}
                                </td>
                              </tr>
                              <tr className="bg-slate-50/50">
                                <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'ওভারটাইম আয় (OT - দৈনিক ৮ ঘণ্টার অতিরিক্ত)' : 'Overtime Pay (Beyond 8h/day)'}</td>
                                <td className="p-3 text-right font-bold text-emerald-600 font-mono">
                                  {calc.otPay > 0 ? `+ ৳${Math.round(calc.otPay).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')} (${calc.otHours} ঘণ্টা)` : '৳০'}
                                </td>
                              </tr>
                              {advanceTaken > 0 && (
                                <tr className="bg-rose-50/20">
                                  <td className="p-3 text-rose-800 font-medium">{lang === 'bn' ? 'পূর্বে গৃহিত অগ্রিম বেতন কর্তন (Advance Cut)' : 'Advance Salary Deducted'}</td>
                                  <td className="p-3 text-right font-bold text-rose-600 font-mono">- ৳{advanceTaken.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                                </tr>
                              )}
                              {fixedDeductions > 0 && (
                                <tr className="bg-slate-50/50">
                                  <td className="p-3 text-slate-600 font-medium">{lang === 'bn' ? 'অন্যান্য নির্দিষ্ট কর্তন' : 'Other Deductions'}</td>
                                  <td className="p-3 text-right font-bold text-rose-600 font-mono">- ৳{fixedDeductions.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
                                </tr>
                              )}
                              <tr className="bg-emerald-50/80 font-bold border-t border-emerald-200">
                                <td className="p-3.5 text-emerald-950 font-black text-xs sm:text-sm">{lang === 'bn' ? 'সর্বমোট প্রদেয় নিট বেতন (Net Payable)' : 'Total Net Payable'}</td>
                                <td className="p-3.5 text-right font-black text-emerald-800 text-base sm:text-lg font-mono">
                                  ৳{calc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  /* Employee Check-In/Out (attendance view) */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Checkin Action Card */}
                    <div className="bg-white border border-slate-200/85 p-6 rounded-3xl shadow-sm flex flex-col justify-between items-center text-center min-h-[220px]">
                      <div>
                        <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">
                          {lang === 'bn' ? 'আজকের হাজিরা প্রদান' : 'Attendance Entry'}
                        </h5>
                        {todayCheckedIn ? (
                          <div className="flex flex-col items-center gap-1.5 py-3">
                            <CheckCircle size={36} className="text-brand-green" />
                            <span className="text-xs font-bold text-slate-700">
                              {lang === 'bn' ? 'আপনি আজ উপস্থিত হয়েছেন' : 'You are checked in today!'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {lang === 'bn' ? `প্রবেশ সময়: ${logs[0]?.checkIn || ''}` : `Time: ${logs[0]?.checkIn || ''}`}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 py-3">
                            {lang === 'bn' ? 'আপনি আজ এখনও হাজিরা প্রদান করেননি।' : 'You have not checked in yet today.'}
                          </p>
                        )}
                      </div>

                      <button
                        disabled={todayCheckedIn}
                        onClick={handleCheckIn}
                        className={`w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer ${
                          todayCheckedIn 
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-brand-green border-brand-green hover:bg-brand-green-dark text-white shadow-lg shadow-brand-green/20'
                        }`}
                      >
                        {lang === 'bn' ? 'উপস্থিতি প্রদান (Check In)' : 'Check In'}
                      </button>
                    </div>

                    {/* Checkout Action Card */}
                    <div className="bg-white border border-slate-200/85 p-6 rounded-3xl shadow-sm flex flex-col justify-between items-center text-center min-h-[220px]">
                      <div>
                        <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">
                          {lang === 'bn' ? 'আজকের প্রস্থান প্রদান' : 'Shift Departure'}
                        </h5>
                        {todayCheckedOut ? (
                          <div className="flex flex-col items-center gap-1.5 py-3">
                            <CheckCircle size={36} className="text-brand-gold" />
                            <span className="text-xs font-bold text-slate-700">
                              {lang === 'bn' ? 'আজকের মতো প্রস্থান সম্পন্ন হয়েছে' : 'You checked out successfully!'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {lang === 'bn' 
                                ? `প্রস্থান সময়: ${logs.find(l => l.date === new Date().toISOString().split('T')[0])?.checkOut || ''}` 
                                : `Time: ${logs.find(l => l.date === new Date().toISOString().split('T')[0])?.checkOut || ''}`}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-555 py-3">
                            {lang === 'bn' ? 'কাজ শেষে প্রস্থান প্রদানের জন্য বাটনে ক্লিক করুন।' : 'Press the button below when your shift is finished.'}
                          </p>
                        )}
                      </div>

                      <button
                        disabled={!todayCheckedIn || todayCheckedOut}
                        onClick={handleCheckOut}
                        className={`w-full py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer ${
                          !todayCheckedIn || todayCheckedOut 
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-brand-gold border-brand-gold hover:bg-amber-600 hover:border-amber-600 text-slate-900 shadow-lg shadow-brand-gold/20'
                        }`}
                      >
                        {lang === 'bn' ? 'প্রস্থান প্রদান (Check Out)' : 'Check Out'}
                      </button>
                    </div>

                  </div>
                )}

              </div>
            ) : activeTab === 'dashboard' ? (
              /* Admin Tab 0: Dashboard Overview */
              <div className="space-y-6 font-sans">
                
                {/* ── Stat Cards Grid ── */}
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  let presentCount = 0;
                  let lateCount = 0;
                  let pendingCount = 0;

                  employeesList.forEach(emp => {
                    try {
                      const raw = localStorage.getItem(`ob_attendance_logs_${emp.id}`);
                      const empLogs = raw ? JSON.parse(raw) : [];
                      const todayLog = empLogs.find((l: any) => l.date === todayStr);
                      if (todayLog && todayLog.checkIn && todayLog.checkIn !== '-') {
                        if (todayLog.status === 'Late') {
                          lateCount++;
                        } else {
                          presentCount++;
                        }
                      } else {
                        pendingCount++;
                      }
                    } catch (e) {}
                  });

                  return (
                    <div className="space-y-3 shrink-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        
                        {/* Card 1: Total Employees */}
                        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                          <div className="space-y-0.5 font-sans">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                              {lang === 'bn' ? 'মোট কর্মকর্তা' : 'Total Staff'}
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-slate-800">
                              {employeesList.length} <span className="text-xs font-bold text-slate-500">{lang === 'bn' ? 'জন' : ''}</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                            <Users className="w-5 h-5" />
                          </div>
                        </div>

                        {/* Card 2: Today Present */}
                        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                          <div className="space-y-0.5 font-sans">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                              {lang === 'bn' ? 'উপস্থিত (আজকে)' : 'Present Today'}
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-emerald-600">
                              {presentCount} <span className="text-xs font-bold text-emerald-600">{lang === 'bn' ? 'জন' : ''}</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>

                        {/* Card 3: Today Late */}
                        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                          <div className="space-y-0.5 font-sans">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                              {lang === 'bn' ? 'বিলম্ব হাজিরা' : 'Late Today'}
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-amber-600">
                              {lateCount} <span className="text-xs font-bold text-amber-600">{lang === 'bn' ? 'জন' : ''}</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                            <Clock className="w-5 h-5" />
                          </div>
                        </div>

                        {/* Card 4: Pending Entry */}
                        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                          <div className="space-y-0.5 font-sans">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                              {lang === 'bn' ? 'হাজিরা বাকি' : 'Pending Entry'}
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-slate-500">
                              {pendingCount} <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'জন' : ''}</span>
                            </div>
                          </div>
                          <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl shrink-0">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                        </div>

                        {/* Card 5: Monthly Payroll */}
                        {(() => {
                          const currentYM = new Date().toISOString().substring(0, 7);
                          const totalPayroll = employeesList.reduce((sum, emp) => {
                            try {
                              const c = calculateMonthlySalary(emp, currentYM, holidaysList);
                              return sum + c.netPayable;
                            } catch { return sum; }
                          }, 0);
                          return (
                            <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-white border border-emerald-200/70 bg-linear-to-br from-white to-emerald-50/20 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-2">
                              <div className="space-y-0.5 font-sans">
                                <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block">
                                  {lang === 'bn' ? 'মাসিক বেতন বাজেট' : 'Monthly Payroll'}
                                </span>
                                <div className="text-base sm:text-lg font-black text-emerald-800">
                                  ৳{totalPayroll.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </div>
                                <span className="text-[9px] text-emerald-600 font-medium block">{currentYM}</span>
                              </div>
                              <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl shrink-0">
                                <Wallet className="w-5 h-5" />
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    </div>
                  );
                })()}

                {/* Quick Access Shortcuts Panel */}
                {quickAccessItems.length > 0 && (
                  <div className="space-y-2.5 px-1 pb-1 font-sans">
                    <span className="flex items-center gap-1.5 text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <Zap size={11} className="text-amber-500 shrink-0" />
                      <span>{lang === 'bn' ? 'কুইক অ্যাক্সেস' : 'Quick Access'}</span>
                    </span>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3.5 sm:gap-4.5">
                      {quickAccessItems.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={item.action}
                          className="flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 border-0 bg-transparent py-1 select-none"
                        >
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-xs ${item.iconBg}`}>
                            {item.icon}
                          </div>
                          <span className="text-[9.5px] font-extrabold text-slate-600 mt-2 text-center tracking-wide block">
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two-Column Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Column (Today Attendance & Ongoing Tasks) - Span 2 */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Today Attendance Status list */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                          <Users size={18} className="text-brand-green" />
                          <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'কর্মকর্তাদের আজকের উপস্থিতি' : "Today's Attendance Status"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-bold">
                          {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {/* Mobile Cards View (md:hidden) */}
                      <div className="md:hidden p-3.5 sm:p-4 bg-slate-50/50 space-y-3 overflow-y-auto">
                        {filteredEmployees.map((emp) => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          let todayLog: any = null;
                          try {
                            const raw = localStorage.getItem(`ob_attendance_logs_${emp.id}`);
                            const empLogs = raw ? JSON.parse(raw) : [];
                            todayLog = empLogs.find((l: any) => l.date === todayStr);
                          } catch(e) {}

                          const inTime = todayLog?.checkIn && todayLog.checkIn !== '-' ? todayLog.checkIn : '';
                          const outTime = todayLog?.checkOut && todayLog.checkOut !== '-' ? todayLog.checkOut : '';
                          const hasIn = !!inTime;
                          const isLate = todayLog?.status === 'Late';
                          const isAbsent = todayLog?.status === 'Absent';
                          const isLeave = todayLog?.status === 'Leave';

                          return (
                            <div key={emp.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all space-y-3">
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                      {emp.avatar ? (
                                        <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-xs font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                      )}
                                    </div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                      hasIn ? (isLate ? 'bg-amber-500' : 'bg-emerald-500') : (isAbsent ? 'bg-rose-500' : 'bg-slate-300')
                                    }`} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-slate-800 text-xs truncate">
                                      {lang === 'bn' ? emp.nameBn : emp.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                                      <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{emp.id}</span>
                                    </div>
                                  </div>
                                </div>

                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[9.5px] font-extrabold shrink-0 border ${
                                  isAbsent 
                                    ? 'bg-rose-50 text-rose-600 border-rose-200' 
                                    : isLeave 
                                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                                      : isLate 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                        : hasIn
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                  {isAbsent 
                                    ? (lang === 'bn' ? 'অনুপস্থিত' : 'Absent') 
                                    : isLeave 
                                      ? (lang === 'bn' ? 'ছুটি' : 'Leave')
                                      : isLate 
                                        ? (lang === 'bn' ? 'বিলম্বে' : 'Late') 
                                        : hasIn
                                          ? (lang === 'bn' ? 'উপস্থিত' : 'Present')
                                          : (lang === 'bn' ? 'হাজিরা বাকি' : 'Pending')}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">{lang === 'bn' ? 'নির্ধারিত শিফট' : 'Shift'}</span>
                                  <span className="font-mono font-bold text-slate-700 text-[10.5px]">{emp.shiftStartTime || '09:00 AM'}</span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">{lang === 'bn' ? 'প্রবেশ (In)' : 'Check In'}</span>
                                  <span className={`font-mono font-bold text-[10.5px] ${hasIn ? (isLate ? 'text-amber-600' : 'text-emerald-700') : 'text-slate-400'}`}>
                                    {inTime || '-'}
                                  </span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 text-[9px] font-bold block uppercase tracking-wider">{lang === 'bn' ? 'প্রস্থান (Out)' : 'Check Out'}</span>
                                  <span className="font-mono font-bold text-[10.5px] text-slate-700">
                                    {outTime || (hasIn ? (lang === 'bn' ? 'চলমান' : 'Active') : '-')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View (hidden md:block) */}
                      <div className="hidden md:block overflow-x-auto w-full">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead className="bg-slate-50 sticky top-0 font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-100">
                            <tr>
                              <th className="px-5 py-3.5">{lang === 'bn' ? 'নাম ও পদবি' : 'Employee'}</th>
                              <th className="px-3 py-3.5">{lang === 'bn' ? 'নির্ধারিত শিফট' : 'Shift Time'}</th>
                              <th className="px-3 py-3.5">{lang === 'bn' ? 'প্রবেশ সময় (In)' : 'Check-In'}</th>
                              <th className="px-3 py-3.5">{lang === 'bn' ? 'প্রস্থান সময় (Out)' : 'Check-Out'}</th>
                              <th className="px-5 py-3.5 text-right">{lang === 'bn' ? 'হাজিরা অবস্থা' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-650">
                            {filteredEmployees.map((emp, empIdx) => {
                              const todayStr = new Date().toISOString().split('T')[0];
                              let todayLog: any = null;
                              try {
                                const raw = localStorage.getItem(`ob_attendance_logs_${emp.id}`);
                                const empLogs = raw ? JSON.parse(raw) : [];
                                todayLog = empLogs.find((l: any) => l.date === todayStr);
                              } catch(e) {}

                              const inTime = todayLog?.checkIn && todayLog.checkIn !== '-' ? todayLog.checkIn : '';
                              const outTime = todayLog?.checkOut && todayLog.checkOut !== '-' ? todayLog.checkOut : '';
                              const hasIn = !!inTime;
                              const isLate = todayLog?.status === 'Late';
                              const isAbsent = todayLog?.status === 'Absent';
                              const isLeave = todayLog?.status === 'Leave';

                              return (
                                <tr key={emp.id} className={`border-b border-slate-100 transition-colors ${
                                  empIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50'
                                }`}>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="relative shrink-0">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-2xs">
                                          {emp.avatar ? (
                                            <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <span className="text-[11px] font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                          )}
                                        </div>
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                          hasIn ? (isLate ? 'bg-amber-500' : 'bg-emerald-500') : (isAbsent ? 'bg-rose-500' : 'bg-slate-300')
                                        }`} />
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-800 text-[11px]">{lang === 'bn' ? emp.nameBn : emp.name}</div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="font-mono font-bold text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{emp.id}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-600 text-[11px] bg-slate-100 px-2 py-1 rounded-lg">
                                      <Clock size={11} className="text-slate-400" />
                                      {emp.shiftStartTime || '09:00 AM'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-4 font-mono font-bold whitespace-nowrap">
                                    {hasIn ? (
                                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ${isLate ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'}`}>
                                        <Clock size={11} className={isLate ? 'text-amber-500' : 'text-emerald-500'} />
                                        {inTime}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 font-mono">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-4 font-mono font-bold text-slate-600 whitespace-nowrap">
                                    {outTime ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 px-2 py-1 rounded-lg bg-slate-100">
                                        <Clock size={11} className="text-amber-500" />
                                        {outTime}
                                      </span>
                                    ) : hasIn ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-bold font-sans px-2 py-1 rounded-lg bg-emerald-50">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {lang === 'bn' ? 'ডিউটিতে আছেন' : 'Active'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 font-mono">—</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[9.5px] font-bold border ${
                                      isAbsent 
                                        ? 'bg-rose-50 text-rose-600 border-rose-200' 
                                        : isLeave 
                                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                                          : isLate 
                                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                            : hasIn
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                      {isAbsent 
                                        ? (lang === 'bn' ? 'অনুপস্থিত' : 'Absent') 
                                        : isLeave 
                                          ? (lang === 'bn' ? 'ছুটি' : 'Leave')
                                          : isLate 
                                            ? (lang === 'bn' ? 'বিলম্বে' : 'Late') 
                                            : hasIn
                                              ? (lang === 'bn' ? 'উপস্থিত' : 'Present')
                                              : (lang === 'bn' ? 'হাজিরা বাকি' : 'Pending')}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                    
{/* Right Column (Notices Board only) - Span 1 */}
                  <div className="space-y-6">
                    
                    {/* Notices Board */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[250px]">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Megaphone size={14} className="text-brand-gold shrink-0" />
                          <span>{lang === 'bn' ? 'সাম্প্রতিক নোটিশ বোর্ড' : 'Recent Notice Board'}</span>
                        </span>
                        <span className="text-[10px] bg-brand-green/10 text-brand-green px-2.5 py-1 rounded-full font-bold">
                          {noticesList.length} {lang === 'bn' ? 'টি নোটিশ' : 'Notices'}
                        </span>
                      </div>

                      <div className="p-3.5 sm:p-4 bg-slate-50/50 space-y-3 overflow-y-auto">
                        {noticesList.slice(0, 5).map(not => (
                          <div 
                            key={not.id}
                            onClick={() => setSelectedNoticeDetails(not)}
                            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:border-brand-green/50 hover:shadow-sm transition-all cursor-pointer flex justify-between items-start gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                not.type === 'All' ? 'bg-brand-green/10 text-brand-green' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {not.type === 'All' ? <Megaphone size={16} /> : <Lock size={16} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full border ${
                                    not.type === 'All' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {not.type === 'All' ? (lang === 'bn' ? 'সাধারণ' : 'General') : (lang === 'bn' ? `ব্যক্তিগত: ${not.targetEmpId}` : `Personal: ${not.targetEmpId}`)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">{not.date}</span>
                                </div>
                                <h6 className="font-extrabold text-slate-800 text-xs sm:text-sm mt-1 leading-tight">{not.title}</h6>
                                <p className="text-[10.5px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">{not.content}</p>
                              </div>
                            </div>
                            <div className="shrink-0 self-center w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors">
                              <ArrowRight size={12} />
                            </div>
                          </div>
                        ))}
                        {noticesList.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-xs">
                            {lang === 'bn' ? 'কোনো নোটিশ নেই।' : 'No notices yet.'}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            ) : activeTab === 'attendance' ? (() => {
              /* Admin Tab 1: Live Attendance, In/Out Tracking, OT/Shortfall & Adjustment */
              const attendanceTodayRecords = employeesList.map(emp => ({
                emp,
                log: getEmployeeAttendanceRecord(emp.id, attendanceDate)
              }));

              const countPresent = attendanceTodayRecords.filter(r => r.log.status === 'On-Time' || (r.log.checkIn && r.log.checkIn !== '-')).length;
              const countLate = attendanceTodayRecords.filter(r => r.log.status === 'Late').length;
              const countLeave = attendanceTodayRecords.filter(r => r.log.status === 'Leave').length;
              const countAbsent = attendanceTodayRecords.filter(r => r.log.status === 'Absent' || (!r.log.checkIn || r.log.checkIn === '-')).length;
              
              let totalOtHours = 0;
              attendanceTodayRecords.forEach(({ log }) => {
                if (log.checkIn && log.checkIn !== '-' && log.checkOut && log.checkOut !== '-') {
                  const inM = parseTimeStrToMinutes(log.checkIn);
                  const outM = parseTimeStrToMinutes(log.checkOut);
                  if (outM > inM && (outM - inM) > 480) {
                    totalOtHours += Math.round(((outM - inM - 480) / 60) * 10) / 10;
                  }
                }
              });

              const displayedEmployees = employeesList.filter(emp => {
                if (!attendanceSearch.trim()) return true;
                const q = attendanceSearch.toLowerCase();
                return (
                  emp.name.toLowerCase().includes(q) ||
                  emp.nameBn.includes(q) ||
                  emp.id.toLowerCase().includes(q) ||
                  (emp.designation && emp.designation.toLowerCase().includes(q))
                );
              });

              return (
                <div className="flex flex-col gap-5 flex-1 font-sans">
                  
                  {/* Dynamic Stats cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center">
                      <div className="text-xl md:text-2xl font-black text-brand-green">{toBnDigits(countPresent)}</div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                        {lang === 'bn' ? 'উপস্থিত' : 'Present'}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center">
                      <div className="text-xl md:text-2xl font-black text-amber-500">{toBnDigits(countLate)}</div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                        {lang === 'bn' ? 'বিলম্ব' : 'Late'}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center">
                      <div className="text-xl md:text-2xl font-black text-blue-500">{toBnDigits(countLeave)}</div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                        {lang === 'bn' ? 'ছুটি' : 'On Leave'}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs text-center">
                      <div className="text-xl md:text-2xl font-black text-red-500">{toBnDigits(countAbsent)}</div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                        {lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 bg-white border border-emerald-200/80 bg-linear-to-br from-white to-emerald-50/30 p-3.5 rounded-2xl shadow-xs text-center">
                      <div className="text-xl md:text-2xl font-black text-emerald-600">
                        +{toBnDigits(totalOtHours.toFixed(1))}h
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block mt-0.5">
                        {lang === 'bn' ? 'আজকের ওভারটাইম' : 'Today OT'}
                      </span>
                    </div>
                  </div>

                  {/* Attendance Control Bar & Table Container */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs flex-1 flex flex-col min-h-[450px]">
                    <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-brand-gold" />
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wider block">
                            {lang === 'bn' ? 'কর্মকর্তাদের উপস্থিতি ও সময় বিবরণী' : "Attendance & Shift Time Records"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {lang === 'bn' ? 'স্ট্যান্ডার্ড শিফট: ৮ ঘণ্টা | জিপিএস শপ লোকেশন ভেরিফায়েড' : 'Standard Shift: 8 Hours | GPS Shop Location Verified'}
                          </span>
                        </div>
                      </div>

                      {/* Toolbar: Date Picker, Search, Manual Adjustment Button, CSV Export */}
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        {/* Date Picker */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <input
                            type="date"
                            value={attendanceDate}
                            onChange={(e) => setAttendanceDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                          />
                        </div>

                        {/* Search Filter */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs flex-1 sm:flex-initial sm:w-44">
                          <Search size={13} className="text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder={lang === 'bn' ? 'খুঁজুন (নাম/আইডি)...' : 'Search (Name/ID)...'}
                            value={attendanceSearch}
                            onChange={(e) => setAttendanceSearch(e.target.value)}
                            className="text-xs text-slate-700 bg-transparent outline-none w-full"
                          />
                        </div>

                        {/* Manual Adjustment Trigger */}
                        <button
                          onClick={() => openManualAdjustmentModal(employeesList[0]?.id || 'ST-101', attendanceDate)}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-green hover:bg-brand-green-dark px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer border-0 shrink-0"
                        >
                          <Sliders size={13} />
                          <span>{lang === 'bn' ? 'ম্যানুয়াল সমন্বয়' : 'Manual Adjust'}</span>
                        </button>

                        {/* Export Button */}
                        <button
                          onClick={handleExportAttendanceCSV}
                          className="flex items-center gap-1.5 text-xs font-bold text-brand-green bg-brand-green/10 hover:bg-brand-green/20 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors border border-brand-green/20 cursor-pointer shrink-0"
                          title={lang === 'bn' ? 'এক্সেল / CSV ফরম্যাটে ডাউনলোড করুন' : 'Export CSV'}
                        >
                          <FileSpreadsheet size={14} />
                          <span className="hidden sm:inline">{lang === 'bn' ? 'এক্সপোর্ট' : 'Export'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Mobile Expandable Cards View (md:hidden) */}
                    <div className="md:hidden p-3.5 sm:p-4 bg-slate-50/50 space-y-3.5 flex-1 overflow-y-auto">
                      {displayedEmployees.map((emp) => {
                        const log = getEmployeeAttendanceRecord(emp.id, attendanceDate);
                        const metrics = getAttendanceMetrics(log);
                        const isPresent = log.status === 'On-Time' || (log.checkIn && log.checkIn !== '-');
                        const isLate = log.status === 'Late';
                        const isLeave = log.status === 'Leave';
                        const isAbsent = log.status === 'Absent' || (!log.checkIn || log.checkIn === '-');
                        const isExpanded = expandedAttendanceEmpId === emp.id;

                        return (
                          <div 
                            key={emp.id} 
                            onClick={() => setExpandedAttendanceEmpId(isExpanded ? null : emp.id)}
                            className={`bg-white border rounded-2xl p-4 shadow-xs transition-all cursor-pointer select-none space-y-3 ${
                              isExpanded ? 'border-brand-green/50 shadow-md' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            {/* Card Header: Avatar, Name, Shift, Status & Expand Chevron */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                    {emp.avatar ? (
                                      <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                    isAbsent ? 'bg-rose-500' : isLeave ? 'bg-blue-500' : isLate ? 'bg-amber-500' : isPresent ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-800 text-xs truncate">
                                    {lang === 'bn' ? emp.nameBn : emp.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                                    <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{emp.id}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[9.5px] font-extrabold border ${
                                    isAbsent
                                      ? 'bg-rose-50 text-rose-600 border-rose-200' 
                                      : isLeave
                                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                                        : isLate 
                                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {isAbsent
                                      ? (lang === 'bn' ? 'অনুপস্থিত' : 'Absent')
                                      : isLeave
                                        ? (lang === 'bn' ? 'ছুটি' : 'On Leave')
                                        : isLate 
                                          ? (lang === 'bn' ? 'বিলম্বে' : 'Late') 
                                          : (lang === 'bn' ? 'উপস্থিত' : 'Present')}
                                  </span>

                                  {log.markedBy && (
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold border ${
                                      log.markedBy.includes('এডমিন') || log.markedBy.includes('Admin')
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {log.markedBy}
                                    </span>
                                  )}
                                </div>

                                <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-brand-green/10 text-brand-green' : 'bg-slate-100 text-slate-400'}`}>
                                  <ChevronDown size={14} />
                                </div>
                              </div>
                            </div>

                            {/* In / Out Quick Grid */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-emerald-500 shrink-0" />
                                <span className="text-slate-400 text-[10px]">{lang === 'bn' ? 'প্রবেশ:' : 'In:'}</span>
                                <span className="font-mono font-bold text-slate-800 text-[10.5px]">{log.checkIn && log.checkIn !== '-' ? log.checkIn : '-'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-amber-500 shrink-0" />
                                <span className="text-slate-400 text-[10px]">{lang === 'bn' ? 'প্রস্থান:' : 'Out:'}</span>
                                <span className="font-mono font-bold text-slate-800 text-[10.5px]">{log.checkOut && log.checkOut !== '-' ? log.checkOut : (isPresent && attendanceDate === new Date().toISOString().split('T')[0] ? (lang === 'bn' ? 'কর্মরত...' : 'Working...') : '-')}</span>
                              </div>
                            </div>

                            {/* Quick summary & action row */}
                            <div className="flex items-center justify-between pt-0.5 text-[10px]">
                              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <span>{lang === 'bn' ? 'সময়:' : 'Duration:'}</span>
                                <span className="font-bold text-slate-800">{metrics.duration}</span>
                                <span>•</span>
                                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold border ${metrics.badgeColor}`}>
                                  {metrics.badgeLabel}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openManualAdjustmentModal(emp.id, attendanceDate);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-[10.5px] font-bold text-slate-700 hover:text-brand-green bg-slate-100/80 hover:bg-brand-green/10 border border-slate-200 hover:border-brand-green/30 rounded-xl shadow-2xs transition-all cursor-pointer"
                              >
                                <Edit3 size={11} className="text-brand-green" />
                                <span>{lang === 'bn' ? 'সমন্বয়' : 'Adjust'}</span>
                              </button>
                            </div>

                            {/* Expanded Details Accordion */}
                            {isExpanded && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                className="pt-3 border-t border-slate-100 space-y-2 text-[11px] animate-fade-in"
                              >
                                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                  <span className="text-slate-500 text-[10.5px] font-medium">{lang === 'bn' ? 'নির্ধারিত ডিউটি:' : 'Shift Duty:'}</span>
                                  <span className="font-bold text-slate-800">{emp.shiftStartTime || '09:00'} ({lang === 'bn' ? '৮ ঘণ্টা শিফট' : '8h Shift'})</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                  <span className="text-slate-500 text-[10.5px] font-medium">{lang === 'bn' ? 'কাজের সময়:' : 'Work Duration:'}</span>
                                  <span className="font-bold text-slate-800">{metrics.duration}</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                  <span className="text-slate-500 text-[10.5px] font-medium">{lang === 'bn' ? 'ওভারটাইম / শর্টফল:' : 'OT / Shortfall:'}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-semibold border ${metrics.badgeColor}`}>
                                    {metrics.badgeType === 'overtime' && <TrendingUp size={11} className="text-emerald-600 shrink-0" />}
                                    {metrics.badgeType === 'shortfall' && <ArrowDownRight size={11} className="text-orange-600 shrink-0" />}
                                    {metrics.badgeType === 'working' && <Clock size={11} className="text-amber-600 shrink-0" />}
                                    {metrics.badgeType === 'standard' && <Check size={11} className="text-slate-600 shrink-0" />}
                                    <span>{metrics.badgeLabel}</span>
                                  </span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                                  <span className="text-slate-500 text-[10.5px] font-medium">{lang === 'bn' ? 'লোকেশন:' : 'Location:'}</span>
                                  <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-800 truncate max-w-[200px]">
                                    <MapPin size={11} className="text-emerald-600 shrink-0" />
                                    <span className="truncate">{formatLocation(log.location || (isPresent ? (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop') : '-'))}</span>
                                  </span>
                                </div>
                                {log.note && (
                                  <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60 text-[11px] text-amber-900">
                                    <span className="font-bold text-amber-800 block mb-0.5">{lang === 'bn' ? 'নোট:' : 'Note:'}</span>
                                    {log.note}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Table View (hidden on mobile, shown on desktop md+) */}
                    <div className="hidden md:block overflow-x-auto flex-1 min-h-0">
                      <table className="w-full border-collapse text-left text-xs min-w-[760px]">
                        <thead className="bg-slate-50 sticky top-0 font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-100 z-10">
                          <tr>
                            <th className="px-4 py-3.5">{lang === 'bn' ? 'কর্মকর্তা' : 'Employee'}</th>
                            <th className="px-3 py-3.5">{lang === 'bn' ? 'প্রবেশ (In)' : 'In Time'}</th>
                            <th className="px-3 py-3.5">{lang === 'bn' ? 'প্রস্থান (Out)' : 'Out Time'}</th>
                            <th className="px-3 py-3.5">{lang === 'bn' ? 'কাজের সময়' : 'Duration'}</th>
                            <th className="px-3 py-3.5">{lang === 'bn' ? 'ওভারটাইম / কম সময়' : 'OT / Shortfall'}</th>
                            <th className="px-4 py-3.5">{lang === 'bn' ? 'লোকেশন' : 'Location'}</th>
                            <th className="px-3 py-3.5">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                            <th className="px-3 py-3.5">{lang === 'bn' ? 'এন্ট্রি মেথড' : 'Entry Source'}</th>
                            <th className="px-4 py-3.5 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-650">
                          {displayedEmployees.map((emp, empIdx) => {
                            const log = getEmployeeAttendanceRecord(emp.id, attendanceDate);
                            const metrics = getAttendanceMetrics(log);
                            const isPresent = log.status === 'On-Time' || (log.checkIn && log.checkIn !== '-');
                            const isLate = log.status === 'Late';
                            const isLeave = log.status === 'Leave';
                            const isAbsent = log.status === 'Absent' || (!log.checkIn || log.checkIn === '-');
                            const isExpanded = expandedAttendanceEmpId === emp.id;

                            return (
                              <React.Fragment key={emp.id}>
                                <tr 
                                  onClick={() => setExpandedAttendanceEmpId(isExpanded ? null : emp.id)}
                                  className={`cursor-pointer transition-all border-b border-slate-100 ${
                                    isExpanded 
                                      ? 'bg-brand-green/5 border-brand-green/20' 
                                      : empIdx % 2 === 0 
                                        ? 'bg-white hover:bg-slate-50' 
                                        : 'bg-slate-50/60 hover:bg-slate-100/60'
                                  }`}
                                  title={lang === 'bn' ? 'বিস্তারিত দেখতে বা লুকাতে ক্লিক করুন' : 'Click to expand/collapse details'}
                                >
                                  {/* Employee Info with expand chevron */}
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180 text-brand-green' : 'text-slate-400'}`}>
                                        <ChevronDown size={14} />
                                      </div>
                                      <div className="relative shrink-0">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-2xs">
                                          {emp.avatar ? (
                                            <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <span className="text-[11px] font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                          )}
                                        </div>
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                          isAbsent ? 'bg-rose-500' : isLeave ? 'bg-blue-500' : isLate ? 'bg-amber-500' : isPresent ? 'bg-emerald-500' : 'bg-slate-300'
                                        }`} />
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-800 text-[11px] leading-tight">
                                          {lang === 'bn' ? emp.nameBn : emp.name}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[9px] text-slate-500 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{emp.id}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Check In */}
                                  <td className="px-3 py-3.5 font-medium whitespace-nowrap">
                                    {log.checkIn && log.checkIn !== '-' ? (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 text-[11px]">
                                        <Clock size={11} className="text-emerald-500" />
                                        {log.checkIn}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-mono">-</span>
                                    )}
                                  </td>

                                  {/* Check Out */}
                                  <td className="px-3 py-3.5 font-medium whitespace-nowrap">
                                    {log.checkOut && log.checkOut !== '-' ? (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 text-[11px]">
                                        <Clock size={11} className="text-amber-500" />
                                        {log.checkOut}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-mono">
                                        {log.checkIn && log.checkIn !== '-' && attendanceDate === new Date().toISOString().split('T')[0] ? (
                                          <span className="text-amber-600 text-[10px] font-semibold">{lang === 'bn' ? 'কর্মরত...' : 'Working...'}</span>
                                        ) : '-'}
                                      </span>
                                    )}
                                  </td>

                                  {/* Duration */}
                                  <td className="px-3 py-3.5 whitespace-nowrap font-medium text-[11px]">
                                    {metrics.duration !== '-' ? (
                                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {metrics.duration}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>

                                  {/* Overtime / Shortfall */}
                                  <td className="px-3 py-3.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${metrics.badgeColor}`}>
                                      {metrics.badgeType === 'overtime' && <TrendingUp size={11} className="text-emerald-600 shrink-0" />}
                                      {metrics.badgeType === 'shortfall' && <ArrowDownRight size={11} className="text-orange-600 shrink-0" />}
                                      {metrics.badgeType === 'working' && <Clock size={11} className="text-amber-600 shrink-0" />}
                                      {metrics.badgeType === 'standard' && <Check size={11} className="text-slate-600 shrink-0" />}
                                      <span>{metrics.badgeLabel}</span>
                                    </span>
                                  </td>

                                  {/* Location */}
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    {isPresent ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        <MapPin size={10} className="text-emerald-600 shrink-0" />
                                        <span>{formatLocation(log.location || (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'))}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">-</span>
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="px-3 py-3.5 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                      isAbsent
                                        ? 'bg-red-50 text-red-600 border border-red-200' 
                                        : isLeave
                                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                          : isLate 
                                            ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                            : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    }`}>
                                      {isAbsent
                                        ? (lang === 'bn' ? 'অনুপস্থিত' : 'Absent')
                                        : isLeave
                                          ? (lang === 'bn' ? 'ছুটি' : 'On Leave')
                                          : isLate 
                                            ? (lang === 'bn' ? 'বিলম্বে' : 'Late') 
                                            : (lang === 'bn' ? 'যথাসময়ে' : 'Present')}
                                    </span>
                                  </td>

                                  {/* Entry Method / Source */}
                                  <td className="px-3 py-3.5 whitespace-nowrap">
                                    {log.markedBy ? (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                                        log.markedBy.includes('এডমিন') || log.markedBy.includes('Admin')
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}>
                                        {log.markedBy}
                                      </span>
                                    ) : isPresent ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        {lang === 'bn' ? 'ডিজিটাল পাঞ্চ' : 'Digital Punch'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-mono">-</span>
                                    )}
                                  </td>

                                  {/* Action */}
                                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openManualAdjustmentModal(emp.id, attendanceDate);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:text-brand-green bg-white hover:bg-brand-green/5 border border-slate-200 hover:border-brand-green/30 rounded-lg shadow-2xs transition-all cursor-pointer"
                                      title={lang === 'bn' ? 'হাজিরা রেকর্ড সমন্বয় করুন' : 'Adjust Attendance Record'}
                                    >
                                      <Edit3 size={11} className="text-brand-green" />
                                      <span>{lang === 'bn' ? 'সমন্বয়' : 'Adjust'}</span>
                                    </button>
                                  </td>
                                </tr>

                                {/* Desktop Expanded Accordion Details */}
                                {isExpanded && (
                                  <tr className="bg-slate-50/80 border-b border-slate-200/80">
                                    <td colSpan={9} className="px-6 py-4">
                                      <div 
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3 animate-fade-in"
                                      >
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                          <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-brand-green" />
                                            <span className="font-extrabold text-slate-800 text-xs">
                                              {lang === 'bn' ? `${emp.nameBn} (${emp.id}) - বিস্তারিত উপস্থিতি ও শিফট বিবরণী` : `${emp.name} (${emp.id}) - Attendance Details`}
                                            </span>
                                          </div>
                                          <span className="text-[10.5px] text-slate-400 font-medium">
                                            {lang === 'bn' ? `তারিখ: ${attendanceDate}` : `Date: ${attendanceDate}`}
                                          </span>
                                        </div>

                                        {/* Detailed stats grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-bold block">{lang === 'bn' ? 'নির্ধারিত শিফট শুরু:' : 'Assigned Shift:'}</span>
                                            <span className="font-bold text-slate-700">{emp.shiftStartTime || '09:00'} ({lang === 'bn' ? '৮ ঘণ্টা শিফট' : '8h Shift'})</span>
                                          </div>
                                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-bold block">{lang === 'bn' ? 'কাজের প্রকৃত সময়:' : 'Total Work Duration:'}</span>
                                            <span className="font-bold text-slate-800">{metrics.duration}</span>
                                          </div>
                                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-bold block">{lang === 'bn' ? 'ওভারটাইম / শর্টফল:' : 'OT / Shortfall:'}</span>
                                            <span className={`inline-flex items-center gap-1 font-bold text-xs ${metrics.badgeType === 'overtime' ? 'text-emerald-700' : metrics.badgeType === 'shortfall' ? 'text-orange-700' : 'text-slate-700'}`}>
                                              {metrics.badgeType === 'overtime' && <TrendingUp size={12} className="text-emerald-600" />}
                                              {metrics.badgeType === 'shortfall' && <ArrowDownRight size={12} className="text-orange-600" />}
                                              {metrics.badgeLabel}
                                            </span>
                                          </div>
                                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <span className="text-[10px] text-slate-400 font-bold block">{lang === 'bn' ? 'জিপিএস ভেরিফায়েড লোকেশন:' : 'GPS Location:'}</span>
                                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-xs truncate">
                                              <MapPin size={11} className="text-emerald-600 shrink-0" />
                                              <span className="truncate">{formatLocation(log.location || (isPresent ? (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop') : '-'))}</span>
                                            </span>
                                          </div>
                                        </div>

                                        {/* Note / Remarks if any */}
                                        {log.note && (
                                          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
                                            <FileText size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                              <span className="font-bold block">{lang === 'bn' ? 'উপস্থিতি নোট / কারণ:' : 'Attendance Note / Reason:'}</span>
                                              <span>{log.note}</span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Quick action footer */}
                                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-400">{lang === 'bn' ? 'এন্ট্রি মেথড / সোর্স:' : 'Entry Source:'}</span>
                                            <span className="font-semibold text-slate-700">{log.markedBy || (isPresent ? (lang === 'bn' ? 'ডিজিটাল পাঞ্চ' : 'Digital Punch') : '-')}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openManualAdjustmentModal(emp.id, attendanceDate);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-brand-green hover:bg-brand-green-dark rounded-xl shadow-2xs transition-all cursor-pointer"
                                          >
                                            <Sliders size={12} />
                                            <span>{lang === 'bn' ? 'রেকর্ড সমন্বয় করুন' : 'Adjust Record'}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Footer info banner */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 font-medium gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{lang === 'bn' ? '৮ ঘণ্টার বেশি কাজ করলে স্বয়ংক্রিয়ভাবে ওভারটাইম (OT) যুক্ত হয়।' : 'Working over 8 hours automatically calculates Overtime (OT).'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-orange-600">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                        <span>{lang === 'bn' ? '৮ ঘণ্টার কম কাজ করলে শর্টফল/কম সময় রেকর্ড হয়।' : 'Working under 8 hours records early leave/shortfall.'}</span>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })() : activeTab === 'employees' ? (
              activeEmpProfileId ? (() => {
                const emp = employeesList.find(e => e.id === activeEmpProfileId);
                if (!emp) return null;

                const calc = calculateMonthlySalary(emp, selectedProfileMonth, holidaysList);
                const isPaid = loadPaymentStatus(emp.id, selectedProfileMonth);
                
                const empStorageKey = `ob_attendance_logs_${emp.id}`;
                const empSavedLogs = localStorage.getItem(empStorageKey);
                const empLogsList = empSavedLogs ? (JSON.parse(empSavedLogs) as AttendanceLog[]) : [];
                const monthLogs = empLogsList.filter(log => log.date.startsWith(selectedProfileMonth));

                const monthsOptions: string[] = [];
                const now = new Date();
                for (let i = 0; i < 6; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  monthsOptions.push(d.toISOString().substring(0, 7));
                }

                return (
                  <div className="space-y-6 font-sans animate-fade-in select-none">
                    {/* Header bar */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setActiveEmpProfileId(null)}
                          className="flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border-0 shadow-sm"
                          title={lang === 'bn' ? 'তালিকায় ফিরে যান' : 'Back to list'}
                        >
                          <X size={16} />
                        </button>
                        <div className="w-11 h-11 rounded-full bg-slate-100 border-2 border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
                          {emp.avatar ? (
                            <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-extrabold text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-base leading-tight">
                            {lang === 'bn' ? `${emp.nameBn} এর প্রোফাইল` : `${emp.name}'s Profile`}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10.5px] text-slate-600 font-bold font-mono bg-slate-100 px-2 py-0.5 rounded-md">ID: {emp.id}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const textToCopy = `স্মার্ট ট্রেডিং লগইন তথ্য:
কর্মকর্তার নাম: ${emp.nameBn} (${emp.name})
আইডি: ${emp.id}
ইমেইল: ${emp.email}
পাসওয়ার্ড: ${emp.password || '1234'}
লগইন লিঙ্ক: ${window.location.origin}/login`;
                                navigator.clipboard.writeText(textToCopy);
                                setCopiedEmailId(emp.id);
                                setTimeout(() => setCopiedEmailId(null), 2000);
                              }}
                              className="text-[10.5px] text-emerald-800 font-bold font-mono bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                              title={lang === 'bn' ? 'ক্লিক করে সম্পূর্ণ লগইন তথ্য কপি করুন' : 'Click to copy full login details'}
                            >
                              <Lock size={11} className="text-emerald-600" />
                              <span>{lang === 'bn' ? 'পাসওয়ার্ড:' : 'Password:'} {emp.password || '1234'}</span>
                              {copiedEmailId === emp.id ? (
                                <Check size={11} className="text-emerald-600 font-bold" />
                              ) : (
                                <Copy size={11} className="text-slate-400" />
                              )}
                            </button>
                            <span className="text-[10.5px] text-slate-400 font-bold">
                              {lang === 'bn' ? `⏰ ডিউটি শুরু: ${emp.shiftStartTime || '09:00'}` : `⏰ Shift: ${emp.shiftStartTime || '09:00'}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setReportEmpId(emp.id);
                            generateAttendanceReport(undefined, emp.id);
                            navigate('/dashboard?tab=report');
                          }}
                          className="flex items-center gap-1.5 bg-brand-green/10 hover:bg-brand-green/20 text-brand-green text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-brand-green/20"
                        >
                          <ClipboardList size={13} />
                          <span>{lang === 'bn' ? 'হাজিরা ও লেট শিট' : 'Attendance Sheet'}</span>
                        </button>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl font-bold hidden sm:inline-block">
                          {lang === 'bn' ? 'প্রোফাইল ভিউ' : 'Profile View'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      
                      {/* Left Card: Edit Info & Salary Structure */}
                      <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-5">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <User size={16} className="text-brand-green" />
                          <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'তথ্য ও কাঠামো পরিবর্তন' : 'Update Info & Salary Structure'}
                          </h5>
                        </div>

                        <form onSubmit={handleSaveEmployeeProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Profile Image Uploader Box */}
                          <div className="md:col-span-2 flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                            <div className="relative group">
                              <div className="w-20 h-20 rounded-full bg-white border-2 border-slate-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                                {editAvatar ? (
                                  <img src={editAvatar} alt={editName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-brand-green/10 flex items-center justify-center text-brand-green font-extrabold text-xl font-sans">
                                    {editName ? editName.charAt(0).toUpperCase() : <User size={28} />}
                                  </div>
                                )}
                              </div>
                              <label 
                                className="absolute bottom-0 right-0 p-1.5 bg-brand-green hover:bg-brand-green-dark text-white rounded-full cursor-pointer shadow-md transition-all flex items-center justify-center"
                                title={lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change photo'}
                              >
                                <Camera size={13} />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) compressAndResizeImage(file, (url) => setEditAvatar(url));
                                  }} 
                                />
                              </label>
                            </div>
                            <div className="flex-1 text-center sm:text-left space-y-1">
                              <h6 className="font-extrabold text-slate-800 text-xs">
                                {lang === 'bn' ? 'কর্মকর্তার প্রোফাইল ছবি (Profile Photo)' : 'Profile Photo'}
                              </h6>
                              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                                {lang === 'bn' ? 'ডিভাইস থেকে কর্মকর্তার পাসপোর্ট সাইজ ছবি যুক্ত বা পরিবর্তন করুন।' : 'Upload or change employee portrait photo from your device.'}
                              </p>
                              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all shadow-2xs">
                                  <Upload size={12} className="text-brand-green" />
                                  <span>{editAvatar ? (lang === 'bn' ? 'ছবি পরিবর্তন' : 'Change Photo') : (lang === 'bn' ? 'ছবি নির্বাচন' : 'Upload Photo')}</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) compressAndResizeImage(file, (url) => setEditAvatar(url));
                                    }} 
                                  />
                                </label>
                                {editAvatar && (
                                  <button
                                    type="button"
                                    onClick={() => setEditAvatar('')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10.5px] font-bold cursor-pointer transition-all border border-rose-200/50"
                                  >
                                    <Trash2 size={11} />
                                    <span>{lang === 'bn' ? 'ছবি মুছুন' : 'Remove'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{lang === 'bn' ? 'নাম (Name)' : 'Name'}</label>
                            <input type="text" value={editName} onChange={(e) => { setEditName(e.target.value); setEditNameBn(e.target.value); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800" required />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{lang === 'bn' ? 'পদবী (Designation)' : 'Designation'}</label>
                            <input
                              type="text"
                              value={editDesignation}
                              placeholder={lang === 'bn' ? 'যেমন: সেলস এক্সিকিউটিভ / শপ ম্যানেজার' : 'e.g. Sales Executive / Shop Manager'}
                              onChange={(e) => {
                                setEditDesignation(e.target.value);
                                setEditDesignationBn(e.target.value);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{lang === 'bn' ? 'ডিউটি শুরুর সময়' : 'Duty Start Time'}</label>
                            <input type="time" value={editShiftStartTime} onChange={(e) => setEditShiftStartTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800" required />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{lang === 'bn' ? 'ইমেইল' : 'Email'}</label>
                            <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                              <input
                                type="text"
                                value={editEmailPrefix}
                                onChange={(e) => setEditEmailPrefix(e.target.value.toLowerCase().replace(/@smarttrading\.com/g, '').replace(/[^a-z0-9._-]/g, ''))}
                                className="flex-1 min-w-0 bg-transparent px-3 py-2 text-xs outline-none font-bold text-slate-800"
                                required
                              />
                              <span className="shrink-0 whitespace-nowrap bg-slate-200/80 text-slate-600 px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold font-mono border-l border-slate-200 select-none">
                                @smarttrading.com
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}</label>
                            <input type="date" value={editJoiningDate} onChange={(e) => setEditJoiningDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800" required />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                              {lang === 'bn' ? 'লগইন পাসওয়ার্ড (Login Password)' : 'Login Password'}
                            </label>
                            <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                              <span className="pl-3 text-slate-400">
                                <Lock size={13} />
                              </span>
                              <input
                                type={showEditPassword ? 'text' : 'password'}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="flex-1 bg-transparent px-2.5 py-2 text-xs outline-none font-bold text-slate-800 font-mono"
                                placeholder="e.g. 1234"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditPassword(!showEditPassword)}
                                className="px-2.5 py-2 text-slate-400 hover:text-slate-600 cursor-pointer border-0 bg-transparent"
                                title={showEditPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide') : (lang === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show')}
                              >
                                {showEditPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                            <span className="text-[9.5px] text-slate-400 font-sans block mt-1">
                              {lang === 'bn' ? 'স্টাফ এই পাসওয়ার্ড ব্যবহার করে তার পোর্টালে লগইন করতে পারবেন।' : 'Staff will use this password to log into their portal.'}
                            </span>
                          </div>

                          <div className="md:col-span-2 pt-2 border-t border-slate-100 mt-1">
                            <div className="flex justify-between items-center mb-2">
                              <span className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wide">
                                {lang === 'bn' ? 'বেতন ও কাঠামো এডিট (Salary Configuration)' : 'Salary Configuration'}
                              </span>
                              {emp.baseSalary !== parseInt(editSalary) && !isNaN(parseInt(editSalary)) && (
                                <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                                  parseInt(editSalary) > emp.baseSalary 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  <TrendingUp size={11} />
                                  {parseInt(editSalary) > emp.baseSalary ? (lang === 'bn' ? 'বেতন বৃদ্ধি: +' : 'Increment: +') : (lang === 'bn' ? 'বেতন হ্রাস: -' : 'Decrement: -')} 
                                  ৳{Math.abs(parseInt(editSalary) - emp.baseSalary).toLocaleString()}
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-1">
                              <label className="block text-[9.5px] font-bold text-slate-500 mb-1">{lang === 'bn' ? 'মাসিক মূল বেতন (Monthly Basic Salary ৳)' : 'Monthly Basic Salary (৳)'}</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">৳</span>
                                <input 
                                  type="number" 
                                  value={editSalary} 
                                  onChange={(e) => setEditSalary(e.target.value)} 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800 font-sans" 
                                  placeholder="30000"
                                  required 
                                />
                              </div>
                              <span className="text-[9px] text-slate-400 font-medium block">
                                {lang === 'bn' ? 'কর্মকর্তার নির্ধারিত মাসিক মূল বেতন। অগ্রিম ও কর্তন প্রতি মাসের বেতন প্রক্রিয়াকরণে স্বয়ংক্রিয়ভাবে হিসাব হয়।' : 'Employee fixed monthly base salary. Advance and deductions are calculated during monthly payroll.'}
                              </span>
                            </div>

                            {/* Optional Increment Note Input when Salary is changed */}
                            {emp.baseSalary !== parseInt(editSalary) && !isNaN(parseInt(editSalary)) && (
                              <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/70 rounded-2xl space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold flex-wrap gap-1">
                                  <span className="flex items-center gap-1">
                                    <FileText size={11} className="text-amber-700 shrink-0" />
                                    <span>{lang === 'bn' ? 'বেতন পরিবর্তনের কারণ / মন্তব্য (ঐচ্ছিক):' : 'Reason for Salary Change (Optional):'}</span>
                                  </span>
                                  <span className="text-amber-600 font-mono flex items-center gap-1">
                                    <span>{lang === 'bn' ? 'পূর্বের বেতন: ' : 'Prev: '}৳{emp.baseSalary.toLocaleString()}</span>
                                    <ArrowRight size={10} className="shrink-0" />
                                    <span>{lang === 'bn' ? 'নতুন: ' : 'New: '}৳{(parseInt(editSalary)||0).toLocaleString()}</span>
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  placeholder={lang === 'bn' ? 'যেমন: বার্ষিক ইনক্রিমেন্ট, পারফরম্যান্স বোনাস, পদোন্নতি ইত্যাদি' : 'e.g. Annual increment, promotion, etc.'}
                                  value={editSalaryNote}
                                  onChange={(e) => setEditSalaryNote(e.target.value)}
                                  className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-brand-green font-medium"
                                />
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-2 flex justify-end pt-3">
                            <button
                              type="submit"
                              className="bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-2 px-6 font-bold uppercase tracking-wider text-xs cursor-pointer shadow-sm border-0"
                            >
                              {lang === 'bn' ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Right Card: Multi-Month Payroll Engine */}
                      <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-5 flex flex-col min-h-full">
                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 shrink-0">
                          <div className="flex items-center gap-2">
                            <Wallet size={16} className="text-brand-green" />
                            <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                              {lang === 'bn' ? 'মাস ভিত্তিক বেতন হিসাব' : 'Monthly Payroll Breakdown'}
                            </h5>
                          </div>
                          
                          {/* Month Selector dropdown */}
                          <select
                            value={selectedProfileMonth}
                            onChange={(e) => setSelectedProfileMonth(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            {monthsOptions.map(m => {
                              const [y, mn] = m.split('-');
                              const monthName = mn === '01' ? (lang === 'bn' ? 'জানুয়ারি' : 'Jan') :
                                                mn === '02' ? (lang === 'bn' ? 'ফেব্রুয়ারি' : 'Feb') :
                                                mn === '03' ? (lang === 'bn' ? 'মার্চ' : 'Mar') :
                                                mn === '04' ? (lang === 'bn' ? 'এপ্রিল' : 'Apr') :
                                                mn === '05' ? (lang === 'bn' ? 'মে' : 'May') :
                                                mn === '06' ? (lang === 'bn' ? 'জুন' : 'Jun') :
                                                mn === '07' ? (lang === 'bn' ? 'জুলাই' : 'Jul') :
                                                mn === '08' ? (lang === 'bn' ? 'আগস্ট' : 'Aug') :
                                                mn === '09' ? (lang === 'bn' ? 'সেপ্টেম্বর' : 'Sep') :
                                                mn === '10' ? (lang === 'bn' ? 'অক্টোবর' : 'Oct') :
                                                mn === '11' ? (lang === 'bn' ? 'নভেম্বর' : 'Nov') :
                                                (lang === 'bn' ? 'ডিসেম্বর' : 'Dec');
                              return (
                                <option key={m} value={m}>
                                  {monthName} {y}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="space-y-4 text-xs flex-1">
                          <div className="grid grid-cols-2 gap-3.5">
                            <div className="bg-slate-50/70 border border-slate-100 p-3 rounded-2xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold mb-0.5">{lang === 'bn' ? 'মূল বেতন (Basic):' : 'Basic:'}</span>
                              <span className="font-extrabold text-slate-800 text-sm font-sans">৳{calc.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 p-3 rounded-2xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold mb-0.5">{lang === 'bn' ? 'অনুপস্থিতি কর্তন:' : 'Absent Deduct:'}</span>
                              <span className="font-extrabold text-rose-600 text-sm font-sans">
                                - ৳{calc.absentDeduction.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-bold block">({calc.absentDaysCount} {lang === 'bn' ? 'দিন' : 'days'})</span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 p-3 rounded-2xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold mb-0.5">{lang === 'bn' ? '৩ দিন লেট কর্তন:' : 'Late Cut (3:1):'}</span>
                              <span className="font-extrabold text-rose-600 text-sm font-sans">
                                - ৳{calc.lateDeduction.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-bold block">({calc.lateCount} {lang === 'bn' ? 'লেট =' : 'lates ='} {calc.lateCutDays} {lang === 'bn' ? 'দিন কাটা' : 'day cut'})</span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 p-3 rounded-2xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold mb-0.5">{lang === 'bn' ? 'শুক্রবার কাজের বোনাস:' : 'Friday Bonus:'}</span>
                              <span className="font-extrabold text-emerald-600 text-sm font-sans">
                                + ৳{calc.fridayBonus.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-bold block">({calc.fridayWorkedCount} {lang === 'bn' ? 'শুক্রবার' : 'Fridays'})</span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 p-3 rounded-2xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold mb-0.5">{lang === 'bn' ? 'ওভারটাইম আয়:' : 'Overtime Pay:'}</span>
                              <span className="font-extrabold text-emerald-600 text-sm font-sans">
                                + ৳{calc.otPay.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-bold block">({calc.otHours} {lang === 'bn' ? 'ঘণ্টা' : 'hours'})</span>
                            </div>
                            <div className="bg-slate-50/70 border border-slate-100 p-3 rounded-2xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold mb-0.5">{lang === 'bn' ? 'অগ্রিম ও কর্তন:' : 'Advance/Deduct:'}</span>
                              <span className="font-extrabold text-amber-600 text-sm font-sans">
                                - ৳{(calc.advanceSalary + calc.deductions).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-650">
                              <span>{lang === 'bn' ? 'উপস্থিতি (পেইড দিন):' : 'Paid Days:'}</span>
                              <span className="bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-lg font-mono">
                                {calc.paidDays} / {calc.totalCalendarDays} {lang === 'bn' ? 'দিন' : 'days'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                              <div>
                                <span className="text-slate-500 font-bold block text-[10px] uppercase tracking-wide">{lang === 'bn' ? 'প্রদেয় নিট বেতন:' : 'Net Payable:'}</span>
                                <span className="text-brand-green font-black text-base font-sans">
                                  ৳{calc.netPayable.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </span>
                              </div>

                              <button
                                onClick={() => togglePaymentStatus(emp.id, selectedProfileMonth)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 shadow-sm ${
                                  isPaid 
                                    ? 'bg-emerald-50 text-emerald-750 hover:bg-emerald-100' 
                                    : 'bg-brand-green text-white hover:bg-brand-green-dark'
                                }`}
                              >
                                {isPaid ? (
                                  <span className="flex items-center gap-1.5">
                                    <Check size={13} />
                                    <span>{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    <Wallet size={13} />
                                    <span>{lang === 'bn' ? 'পরিশোধ করুন' : 'Mark Paid'}</span>
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Salary Increment & Change History Card */}
                    <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4 font-sans">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-600" />
                          <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'বেতন বৃদ্ধি ও পরিবর্তনের ইতিহাস (Salary Increment History)' : 'Salary Revision & Increment History'}
                          </h5>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100 font-sans">
                          {emp.salaryHistory?.length || 0} {lang === 'bn' ? 'টি রেকর্ড' : 'Records'}
                        </span>
                      </div>

                      {(!emp.salaryHistory || emp.salaryHistory.length === 0) ? (
                        <div className="text-center py-6 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                          <History size={24} className="mx-auto mb-2 text-slate-300" />
                          <p className="font-bold text-slate-500">
                            {lang === 'bn' ? 'এখনো কোনো বেতন বৃদ্ধির ইতিহাস নেই' : 'No salary increment history recorded yet'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {lang === 'bn' ? 'উপরের ফর্মে মূল বেতন পরিবর্তন করে সেভ করলেই পূর্বের বেতনসহ সব রেকর্ড এখানে স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।' : 'When salary is updated above, previous salary and increment details will be recorded here.'}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse font-sans">
                            <thead className="bg-slate-50/70 border-b border-slate-100 text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-2.5">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                                <th className="px-4 py-2.5">{lang === 'bn' ? 'পূর্বের বেতন' : 'Previous Salary'}</th>
                                <th className="px-4 py-2.5">{lang === 'bn' ? 'নতুন বেতন' : 'New Salary'}</th>
                                <th className="px-4 py-2.5">{lang === 'bn' ? 'বৃদ্ধির পরিমাণ' : 'Increment'}</th>
                                <th className="px-4 py-2.5">{lang === 'bn' ? 'কারণ / বিবরণ' : 'Note / Reason'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                              {emp.salaryHistory.map((rec, idx) => {
                                const isIncrease = rec.incrementAmount > 0;
                                const isZero = rec.incrementAmount === 0;
                                return (
                                  <tr key={rec.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-bold text-slate-800 text-[11px]">
                                      {rec.date}
                                    </td>
                                    <td className="px-4 py-3 font-bold font-mono text-slate-500">
                                      {rec.previousSalary > 0 ? `৳${rec.previousSalary.toLocaleString()}` : (lang === 'bn' ? 'শুরুর বেতন' : 'Initial')}
                                    </td>
                                    <td className="px-4 py-3 font-black font-mono text-slate-800">
                                      ৳{rec.newSalary.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 font-bold font-mono">
                                      {isZero ? (
                                        <span className="text-slate-400">০</span>
                                      ) : isIncrease ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 text-[11px]">
                                          <ArrowUpRight size={12} />
                                          +৳{rec.incrementAmount.toLocaleString()}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 text-[11px]">
                                          <ArrowDownRight size={12} />
                                          -৳{Math.abs(rec.incrementAmount).toLocaleString()}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 text-[11px]">
                                      {rec.note || (isIncrease ? (lang === 'bn' ? 'বেতন বৃদ্ধি' : 'Salary Increment') : (lang === 'bn' ? 'বেতন সমন্বয়' : 'Adjustment'))}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Timeline Card: Attendance Logs for the selected month */}
                    <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4">
                      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 shrink-0">
                        <History size={16} className="text-brand-green" />
                        <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          {lang === 'bn' ? `${selectedProfileMonth} মাসের উপস্থিতি রেকর্ড` : `Attendance Logs for ${selectedProfileMonth}`}
                        </h5>
                      </div>

                      <div className="overflow-x-auto w-full select-text">
                        <table className="w-full border-collapse text-left text-xs font-sans">
                          <thead className="bg-slate-50 sticky top-0 font-bold text-slate-500 uppercase tracking-wider text-[8.5px] border-b border-slate-150">
                            <tr>
                              <th className="px-4 py-2">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                              <th className="px-4 py-2">{lang === 'bn' ? 'প্রবেশ সময়' : 'In Time'}</th>
                              <th className="px-4 py-2">{lang === 'bn' ? 'প্রস্থান সময়' : 'Out Time'}</th>
                              <th className="px-4 py-2 text-right">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600">
                            {monthLogs.map((log, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-2 font-mono">{log.date}</td>
                                <td className="px-4 py-2 font-mono font-medium">{log.checkIn || '-'}</td>
                                <td className="px-4 py-2 font-mono font-medium">{log.checkOut || '-'}</td>
                                <td className="px-4 py-2 text-right">
                                  <span className={`inline-flex px-2 py-0.2 rounded-full text-[8.5px] font-bold ${
                                    log.status === 'Late' 
                                      ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  }`}>
                                    {log.status === 'Late' ? (lang === 'bn' ? 'বিলম্বে' : 'Late') : (lang === 'bn' ? 'উপস্থিত' : 'Present')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {monthLogs.length === 0 && (
                              <tr>
                                <td colSpan={4} className="text-center py-6 text-slate-400">
                                  {lang === 'bn' ? 'নির্বাচিত মাসে কোনো উপস্থিতির রেকর্ড পাওয়া যায়নি।' : 'No attendance logs recorded this month.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                );
              })() : (


              /* Admin Tab 2: Employee list & create directory */
              <div className="flex flex-col gap-6 flex-1 font-sans">
                {/* Form to Add New Employee */}
                {/* Mobile view trigger button */}
                <div className="md:hidden block shrink-0">
                  <button
                    onClick={() => {
                      setNewId(getNextEmployeeId(employeesList));
                      setShowAddEmpMobileModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-2xl py-3 px-6 font-bold uppercase tracking-wider text-xs cursor-pointer shadow-lg shadow-brand-green/25 border-0 font-sans"
                  >
                    <PlusCircle size={16} />
                    <span>{lang === 'bn' ? 'নতুন কর্মকর্তা যোগ করুন' : 'Add New Employee'}</span>
                  </button>
                </div>

                {/* Mobile Full-Screen Overlay Modal */}
                {showAddEmpMobileModal && (
                  <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-screen w-screen overflow-hidden font-sans animate-fade-in select-none">
                    {/* Header bar */}
                    <div className="bg-white border-b border-slate-200 p-4.5 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        <PlusCircle className="text-brand-green w-5 h-5" />
                        <h4 className="font-extrabold text-slate-800 text-sm">
                          {lang === 'bn' ? 'নতুন কর্মকর্তা যোগ করুন' : 'Add New Employee'}
                        </h4>
                      </div>
                      <button
                        onClick={() => setShowAddEmpMobileModal(false)}
                        className="flex items-center justify-center p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border-0 shadow-sm"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Scrollable form body */}
                    <form onSubmit={handleAddEmployee} className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Photo Picker */}
                    <div className="flex items-center gap-3.5 p-3.5 bg-slate-100/70 rounded-2xl border border-slate-200/80">
                      <div className="w-13 h-13 rounded-full bg-white border-2 border-slate-200 shadow-2xs overflow-hidden flex items-center justify-center shrink-0">
                        {newAvatar ? (
                          <img src={newAvatar} alt="New employee" className="w-full h-full object-cover" />
                        ) : (
                          <User size={22} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-[10px] font-bold text-slate-700 block uppercase tracking-wider">
                          {lang === 'bn' ? 'প্রোফাইল ছবি (ঐচ্ছিক)' : 'Profile Photo (Optional)'}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[10.5px] font-bold cursor-pointer shadow-2xs">
                            <Camera size={12} className="text-brand-green" />
                            <span>{newAvatar ? (lang === 'bn' ? 'ছবি পরিবর্তন' : 'Change') : (lang === 'bn' ? 'ছবি নির্বাচন' : 'Add Photo')}</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) compressAndResizeImage(file, (url) => setNewAvatar(url));
                              }} 
                            />
                          </label>
                          {newAvatar && (
                            <button
                              type="button"
                              onClick={() => setNewAvatar('')}
                              className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold underline cursor-pointer"
                            >
                              {lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          {lang === 'bn' ? 'আইডি (আবশ্যিক)' : 'Employee ID (Req)'}
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded font-sans">
                          <Zap size={9} className="text-brand-green shrink-0" />
                          <span>{lang === 'bn' ? 'অটো আইডি' : 'Auto ID'}</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. ST-106"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'ইমেইল ইউজারনেম (আবশ্যিক)' : 'Email / Username (Req)'}
                      </label>
                      <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                        <input
                          type="text"
                          placeholder="kamrul"
                          value={newEmailPrefix}
                          onChange={(e) => setNewEmailPrefix(e.target.value.toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9._-]/g, ''))}
                          className="flex-1 min-w-0 bg-transparent px-3.5 py-2 text-xs outline-none font-bold text-slate-800"
                          required
                        />
                        <span className="shrink-0 whitespace-nowrap bg-slate-200/80 text-slate-600 px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold font-mono border-l border-slate-200 select-none">
                          @smarttrading.com
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'নাম (আবশ্যিক)' : 'Full Name (Req)'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kamrul Hasan"
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value);
                          if (!newEmailPrefix) {
                            const suggestedPrefix = e.target.value.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
                            setNewEmailPrefix(suggestedPrefix);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'নাম বাংলায় (ঐচ্ছিক)' : 'Name in Bangla (Optional)'}
                      </label>
                      <input
                        type="text"
                        placeholder="যেমন: কামরুল হাসান"
                        value={newNameBn}
                        onChange={(e) => setNewNameBn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                      />
                    </div>



                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'ডিউটি শুরুর সময় (Duty In-Time)' : 'Duty Start Time'}
                      </label>
                      <input
                        type="time"
                        value={newShiftStartTime}
                        onChange={(e) => setNewShiftStartTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'মাসিক মূল বেতন (৳)' : 'Monthly Base Salary (৳)'}
                      </label>
                      <input
                        type="number"
                        placeholder="30000"
                        value={newSalary}
                        onChange={(e) => setNewSalary(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
                      </label>
                      <input
                        type="date"
                        value={newJoiningDate}
                        onChange={(e) => setNewJoiningDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'লগইন পাসওয়ার্ড (আবশ্যিক)' : 'Login Password (Req)'}
                      </label>
                      <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                        <span className="pl-3.5 text-slate-400">
                          <Lock size={13} />
                        </span>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="e.g. 1234"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="flex-1 bg-transparent px-3 py-2 text-xs outline-none font-bold text-slate-800 font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="px-3 py-2 text-slate-400 hover:text-slate-600 cursor-pointer border-0 bg-transparent"
                          title={showNewPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide') : (lang === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show')}
                        >
                          {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      <span className="text-[9.5px] text-slate-400 font-sans block mt-1">
                        {lang === 'bn' ? 'ডিফল্ট পাসওয়ার্ড: 1234 (পরিবর্তনযোগ্য)' : 'Default password: 1234 (changeable)'}
                      </span>
                    </div>

                      
                      {/* Safe bottom spacing for scroll */}
                      <div className="h-24" />
                      
                      {/* Fixed sticky bottom submit button */}
                      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-150 p-4 shrink-0 flex gap-3 z-10">
                        <button
                          type="button"
                          onClick={() => setShowAddEmpMobileModal(false)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 font-bold text-xs cursor-pointer border-0 shadow-sm"
                        >
                          {lang === 'bn' ? 'বন্ধ করুন' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-3 font-bold uppercase tracking-wider text-xs cursor-pointer shadow-lg shadow-brand-green/25 border-0"
                        >
                          {lang === 'bn' ? 'যোগ করুন' : 'Add'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Desktop view inline Form card */}
                <div className="hidden md:block bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                    <PlusCircle className="text-brand-green w-5 h-5" />
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      {lang === 'bn' ? 'নতুন কর্মকর্তা যোগ করুন' : 'Add New Employee'}
                    </h4>
                  </div>

                  <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Photo Picker */}
                    <div className="md:col-span-3 flex items-center gap-4 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                      <div className="w-13 h-13 rounded-full bg-white border-2 border-slate-200 shadow-2xs overflow-hidden flex items-center justify-center shrink-0">
                        {newAvatar ? (
                          <img src={newAvatar} alt="New employee" className="w-full h-full object-cover" />
                        ) : (
                          <User size={22} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                          {lang === 'bn' ? 'কর্মকর্তার প্রোফাইল ছবি (ঐচ্ছিক)' : 'Employee Profile Photo (Optional)'}
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans">
                          {lang === 'bn' ? 'ডিভাইস থেকে কর্মকর্তা বা কর্মচারীর ছবি নির্বাচন করুন।' : 'Select profile photo from device for employee avatar.'}
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10.5px] font-bold cursor-pointer shadow-2xs">
                            <Camera size={12} className="text-brand-green" />
                            <span>{newAvatar ? (lang === 'bn' ? 'ছবি পরিবর্তন' : 'Change Photo') : (lang === 'bn' ? 'ছবি নির্বাচন করুন' : 'Select Photo')}</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) compressAndResizeImage(file, (url) => setNewAvatar(url));
                              }} 
                            />
                          </label>
                          {newAvatar && (
                            <button
                              type="button"
                              onClick={() => setNewAvatar('')}
                              className="text-rose-500 hover:text-rose-700 text-[10.5px] font-bold underline cursor-pointer"
                            >
                              {lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          {lang === 'bn' ? 'আইডি (আবশ্যিক)' : 'Employee ID (Req)'}
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded font-sans">
                          <Zap size={9} className="text-brand-green shrink-0" />
                          <span>{lang === 'bn' ? 'অটো আইডি' : 'Auto ID'}</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. ST-106"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'ইমেইল ইউজারনেম (আবশ্যিক)' : 'Email / Username (Req)'}
                      </label>
                      <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                        <input
                          type="text"
                          placeholder="kamrul"
                          value={newEmailPrefix}
                          onChange={(e) => setNewEmailPrefix(e.target.value.toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9._-]/g, ''))}
                          className="flex-1 min-w-0 bg-transparent px-3.5 py-2 text-xs outline-none font-bold text-slate-800"
                          required
                        />
                        <span className="shrink-0 whitespace-nowrap bg-slate-200/80 text-slate-600 px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold font-mono border-l border-slate-200 select-none">
                          @smarttrading.com
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'পূর্ণ নাম (আবশ্যিক)' : 'Full Name (Req)'}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Kamrul Hasan"
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value);
                          if (!newEmailPrefix) {
                            const suggestedPrefix = e.target.value.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
                            setNewEmailPrefix(suggestedPrefix);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'নাম বাংলায় (ঐচ্ছিক)' : 'Name in Bangla (Optional)'}
                      </label>
                      <input
                        type="text"
                        placeholder="যেমন: কামরুল হাসান"
                        value={newNameBn}
                        onChange={(e) => setNewNameBn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                      />
                    </div>



                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'ডিউটি শুরুর সময় (Duty In-Time)' : 'Duty Start Time'}
                      </label>
                      <input
                        type="time"
                        value={newShiftStartTime}
                        onChange={(e) => setNewShiftStartTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'মাসিক মূল বেতন (৳)' : 'Monthly Base Salary (৳)'}
                      </label>
                      <input
                        type="number"
                        placeholder="30000"
                        value={newSalary}
                        onChange={(e) => setNewSalary(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
                      </label>
                      <input
                        type="date"
                        value={newJoiningDate}
                        onChange={(e) => setNewJoiningDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                        {lang === 'bn' ? 'লগইন পাসওয়ার্ড (আবশ্যিক)' : 'Login Password (Req)'}
                      </label>
                      <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 overflow-hidden focus-within:border-brand-green">
                        <span className="pl-3.5 text-slate-400">
                          <Lock size={13} />
                        </span>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="e.g. 1234"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="flex-1 bg-transparent px-3 py-2 text-xs outline-none font-bold text-slate-800 font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="px-3 py-2 text-slate-400 hover:text-slate-600 cursor-pointer border-0 bg-transparent"
                          title={showNewPassword ? (lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide') : (lang === 'bn' ? 'পাসওয়ার্ড দেখুন' : 'Show')}
                        >
                          {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex items-end justify-end pt-2">
                      <button
                        type="submit"
                        className="bg-brand-green hover:bg-brand-green-dark text-white rounded-xl py-2.5 px-8 font-bold uppercase tracking-wider text-xs cursor-pointer shadow-sm shadow-brand-green/20 border-0 flex items-center gap-2 transition-all active:scale-[0.98]"
                      >
                        <PlusCircle size={15} />
                        <span>{lang === 'bn' ? 'কর্মকর্তা যোগ করুন' : 'Add Employee'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Employees Directory List */}
                <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[300px]">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-brand-green" />
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                        {lang === 'bn' ? 'সকল কর্মকর্তাদের ডিরেক্টরি' : "All Employees Directory"}
                      </span>
                    </div>
                    <span className="text-[10px] bg-brand-green/10 text-brand-green px-2.5 py-1 rounded-full font-bold">
                      {employeesList.length} {lang === 'bn' ? 'জন কর্মকর্তা' : 'Employees'}
                    </span>
                  </div>

                  {/* Mobile Cards View (md:hidden) */}
                  <div className="md:hidden p-3.5 sm:p-4 bg-slate-50/50 space-y-3.5 overflow-y-auto flex-1 min-h-0">
                    {employeesList.map((emp) => (
                      <div 
                        key={emp.id} 
                        className="bg-white border border-slate-200/85 rounded-2xl p-4 shadow-xs hover:border-brand-green/40 hover:shadow-md transition-all space-y-3.5"
                      >
                        {/* Top: Avatar, Name, ID, Designation & Salary Badge */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div 
                            onClick={() => setActiveEmpProfileId(emp.id)} 
                            className="flex items-center gap-3 min-w-0 cursor-pointer"
                            title={lang === 'bn' ? `${emp.nameBn} এর প্রোফাইল দেখুন` : `View ${emp.name}'s profile`}
                          >
                            <div className="relative">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                {emp.avatar ? (
                                  <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-800 text-xs hover:text-brand-green transition-colors truncate">
                                {lang === 'bn' ? emp.nameBn : emp.name}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{emp.id}</span>
                                <span>•</span>
                                <span className="truncate">{lang === 'bn' ? emp.designationBn : emp.designation}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1 rounded-xl">
                            <span className="block text-[8px] text-emerald-700 font-bold uppercase tracking-wider">{lang === 'bn' ? 'মূল বেতন' : 'Basic Pay'}</span>
                            <span className="text-xs font-black text-emerald-800 font-sans">
                              ৳{emp.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                            </span>
                          </div>
                        </div>

                        {/* Duty & Shift Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-600 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/70">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400 shrink-0" />
                            <span className="text-slate-400 text-[10px]">{lang === 'bn' ? 'শিফট:' : 'Shift:'}</span>
                            <span className="font-bold text-slate-700">{emp.shiftStartTime || '09:00 AM'} (৮ ঘ.)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-400 shrink-0" />
                            <span className="text-slate-400 text-[10px]">{lang === 'bn' ? 'যোগদান:' : 'Joined:'}</span>
                            <span className="font-bold text-slate-700 font-mono text-[10px]">{emp.joiningDate || '-'}</span>
                          </div>
                        </div>

                        {/* Login Credentials Box with 1-tap Copy */}
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            const textToCopy = `স্মার্ট ট্রেডিং লগইন তথ্য:
 কর্মকর্তার নাম: ${emp.nameBn} (${emp.name})
 আইডি: ${emp.id}
 ইমেইল: ${emp.email}
 পাসওয়ার্ড: ${emp.password || '1234'}
 লগইন লিঙ্ক: ${window.location.origin}/login`;
                            navigator.clipboard.writeText(textToCopy);
                            setCopiedEmailId(emp.id);
                            setTimeout(() => setCopiedEmailId(null), 2000);
                          }}
                          className="flex items-center justify-between gap-2 p-2.5 bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                          title={lang === 'bn' ? 'ক্লিক করে লগইন তথ্য কপি করুন' : 'Click to copy login credentials'}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[10.5px] font-semibold truncate">
                              <Mail size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{emp.email}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9.5px] font-mono font-bold text-slate-700">
                                <Lock size={9} className="text-emerald-600 shrink-0" />
                                <span>{lang === 'bn' ? 'পাসওয়ার্ড:' : 'Pass:'} <strong className="text-emerald-700">{emp.password || '1234'}</strong></span>
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const textToCopy = `স্মার্ট ট্রেডিং লগইন তথ্য:
 কর্মকর্তার নাম: ${emp.nameBn} (${emp.name})
 আইডি: ${emp.id}
 ইমেইল: ${emp.email}
 পাসওয়ার্ড: ${emp.password || '1234'}
 লগইন লিঙ্ক: ${window.location.origin}/login`;
                              navigator.clipboard.writeText(textToCopy);
                              setCopiedEmailId(emp.id);
                              setTimeout(() => setCopiedEmailId(null), 2000);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                              copiedEmailId === emp.id 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                : 'bg-white hover:bg-emerald-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {copiedEmailId === emp.id ? (
                              <>
                                <Check size={11} className="stroke-[3]" />
                                <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Actions Bar */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setActiveEmpProfileId(emp.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100/90 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border-0"
                          >
                            <User size={13} className="text-slate-500" />
                            <span>{lang === 'bn' ? 'প্রোফাইল ও বেতন' : 'Profile & Salary'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setReportEmpId(emp.id);
                              generateAttendanceReport(undefined, emp.id);
                              navigate('/dashboard?tab=report');
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-brand-green rounded-xl text-xs font-bold transition-colors cursor-pointer border border-brand-green/20"
                          >
                            <FileText size={13} />
                            <span>{lang === 'bn' ? 'হাজিরা শিট' : 'Report'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-rose-200/50 shrink-0"
                            title={lang === 'bn' ? 'অপসারণ করুন' : 'Delete'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block overflow-y-auto flex-1 min-h-0">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-100 z-10">
                        <tr>
                          <th className="px-5 py-4">{lang === 'bn' ? 'আইডি' : 'ID'}</th>
                          <th className="px-5 py-4">{lang === 'bn' ? 'কর্মকর্তা ও পদবী' : 'Employee & Role'}</th>
                          <th className="px-5 py-4">{lang === 'bn' ? 'শিফট ও মূল বেতন' : 'Shift & Basic Salary'}</th>
                          <th className="px-5 py-4 hidden lg:table-cell">{lang === 'bn' ? 'লগইন অ্যাক্সেস' : 'Login Access'}</th>
                          <th className="px-5 py-4 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-650">
                        {employeesList.map((emp) => (
                          <tr 
                            key={emp.id} 
                            onClick={() => setActiveEmpProfileId(emp.id)} 
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer font-sans"
                            title={lang === 'bn' ? `${emp.nameBn} এর প্রোফাইল দেখুন` : `View ${emp.name}'s profile`}
                          >
                            <td className="px-5 py-4 font-bold font-mono text-slate-800 whitespace-nowrap">
                              <span className="bg-slate-100 px-2 py-1 rounded-lg border border-slate-200/70">{emp.id}</span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                                  {emp.avatar ? (
                                    <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-800 hover:text-brand-green transition-colors text-xs">{lang === 'bn' ? emp.nameBn : emp.name}</div>
                                  <span className="text-[10.5px] text-slate-500 font-sans block mt-0.5">
                                    {lang === 'bn' ? emp.designationBn : emp.designation}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <div className="font-black text-slate-800 text-xs font-sans">৳{emp.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                  <Clock size={10} className="text-slate-400" />
                                  <span>{emp.shiftStartTime || '09:00 AM'} (৮ ঘণ্টা)</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const textToCopy = `স্মার্ট ট্রেডিং লগইন তথ্য:
 কর্মকর্তার নাম: ${emp.nameBn} (${emp.name})
 আইডি: ${emp.id}
 ইমেইল: ${emp.email}
 পাসওয়ার্ড: ${emp.password || '1234'}
 লগইন লিঙ্ক: ${window.location.origin}/login`;
                                  navigator.clipboard.writeText(textToCopy);
                                  setCopiedEmailId(emp.id);
                                  setTimeout(() => setCopiedEmailId(null), 2000);
                                }}
                                className="group/cred inline-flex items-center justify-between gap-3 px-3 py-2 bg-slate-50/90 hover:bg-emerald-50/80 border border-slate-200/90 hover:border-emerald-300 rounded-2xl transition-all cursor-pointer min-w-[240px] max-w-sm shadow-2xs"
                                title={lang === 'bn' ? 'ক্লিক করে সম্পূর্ণ লগইন তথ্য কপি করুন' : 'Click to copy full login credentials'}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px] font-semibold truncate">
                                    <Mail size={12} className="text-slate-400 group-hover/cred:text-emerald-600 shrink-0" />
                                    <span className="truncate">{emp.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-mono font-bold text-slate-700">
                                      <Lock size={10} className="text-emerald-600 shrink-0" />
                                      <span>{lang === 'bn' ? 'পাসওয়ার্ড:' : 'Pass:'} <strong className="text-emerald-700">{emp.password || '1234'}</strong></span>
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const textToCopy = `স্মার্ট ট্রেডিং লগইন তথ্য:
 কর্মকর্তার নাম: ${emp.nameBn} (${emp.name})
 আইডি: ${emp.id}
 ইমেইল: ${emp.email}
 পাসওয়ার্ড: ${emp.password || '1234'}
 লগইন লিঙ্ক: ${window.location.origin}/login`;
                                    navigator.clipboard.writeText(textToCopy);
                                    setCopiedEmailId(emp.id);
                                    setTimeout(() => setCopiedEmailId(null), 2000);
                                  }}
                                  className={`px-2 py-1 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                                    copiedEmailId === emp.id 
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                      : 'bg-white hover:bg-emerald-100/60 text-slate-600 border-slate-200 group-hover/cred:border-emerald-300'
                                  }`}
                                  title={lang === 'bn' ? 'সম্পূর্ণ লগইন তথ্য কপি করুন' : 'Copy Full Login Details'}
                                >
                                  {copiedEmailId === emp.id ? (
                                    <>
                                      <Check size={12} className="stroke-[3]" />
                                      <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      <span>{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReportEmpId(emp.id);
                                    generateAttendanceReport(undefined, emp.id);
                                    navigate('/dashboard?tab=report');
                                  }}
                                  className="text-brand-green hover:text-brand-green-dark p-2 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer border border-brand-green/20 bg-emerald-50/40 flex items-center gap-1.5 text-[11px] font-bold shadow-2xs"
                                  title={lang === 'bn' ? 'হাজিরা ও লেট হিসাব দেখুন' : 'View Attendance Sheet'}
                                >
                                  <FileText size={13} />
                                  <span className="hidden sm:inline">{lang === 'bn' ? 'হাজিরা শিট' : 'Report'}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEmployee(emp.id);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200/50 shadow-2xs"
                                  title={lang === 'bn' ? 'অপসারণ করুন' : 'Delete Employee'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              )
            ) : activeTab === 'salary' ? (
              /* Admin Tab 3: Salary Calculation Sheet */
              <div className="flex flex-col gap-6 flex-1 font-sans animate-fade-in">
                
                {/* Salary Calculation List */}
                <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[300px]">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                      <Wallet size={18} className="text-brand-green" />
                      <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                        {lang === 'bn' ? 'বেতন হিসাব শিট (চলতি মাস)' : "Salary Calculation Sheet (Current Month)"}
                      </span>
                    </div>
                    <span className="text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">
                      {lang === 'bn' ? `মোট ক্যালেন্ডার দিন: ${totalCalendarDays} দিন` : `Calendar Days: ${totalCalendarDays}`}
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 bg-slate-50/50 space-y-3.5 overflow-y-auto flex-1 min-h-0">
                    {employeesList.map((emp) => {
                      const calc = calculateMonthlySalary(emp, selectedProfileMonth, holidaysList);
                      const calculatedPay = calc.netPayable;
                      const isExpanded = expandedSalaryEmpId === emp.id;

                      // Read payment details for status badge & breakdown
                      const detailsKey = `ob_salary_payment_details_${emp.id}`;
                      const savedDetails = localStorage.getItem(detailsKey);
                      let parsedDetails: Record<string, any> = {};
                      if (savedDetails) {
                        try { parsedDetails = JSON.parse(savedDetails); } catch(err) {}
                      }
                      const monthPaymentDetail = parsedDetails[selectedProfileMonth];
                      
                      let badgeColor = 'bg-rose-50 text-rose-600 border border-rose-200';
                      let badgeText = lang === 'bn' ? 'বকেয়া' : 'Unpaid';
                      let isPaidFully = false;
                      
                      if (monthPaymentDetail) {
                        if (monthPaymentDetail.type === 'full' || monthPaymentDetail.dueAmount === 0) {
                          badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                          badgeText = lang === 'bn' ? 'পরিশোধিত' : 'Paid';
                          isPaidFully = true;
                        } else if (monthPaymentDetail.dueAmount > 0) {
                          badgeColor = 'bg-amber-50 text-amber-700 border border-amber-200';
                          badgeText = lang === 'bn' 
                            ? `আংশিক (বকেয়া: ৳${monthPaymentDetail.dueAmount.toLocaleString()})` 
                            : `Partial (Due: ৳${monthPaymentDetail.dueAmount.toLocaleString()})`;
                        } else if (monthPaymentDetail.type === 'advance') {
                          badgeColor = 'bg-blue-50 text-blue-700 border border-blue-200';
                          badgeText = lang === 'bn' ? 'অগ্রিম' : 'Advance';
                        }
                      }

                      return (
                        <div 
                          key={emp.id} 
                          className={`bg-white border rounded-2xl shadow-xs transition-all duration-200 select-none overflow-hidden ${
                            isExpanded ? 'border-brand-green/50 shadow-md ring-1 ring-brand-green/20' : 'border-slate-200/85 hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          {/* Collapsed Row Header */}
                          <div
                            onClick={() => setExpandedSalaryEmpId(isExpanded ? null : emp.id)}
                            className="p-4 flex items-center justify-between gap-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                {emp.avatar ? (
                                  <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-black text-brand-green">{emp.name.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-xs leading-tight">
                                    {lang === 'bn' ? emp.nameBn : emp.name}
                                  </span>
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}`}>
                                    {badgeText}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium mt-0.5">
                                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">{emp.id}</span>
                                  <span>•</span>
                                  <span>{lang === 'bn' ? `ডিউটি: ${emp.shiftStartTime || '09:00'}` : `Shift: ${emp.shiftStartTime || '09:00'}`}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right bg-emerald-50/80 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
                                <span className="text-[8px] text-emerald-700 font-bold uppercase tracking-wider block">
                                  {monthPaymentDetail?.dueAmount > 0 
                                    ? (lang === 'bn' ? 'অবশিষ্ট বকেয়া' : 'Remaining Due')
                                    : (lang === 'bn' ? 'প্রদেয় নিট বেতন' : 'Net Payable')}
                                </span>
                                <span className="text-emerald-800 font-black text-xs sm:text-sm font-sans">
                                  ৳{(monthPaymentDetail?.dueAmount > 0 ? monthPaymentDetail.dueAmount : calculatedPay).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                </span>
                              </div>
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-brand-green/10 text-brand-green' : 'bg-slate-100 text-slate-400'}`}>
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          {isExpanded && (
                            <div className="bg-slate-50/70 border-t border-slate-100 p-4.5 sm:p-5 space-y-4 text-xs animate-slide-down">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="space-y-0.5 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
                                  <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">{lang === 'bn' ? 'মূল বেতন (Basic)' : 'Base Salary'}</span>
                                  <span className="font-bold text-slate-800 text-xs sm:text-sm">৳{calc.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                </div>
                                <div className="space-y-0.5 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
                                  <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">{lang === 'bn' ? 'অনুপস্থিতি কর্তন' : 'Absent Deduction'}</span>
                                  <span className="font-bold text-rose-600 text-xs sm:text-sm">- ৳{calc.absentDeduction.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                  <span className="text-[8.5px] text-slate-400 block font-bold">({calc.absentDaysCount} {lang === 'bn' ? 'দিন অনুপস্থিত' : 'days absent'})</span>
                                </div>
                                <div className="space-y-0.5 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
                                  <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">{lang === 'bn' ? '৩ দিন লেট কর্তন' : 'Late Deduction (3:1)'}</span>
                                  <span className="font-bold text-rose-600 text-xs sm:text-sm">- ৳{calc.lateDeduction.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                  <span className="text-[8.5px] text-slate-400 block font-bold">({calc.lateCount} {lang === 'bn' ? 'লেট =' : 'lates ='} {calc.lateCutDays} {lang === 'bn' ? 'দিন কাটা' : 'day cut'})</span>
                                </div>
                                <div className="space-y-0.5 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
                                  <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">{lang === 'bn' ? 'শুক্রবার কাজের বোনাস' : 'Friday Work Bonus'}</span>
                                  <span className="font-bold text-emerald-600 text-xs sm:text-sm">+ ৳{calc.fridayBonus.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                  <span className="text-[8.5px] text-slate-400 block font-bold">({calc.fridayWorkedCount} {lang === 'bn' ? 'শুক্রবার ডিউটি' : 'Fridays worked'})</span>
                                </div>
                                <div className="space-y-0.5 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
                                  <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">{lang === 'bn' ? 'ওভারটাইম আয়' : 'Overtime Pay'}</span>
                                  <span className="font-bold text-emerald-600 text-xs sm:text-sm">+ ৳{calc.otPay.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                  <span className="text-[8.5px] text-slate-400 block font-bold">({calc.otHours} {lang === 'bn' ? 'ঘণ্টা ওটি' : 'hours OT'})</span>
                                </div>
                                <div className="space-y-0.5 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
                                  <span className="text-slate-400 text-[9px] font-bold uppercase block tracking-wider">{lang === 'bn' ? 'অগ্রিম ও অন্যান্য কর্তন' : 'Advance / Deduct'}</span>
                                  <span className="font-bold text-amber-600 text-xs sm:text-sm">- ৳{(calc.advanceSalary + calc.deductions).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                                </div>
                              </div>

                              {monthPaymentDetail && (
                                <div className="bg-white border border-slate-200/70 p-3.5 rounded-2xl text-[10.5px] space-y-1.5 font-sans shadow-2xs">
                                  <span className="flex items-center gap-1 font-bold text-slate-700 uppercase text-[9.5px] tracking-wide text-brand-green">
                                    <Wallet size={12} className="shrink-0" />
                                    <span>{lang === 'bn' ? 'পরিশোধের লেনদেন বিবরণী' : 'Payment Transaction Details'}</span>
                                  </span>
                                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-0.5">
                                    <div>{lang === 'bn' ? 'পরিশোধের ধরণ:' : 'Payment Type:'} <span className="font-bold text-slate-800">{monthPaymentDetail.type === 'full' ? (lang === 'bn' ? 'পূর্ণ বেতন' : 'Full') : monthPaymentDetail.type === 'partial' ? (lang === 'bn' ? 'আংশিক পরিশোধ' : 'Partial') : (lang === 'bn' ? 'অগ্রিম প্রদান' : 'Advance')}</span></div>
                                    <div>{lang === 'bn' ? 'পরিশোধিত অর্থ:' : 'Paid Amount:'} <span className="font-bold text-emerald-600">৳{monthPaymentDetail.paidAmount.toLocaleString()}</span></div>
                                    <div>{lang === 'bn' ? 'পরিশোধের মাধ্যম:' : 'Payment Method:'} <span className="font-bold text-slate-800">{monthPaymentDetail.paymentMethod === 'Cash' ? (lang === 'bn' ? 'ক্যাশ' : 'Cash') : monthPaymentDetail.paymentMethod === 'Bank' ? (lang === 'bn' ? 'ব্যাংক' : 'Bank') : (lang === 'bn' ? 'বিকাশ/নগদ' : 'MFS')}</span></div>
                                    <div>{lang === 'bn' ? 'পরিশোধের তারিখ:' : 'Payment Date:'} <span className="font-bold font-mono text-slate-800">{monthPaymentDetail.paymentDate}</span></div>
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 border-t border-slate-200/70 flex justify-end items-center gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    onClick={() => {
                                      setPaymentModalEmpId(emp.id);
                                      setPaymentType(monthPaymentDetail?.dueAmount > 0 ? 'partial' : 'full');
                                      setPaymentCustomAmount(String(monthPaymentDetail?.dueAmount > 0 ? monthPaymentDetail.dueAmount : calculatedPay));
                                      setShowPaymentModal(true);
                                    }}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 shadow-sm ${
                                      isPaidFully
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                        : 'bg-brand-green text-white hover:bg-brand-green-dark'
                                    }`}
                                  >
                                    {isPaidFully ? (
                                      <span className="flex items-center gap-1.5">
                                        <Check size={13} />
                                        <span>{lang === 'bn' ? 'পরিশোধ সম্পন্ন' : 'Fully Paid'}</span>
                                      </span>
                                    ) : monthPaymentDetail?.dueAmount > 0 ? (
                                      <span className="flex items-center gap-1.5">
                                        <Wallet size={13} />
                                        <span>{lang === 'bn' ? 'অবশিষ্ট বকেয়া পরিশোধ' : 'Pay Remaining Due'}</span>
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5">
                                        <Wallet size={13} />
                                        <span>{lang === 'bn' ? 'বেতন/অগ্রিম পরিশোধ করুন' : 'Pay Salary / Advance'}</span>
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {employeesList.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        {lang === 'bn' ? 'কোনো কর্মকর্তা তথ্য পাওয়া যায়নি।' : 'No employee records found.'}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* Fallback default to Dashboard tab */
              <div className="text-center py-8 text-slate-400">
                {lang === 'bn' ? 'লোডিং ড্যাশবোর্ড...' : 'Loading Dashboard...'}
              </div>
            )}

          </div>
        </div>

        {/* Notice Detailed Modal popup */}
        {selectedNoticeDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 font-sans animate-scale-up">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-bold ${
                    selectedNoticeDetails.type === 'All' 
                      ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
                      : 'bg-brand-gold/10 text-amber-800 border border-brand-gold/20'
                  }`}>
                    {selectedNoticeDetails.type === 'All' ? (
                      <span className="inline-flex items-center gap-1">
                        <Megaphone size={9} className="shrink-0" />
                        <span>{lang === 'bn' ? 'সকলকে' : 'All'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Lock size={9} className="shrink-0" />
                        <span>{lang === 'bn' ? 'ব্যক্তিগত' : 'Personal'}</span>
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block">{selectedNoticeDetails.date}</span>
                </div>
                <button
                  onClick={() => setSelectedNoticeDetails(null)}
                  className="text-slate-400 hover:text-slate-650 p-1 hover:bg-slate-50 rounded-lg cursor-pointer border-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-800 text-base">{selectedNoticeDetails.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNoticeDetails.content}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedNoticeDetails(null)}
                  className="bg-brand-green hover:bg-brand-green-dark text-white rounded-xl px-5 py-2 text-xs font-bold cursor-pointer border-0"
                >
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Communication & Chat Modal popup */}
        {activeChatTask && (() => {
          const liveTask = tasksList.find(t => t.id === activeChatTask.id) || activeChatTask;
          return (
            <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-[100dvh] w-screen overflow-hidden font-sans animate-fade-in">
              <div className="flex flex-col h-full w-full bg-slate-50">
                
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm">
                  <button
                    onClick={() => setActiveChatTask(null)}
                    className="text-slate-500 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer border-0 shrink-0"
                  >
                    <X size={20} />
                  </button>
                  
                  <div className="text-center flex-1 min-w-0 mx-2">
                    <span className="text-[9px] font-black text-brand-green uppercase tracking-wider block">
                      {lang === 'bn' ? 'কমিউনিকেশন ও আপডেট' : 'Task Discussion & Timeline'}
                    </span>
                    <h4 className="font-extrabold text-slate-800 text-sm leading-tight truncate">{liveTask.title}</h4>
                    <div className="text-[10px] text-slate-400 font-medium truncate">
                      {lang === 'bn' 
                        ? `দায়িত্বে: ${liveTask.assignedToName} | ডেডলাইন: ${liveTask.deadline}` 
                        : `Assigned: ${liveTask.assignedToName} | Deadline: ${liveTask.deadline}`}
                    </div>
                  </div>
                  
                  {/* Empty spacer to balance header */}
                  <div className="w-10 h-10 shrink-0" />
                </div>

                {/* Chat Messages Timeline */}
                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 min-h-0 select-text bg-slate-50">
                  <div className="max-w-2xl mx-auto space-y-4">
                    {parseTaskMessages(liveTask.employeeNote).length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-medium">
                        {lang === 'bn' ? 'কোনো আপডেট বা মেসেজ নেই। নিচে প্রথম আপডেটটি লিখুন।' : 'No discussion yet. Write the first message below.'}
                      </div>
                    ) : (
                      parseTaskMessages(liveTask.employeeNote).map((msg, idx) => {
                        const isCurrentUserAdmin = isAdminLoggedIn;
                        const isMessageFromAdmin = msg.sender === 'admin';
                        const isOutgoing = (isCurrentUserAdmin && isMessageFromAdmin) || (!isCurrentUserAdmin && !isMessageFromAdmin);

                        return (
                          <div 
                            key={idx} 
                            className={`flex flex-col max-w-[85%] ${isOutgoing ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                          >
                            {/* Sender Label */}
                            <span className="text-[8px] font-bold text-slate-400 mb-0.5 tracking-wide px-1">
                              {msg.senderName}
                            </span>
                            
                            {/* Bubble */}
                            <div 
                              className={`p-3 rounded-2xl text-xs leading-relaxed font-medium shadow-sm ${
                                isOutgoing 
                                  ? 'bg-brand-green text-white rounded-tr-none' 
                                  : 'bg-white text-slate-700 rounded-tl-none border border-slate-200/60'
                              }`}
                            >
                              {msg.text}
                            </div>

                            {/* Timestamp */}
                            {msg.time && (
                              <span className="text-[7.5px] text-slate-400 mt-0.5 px-1 font-mono">
                                {msg.time}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer Input */}
                <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0 shadow-lg pb-safe">
                  <div className="max-w-2xl mx-auto">
                    {liveTask.status === 'Done' ? (
                      <div className="text-center py-2 text-slate-400 text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center gap-1.5">
                        <Lock size={12} className="text-slate-400 shrink-0" />
                        <span>{lang === 'bn' ? 'এই কাজটি সম্পন্ন হয়েছে। মন্তব্য পাঠানো বন্ধ।' : 'This task is completed. Discussion is locked.'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={lang === 'bn' ? "নতুন কাজের আপডেট বা মন্তব্য লিখুন..." : "Type message or update..."}
                          id="chat-message-input-modal"
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-brand-green font-sans"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              const inputEl = e.currentTarget;
                              const text = inputEl.value.trim();
                              if (text) {
                                const prevMsgs = parseTaskMessages(liveTask.employeeNote);
                                const senderNameVal = isAdminLoggedIn 
                                  ? (lang === 'bn' ? 'এডমিন' : 'Admin') 
                                  : (currentEmployee ? (lang === 'bn' ? currentEmployee.nameBn : currentEmployee.name) : 'Employee');
                                
                                const newMsg: TaskMessage = {
                                  sender: isAdminLoggedIn ? 'admin' : 'employee',
                                  senderName: senderNameVal,
                                  text,
                                  time: new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                                };
                                
                                const updated = [...prevMsgs, newMsg];
                                const noteStr = JSON.stringify(updated);
                                
                                await handleUpdateTaskEmployeeNote(liveTask.id, noteStr);
                                inputEl.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          onClick={async () => {
                            const inputEl = document.getElementById('chat-message-input-modal') as HTMLInputElement;
                            const text = inputEl?.value.trim();
                            if (text) {
                              const prevMsgs = parseTaskMessages(liveTask.employeeNote);
                              const senderNameVal = isAdminLoggedIn 
                                ? (lang === 'bn' ? 'এডমিন' : 'Admin') 
                                : (currentEmployee ? (lang === 'bn' ? currentEmployee.nameBn : currentEmployee.name) : 'Employee');
                              
                              const newMsg: TaskMessage = {
                                sender: isAdminLoggedIn ? 'admin' : 'employee',
                                senderName: senderNameVal,
                                text,
                                time: new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                              };
                              
                              const updated = [...prevMsgs, newMsg];
                              const noteStr = JSON.stringify(updated);
                              
                              await handleUpdateTaskEmployeeNote(liveTask.id, noteStr);
                              if (inputEl) inputEl.value = '';
                            }
                          }}
                          className="px-4 py-2.5 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl flex items-center justify-center cursor-pointer border-0 shadow-sm shrink-0"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Salary Payment Configuration Modal */}
        {showPaymentModal && paymentModalEmpId && (() => {
          const emp = employeesList.find(x => x.id === paymentModalEmpId);
          if (!emp) return null;

          const calc = calculateMonthlySalary(emp, selectedProfileMonth, holidaysList);
          const netPayable = calc.netPayable;

          // Get existing due if any
          const detailsKey = `ob_salary_payment_details_${emp.id}`;
          const savedDetails = localStorage.getItem(detailsKey);
          let parsedDetails: Record<string, any> = {};
          if (savedDetails) {
            try { parsedDetails = JSON.parse(savedDetails); } catch(err) {}
          }
          const monthPaymentDetail = parsedDetails[selectedProfileMonth];
          const displayedCalculated = monthPaymentDetail?.dueAmount > 0 ? monthPaymentDetail.dueAmount : netPayable;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-scale-up">
                <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
                      {lang === 'bn' ? 'বেতন/অগ্রিম পরিশোধ কনফিগারেশন' : 'Salary & Advance Payment'}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      {lang === 'bn' ? `${emp.nameBn} (${emp.id}) | ${selectedProfileMonth}` : `${emp.name} (${emp.id}) | ${selectedProfileMonth}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentModalEmpId(null);
                    }}
                    className="text-slate-400 hover:text-slate-650 p-1 hover:bg-slate-50 rounded-lg cursor-pointer border-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
                  {/* Select Payment Type */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'bn' ? 'পরিশোধের ধরণ (Payment Type)' : 'Payment Type'}</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setPaymentType('full'); setPaymentCustomAmount(String(displayedCalculated)); }}
                        className={`py-2 rounded-xl font-bold border transition-all cursor-pointer text-[10px] text-center ${
                          paymentType === 'full' 
                            ? 'bg-brand-green/15 border-brand-green text-brand-green' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lang === 'bn' ? 'পূর্ণ বেতন (Full)' : 'Full Pay'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPaymentType('partial'); setPaymentCustomAmount(String(Math.round(displayedCalculated / 2))); }}
                        className={`py-2 rounded-xl font-bold border transition-all cursor-pointer text-[10px] text-center ${
                          paymentType === 'partial' 
                            ? 'bg-amber-50 border-brand-gold text-amber-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lang === 'bn' ? 'আংশিক (Partial)' : 'Partial Pay'}
                      </button>
                      <button
                        type="button"
                        disabled={monthPaymentDetail?.dueAmount > 0}
                        onClick={() => { setPaymentType('advance'); setPaymentCustomAmount('10000'); }}
                        className={`py-2 rounded-xl font-bold border transition-all cursor-pointer text-[10px] text-center disabled:opacity-50 disabled:cursor-not-allowed ${
                          paymentType === 'advance' 
                            ? 'bg-blue-50 border-blue-500 text-blue-700' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {lang === 'bn' ? 'অগ্রিম (Advance)' : 'Advance'}
                      </button>
                    </div>
                  </div>

                  {/* Calculations Details Banner */}
                  <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-2xl space-y-1.5">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="text-slate-500 font-bold">
                        {monthPaymentDetail?.dueAmount > 0 
                          ? (lang === 'bn' ? 'অবশিষ্ট বকেয়া (Due Remaining):' : 'Due Remaining:')
                          : (lang === 'bn' ? 'প্রদেয় নিট বেতন (Net Payable):' : 'Net Payable:')}
                      </span>
                      <span className="font-extrabold text-slate-800">৳{displayedCalculated.toLocaleString()}</span>
                    </div>

                    {paymentType === 'advance' && (
                      <div className="text-[10px] text-slate-500 border-t border-slate-200/60 pt-1.5 mt-1 flex items-start gap-1.5">
                        <Megaphone size={12} className="text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-blue-600">{lang === 'bn' ? 'অগ্রিম প্রদান নোটিশ:' : 'Advance Disbursal:'}</span> {lang === 'bn' ? 'এই অগ্রিম অর্থটি কর্মকর্তার পরবর্তী মাসের মূল বেতন হিসাব থেকে স্বয়ংক্রিয়ভাবে কেটে নেওয়া হবে।' : 'This advance amount will be automatically deducted from next month\'s payroll calculations.'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Amount field for Partial/Advance payments */}
                  {paymentType !== 'full' && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {paymentType === 'partial' ? (lang === 'bn' ? 'পরিশোধিত টাকার পরিমাণ (৳)' : 'Paid Amount (৳)') : (lang === 'bn' ? 'অগ্রিম প্রদানের পরিমাণ (৳)' : 'Advance Disbursed Amount (৳)')}
                      </label>
                      <input
                        type="number"
                        value={paymentCustomAmount}
                        onChange={(e) => setPaymentCustomAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold text-slate-800 font-sans"
                        required
                        max={paymentType === 'partial' ? displayedCalculated : undefined}
                      />
                      {paymentType === 'partial' && (
                        <span className="text-[9px] text-amber-700 font-bold block mt-1">
                          {lang === 'bn' ? `বকেয়া থাকবে: ৳${(displayedCalculated - (Number(paymentCustomAmount) || 0)).toLocaleString()}` : `Due remaining: ৳${(displayedCalculated - (Number(paymentCustomAmount) || 0)).toLocaleString()}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'bn' ? 'পরিশোধের মাধ্যম (Payment Method)' : 'Payment Method'}</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-brand-green outline-none font-bold font-sans"
                    >
                      <option value="Cash">{lang === 'bn' ? 'ক্যাশ (Cash)' : 'Cash'}</option>
                      <option value="Bank">{lang === 'bn' ? 'ব্যাংক ট্রান্সফার (Bank Transfer)' : 'Bank Transfer'}</option>
                      <option value="MFS">{lang === 'bn' ? 'মোবাইল ব্যাংকিং (bKash/Nagad)' : 'Mobile Banking (bKash/Nagad)'}</option>
                    </select>
                  </div>

                  {/* Submit buttons */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentModalEmpId(null);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer border-0"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl font-bold cursor-pointer border-0 shadow-sm"
                    >
                      {lang === 'bn' ? 'কনফার্ম করুন' : 'Confirm Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Admin Manual Attendance Adjustment - Full Screen View */}
        {showManualAttendanceModal && (() => {
          const inM = parseTimeStrToMinutes(manualCheckIn);
          const outM = parseTimeStrToMinutes(manualCheckOut);
          const hasBothTimes = manualStatus !== 'Absent' && manualStatus !== 'Leave' && inM > 0 && outM > 0 && outM > inM;
          const diffM = hasBothTimes ? outM - inM : 0;
          const previewH = Math.floor(diffM / 60);
          const previewM = diffM % 60;
          const isOt = diffM > 480;
          const isShort = diffM > 0 && diffM < 480;
          const otHours = isOt ? ((diffM - 480) / 60).toFixed(1) : '0';
          const shortHours = isShort ? ((480 - diffM) / 60).toFixed(1) : '0';
          const selectedEmp = employeesList.find(e => e.id === manualEmpId) || employeesList[0];

          return (
            <div className="fixed inset-0 z-50 bg-slate-100/90 flex flex-col overflow-hidden animate-fade-in font-sans">
              {/* Full-Screen Top Header */}
              <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManualAttendanceModal(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border-0"
                    title={lang === 'bn' ? 'তালিকায় ফিরে যান' : 'Back to list'}
                  >
                    <ArrowRight size={14} className="rotate-180" />
                    <span>{lang === 'bn' ? 'ফিরে যান' : 'Back'}</span>
                  </button>

                  <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                      <Sliders size={16} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
                        <span>{lang === 'bn' ? 'ম্যানুয়াল হাজিরা ও সময় সমন্বয়' : 'Manual Attendance Adjustment'}</span>
                        <span className="text-[9px] font-bold bg-brand-green/10 text-brand-green px-2 py-0.5 rounded-full uppercase">
                          {lang === 'bn' ? 'ফুল স্ক্রিন' : 'Full Screen'}
                        </span>
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                        {lang === 'bn' ? 'এডমিন ওভাররাইড: কর্মকর্তার উপস্থিতি, প্রবেশ/প্রস্থান সময় ও ওভারটাইম নির্ভুল সমন্বয় করুন' : 'Admin override: Shift timings, check-in/out, and overtime'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualAttendanceModal(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer border-0"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    form="manualAttendanceForm"
                    className="px-5 py-2 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl text-xs font-bold cursor-pointer border-0 shadow-sm flex items-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>{lang === 'bn' ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}</span>
                  </button>
                </div>
              </header>

              {/* Full-Screen Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                  
                  {/* System Audit Trail Banner */}
                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-800 text-xs font-medium flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <span className="font-bold block text-purple-900">
                          {lang === 'bn' ? 'স্বয়ংক্রিয় অডিট ট্রেইল সিকিউরিটি' : 'Audit Trail Security'}
                        </span>
                        <span className="text-[11px] text-purple-700">
                          {lang === 'bn' ? 'এই রেকর্ডটি সিস্টেমে "এডমিন থেকে করা হয়েছে" মেথডে স্থায়ীভাবে সংরক্ষিত হবে।' : 'This record will be saved permanently under "Admin Adjustment".'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-white/80 px-2.5 py-1 rounded-lg border border-purple-200 shrink-0">
                      {lang === 'bn' ? 'এডমিন সেশন সক্রিয়' : 'Admin Active'}
                    </span>
                  </div>

                  {/* Form Grid */}
                  <form id="manualAttendanceForm" onSubmit={handleSaveManualAttendance} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column: Form Inputs (7 Cols) */}
                    <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 text-xs">
                      
                      {/* Select Employee */}
                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                          {lang === 'bn' ? 'কর্মকর্তা নির্বাচন' : 'Select Employee'}
                        </label>
                        <select
                          value={manualEmpId}
                          onChange={(e) => {
                            const newId = e.target.value;
                            setManualEmpId(newId);
                            const rec = getEmployeeAttendanceRecord(newId, manualDate);
                            setManualCheckIn(rec.checkIn && rec.checkIn !== '-' ? rec.checkIn : '09:00 AM');
                            setManualCheckOut(rec.checkOut && rec.checkOut !== '-' ? rec.checkOut : '06:00 PM');
                            setManualStatus(rec.status || 'On-Time');
                            setManualLocation(rec.location && rec.location !== '-' ? formatLocation(rec.location) : (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'));
                            setManualNote(rec.note || '');
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-brand-green outline-none"
                          required
                        >
                          {employeesList.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.id} - {lang === 'bn' ? emp.nameBn : emp.name} ({lang === 'bn' ? emp.designationBn : emp.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date Selection */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                            {lang === 'bn' ? 'হাজিরার তারিখ' : 'Attendance Date'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const todayStr = new Date().toISOString().split('T')[0];
                                setManualDate(todayStr);
                                if (manualEmpId) {
                                  const rec = getEmployeeAttendanceRecord(manualEmpId, todayStr);
                                  setManualCheckIn(rec.checkIn && rec.checkIn !== '-' ? rec.checkIn : '09:00 AM');
                                  setManualCheckOut(rec.checkOut && rec.checkOut !== '-' ? rec.checkOut : '06:00 PM');
                                  setManualStatus(rec.status || 'On-Time');
                                }
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer border-0"
                            >
                              {lang === 'bn' ? 'আজ' : 'Today'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const yest = new Date();
                                yest.setDate(yest.getDate() - 1);
                                const yestStr = yest.toISOString().split('T')[0];
                                setManualDate(yestStr);
                                if (manualEmpId) {
                                  const rec = getEmployeeAttendanceRecord(manualEmpId, yestStr);
                                  setManualCheckIn(rec.checkIn && rec.checkIn !== '-' ? rec.checkIn : '09:00 AM');
                                  setManualCheckOut(rec.checkOut && rec.checkOut !== '-' ? rec.checkOut : '06:00 PM');
                                  setManualStatus(rec.status || 'On-Time');
                                }
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer border-0"
                            >
                              {lang === 'bn' ? 'গতকাল' : 'Yesterday'}
                            </button>
                          </div>
                        </div>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setManualDate(newDate);
                            if (manualEmpId) {
                              const rec = getEmployeeAttendanceRecord(manualEmpId, newDate);
                              setManualCheckIn(rec.checkIn && rec.checkIn !== '-' ? rec.checkIn : '09:00 AM');
                              setManualCheckOut(rec.checkOut && rec.checkOut !== '-' ? rec.checkOut : '06:00 PM');
                              setManualStatus(rec.status || 'On-Time');
                              setManualLocation(rec.location && rec.location !== '-' ? formatLocation(rec.location) : (lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'));
                              setManualNote(rec.note || '');
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-brand-green outline-none cursor-pointer"
                          required
                        />
                      </div>

                      {/* Attendance Status */}
                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                          {lang === 'bn' ? 'উপস্থিতির অবস্থা (Status)' : 'Attendance Status'}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: 'On-Time', labelBn: 'যথাসময়ে', labelEn: 'On-Time', descBn: 'সময়মতো প্রবেশ', color: 'border-emerald-500 text-emerald-800 bg-emerald-50' },
                            { key: 'Late', labelBn: 'বিলম্ব', labelEn: 'Late', descBn: 'দেরিতে প্রবেশ', color: 'border-amber-500 text-amber-800 bg-amber-50' },
                            { key: 'Leave', labelBn: 'ছুটি', labelEn: 'Leave', descBn: 'অনুমোদিত ছুটি', color: 'border-blue-500 text-blue-800 bg-blue-50' },
                            { key: 'Absent', labelBn: 'অনুপস্থিত', labelEn: 'Absent', descBn: 'অনুপস্থিতি', color: 'border-red-500 text-red-800 bg-red-50' },
                          ].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setManualStatus(item.key as any)}
                              className={`p-3 rounded-2xl font-bold border transition-all cursor-pointer text-left flex flex-col justify-between gap-1 ${
                                manualStatus === item.key
                                  ? `${item.color} shadow-xs ring-2 ring-brand-green/20`
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span className="text-xs">{lang === 'bn' ? item.labelBn : item.labelEn}</span>
                              <span className="text-[9.5px] font-normal text-slate-400">{lang === 'bn' ? item.descBn : item.labelEn}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* In and Out times (only if Present / Late) */}
                      {manualStatus !== 'Absent' && manualStatus !== 'Leave' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                          <div className="space-y-1.5">
                            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock size={12} className="text-emerald-600" />
                              <span>{lang === 'bn' ? 'প্রবেশ সময় (In Time)' : 'Check-In Time'}</span>
                            </label>
                            <input
                              type="text"
                              value={manualCheckIn}
                              onChange={(e) => setManualCheckIn(e.target.value)}
                              placeholder="09:00 AM"
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-brand-green outline-none"
                              required
                            />
                            <div className="flex flex-wrap gap-1 pt-1">
                              {['08:45 AM', '09:00 AM', '09:15 AM', '09:30 AM'].map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setManualCheckIn(t)}
                                  className="text-[9.5px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 font-mono text-slate-600 cursor-pointer"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10.5px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock size={12} className="text-amber-600" />
                              <span>{lang === 'bn' ? 'প্রস্থান সময় (Out Time)' : 'Check-Out Time'}</span>
                            </label>
                            <input
                              type="text"
                              value={manualCheckOut}
                              onChange={(e) => setManualCheckOut(e.target.value)}
                              placeholder="06:00 PM"
                              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-brand-green outline-none"
                              required
                            />
                            <div className="flex flex-wrap gap-1 pt-1">
                              {['05:00 PM', '06:00 PM', '07:30 PM', '08:00 PM'].map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setManualCheckOut(t)}
                                  className="text-[9.5px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 font-mono text-slate-600 cursor-pointer"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Location (Shop) */}
                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin size={12} className="text-emerald-600" />
                          <span>{lang === 'bn' ? 'হাজিরা লোকেশন (Shop Location)' : 'Shop Location'}</span>
                        </label>
                        <input
                          type="text"
                          value={manualLocation}
                          onChange={(e) => setManualLocation(e.target.value)}
                          placeholder={lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ' : 'Smart Trading Shop'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:border-brand-green outline-none font-medium"
                        />
                      </div>

                      {/* Note / Adjustment Reason */}
                      <div className="space-y-1.5">
                        <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                          {lang === 'bn' ? 'সমন্বয়ের কারণ / মন্তব্য (ঐচ্ছিক)' : 'Adjustment Reason / Note (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={manualNote}
                          onChange={(e) => setManualNote(e.target.value)}
                          placeholder={lang === 'bn' ? 'যেমন: বিশেষ অনুমতি, ফিল্ড ডিউটি, নেটওয়ার্ক বিভ্রাট ইত্যাদি' : 'e.g. Special permission, Field Duty'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:border-brand-green outline-none font-medium"
                        />
                      </div>
                    </div>

                    {/* Right Column: Live Summary & Calculation Card (5 Cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      
                      {/* Live Calculation Preview Card */}
                      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                          <Clock size={16} className="text-brand-green" />
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                            {lang === 'bn' ? 'লাইভ কার্যকাল ও ওভারটাইম হিসাব' : 'Calculated Shift Summary'}
                          </h4>
                        </div>

                        {manualStatus !== 'Absent' && manualStatus !== 'Leave' && hasBothTimes ? (
                          <div className="space-y-3 text-xs">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                              <span className="text-slate-500 text-[11px] font-bold">{lang === 'bn' ? 'কাজের মোট সময়:' : 'Total Duration:'}</span>
                              <span className="font-black text-slate-800 text-sm font-mono">
                                {previewH} {lang === 'bn' ? 'ঘণ্টা' : 'h'} {previewM > 0 ? `${previewM} ${lang === 'bn' ? 'মি.' : 'm'}` : ''}
                              </span>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                              <span className="text-slate-500 text-[11px] font-bold">{lang === 'bn' ? 'ওভারটাইম / শর্টফল:' : 'OT / Shortfall:'}</span>
                              <div>
                                {isOt ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <TrendingUp size={12} className="text-emerald-700" />
                                    <span>+{toBnDigits(otHours)} {lang === 'bn' ? 'ঘণ্টা ওভারটাইম' : 'h OT'}</span>
                                  </span>
                                ) : isShort ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                    <ArrowDownRight size={12} className="text-orange-700" />
                                    <span>-{toBnDigits(shortHours)} {lang === 'bn' ? 'ঘণ্টা কম' : 'h Shortfall'}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                    <Check size={12} className="text-slate-700" />
                                    <span>{lang === 'bn' ? '৮ ঘণ্টা পূর্ণ' : '8h Standard'}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                              <span className="text-slate-500 text-[11px] font-bold">{lang === 'bn' ? 'ভেরিফাইড লোকেশন:' : 'Location:'}</span>
                              <span className="inline-flex items-center gap-1 text-emerald-800 font-bold truncate max-w-[170px]">
                                <MapPin size={11} className="text-emerald-600 shrink-0" />
                                <span className="truncate">{manualLocation}</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                            {manualStatus === 'Absent' ? (
                              <span className="text-rose-600 font-bold">{lang === 'bn' ? 'কর্মকর্তা আজকের তারিখে অনুপস্থিত হিসেবে রেকর্ড হবেন।' : 'Marked as Absent.'}</span>
                            ) : manualStatus === 'Leave' ? (
                              <span className="text-blue-600 font-bold">{lang === 'bn' ? 'কর্মকর্তার ছুটি রেকর্ড করা হবে।' : 'Marked as on Leave.'}</span>
                            ) : (
                              <span>{lang === 'bn' ? 'প্রবেশ ও প্রস্থান সময় প্রদান করলে লাইভ কাজের সময় ও ওভারটাইম হিসাব দেখা যাবে।' : 'Provide check-in and check-out times to preview calculations.'}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Employee Information Card */}
                      {selectedEmp && (
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {lang === 'bn' ? 'নির্বাচিত কর্মকর্তার বিবরণ' : 'Selected Employee Info'}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                              {selectedEmp.avatar ? (
                                <img src={selectedEmp.avatar} alt={selectedEmp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-black text-brand-green">{selectedEmp.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-slate-800 text-xs truncate">{lang === 'bn' ? selectedEmp.nameBn : selectedEmp.name}</h5>
                              <p className="text-[10px] text-slate-400 font-medium truncate">{selectedEmp.id} • {lang === 'bn' ? selectedEmp.designationBn : selectedEmp.designation}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                            <span className="text-slate-400 text-[10px]">{lang === 'bn' ? 'মূল বেতন:' : 'Basic:'}</span>
                            <span className="font-extrabold text-slate-800 font-sans">৳{selectedEmp.baseSalary ? selectedEmp.baseSalary.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US') : '0'}</span>
                          </div>
                        </div>
                      )}

                    </div>

                  </form>
                </div>
              </div>
            </div>
          );
        })()}

        {/* App Installation Guide / Prompt Modal */}
        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
              <button
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border-0 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 pt-1">
                <img src="/logo.svg" alt="Smart Trading Logo" className="w-11 h-11 object-contain shrink-0" />
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {lang === 'bn' ? 'স্মার্ট ট্রেডিং শপ অ্যাপ ডাউনলোড' : 'Smart Trading Shop App Download'}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {lang === 'bn' ? 'ব্রাউজার ছাড়াই হোম স্ক্রিন থেকে ব্যবহার করুন' : 'Access directly from your desktop or phone home screen'}
                  </p>
                </div>
              </div>

              {deferredPrompt && (
                <button
                  onClick={async () => {
                    deferredPrompt.prompt();
                    const choice = await deferredPrompt.userChoice;
                    if (choice && choice.outcome === 'accepted') {
                      setIsAppInstalled(true);
                      setDeferredPrompt(null);
                      setShowInstallModal(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-xs py-3 rounded-xl shadow-md cursor-pointer border-0 transition-all"
                >
                  <Download size={16} />
                  <span>{lang === 'bn' ? 'এখনই অ্যাপ ইনস্টল করুন (১-ক্লিক)' : 'Install App Now (1-Click)'}</span>
                </button>
              )}

              <div className="space-y-3 text-xs text-slate-600">
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-[11.5px]">
                    <Monitor size={15} className="text-brand-green" />
                    <span>{lang === 'bn' ? 'কম্পিউটার / ল্যাপটপে ইনস্টল:' : 'Desktop / PC Installation:'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {lang === 'bn'
                      ? 'Chrome বা Edge ব্রাউজারের অ্যাড্রেস বারের ডানপাশে থাকা "Install" (ডাউনলোড) আইকনে ক্লিক করে সরাসরি কম্পিউটারে সেভ করুন।'
                      : 'Click the "Install" icon on the right side of Chrome/Edge address bar to install.'}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-[11.5px]">
                    <Smartphone size={15} className="text-brand-green" />
                    <span>{lang === 'bn' ? 'অ্যান্ড্রয়েড ফোনে ইনস্টল:' : 'Android Phone Installation:'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {lang === 'bn'
                      ? 'ক্রোম ব্রাউজারের উপরে ডানদিকের তিনটি ডট (⋮) এ ক্লিক করে "Install app" বা "Add to Home screen" চাপুন।'
                      : 'Tap the 3 dots (⋮) in Chrome and select "Install app" or "Add to Home screen".'}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-[11.5px]">
                    <Smartphone size={15} className="text-brand-green" />
                    <span>{lang === 'bn' ? 'আইফোন / আইপ্যাডে ইনস্টল:' : 'iPhone / iPad Installation:'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {lang === 'bn'
                      ? 'সাফারি ব্রাউজারের নিচের Share আইকনে ট্যাপ করে "Add to Home Screen" সিলেক্ট করুন।'
                      : 'Tap the Share icon in Safari and select "Add to Home Screen".'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border-0 cursor-pointer"
              >
                {lang === 'bn' ? 'ঠিক আছে, বুঝতে পেরেছি' : 'Got it'}
              </button>
            </div>
          </div>
        )}

        {/* OurBuilders ERP Style Premium Punch Attendance Confirmation Modal */}
        {punchSuccessData && punchSuccessData.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in font-sans select-none">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
              {/* Top Accent Strip */}
              <div className={`absolute top-0 left-0 right-0 h-2 ${
                punchSuccessData.type === 'checkin'
                  ? punchSuccessData.status === 'Late'
                    ? 'bg-amber-500'
                    : 'bg-brand-green'
                  : 'bg-rose-500'
              }`} />

              {/* Close Icon Button */}
              <button
                type="button"
                onClick={() => setPunchSuccessData(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
              >
                <X size={18} />
              </button>

              {/* Animated Success Badge */}
              <div className="flex justify-center pt-2">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg ${
                  punchSuccessData.type === 'checkin'
                    ? punchSuccessData.status === 'Late'
                      ? 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/60'
                      : 'bg-emerald-50 text-brand-green ring-8 ring-emerald-50/60'
                    : 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/60'
                }`}>
                  {punchSuccessData.type === 'checkin' ? (
                    <CheckCircle2 size={36} className="animate-bounce" />
                  ) : (
                    <LogOut size={32} />
                  )}
                </div>
              </div>

              {/* Title & Badge */}
              <div className="space-y-1.5">
                <h3 className="font-black text-slate-900 text-lg">
                  {punchSuccessData.type === 'checkin' 
                    ? (lang === 'bn' ? 'হাজিরা সফলভাবে গৃহীত!' : 'Check-In Confirmed!') 
                    : (lang === 'bn' ? 'প্রস্থান সফলভাবে সংরক্ষিত!' : 'Check-Out Confirmed!')}
                </h3>
                <div className="flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    punchSuccessData.status === 'Late'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : punchSuccessData.type === 'checkin'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {punchSuccessData.statusBn}
                  </span>
                </div>
              </div>

              {/* Digital Stamp Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs text-left">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[9.5px]">{lang === 'bn' ? 'কর্মকর্তার নাম' : 'Employee'}:</span>
                  <span className="font-extrabold text-slate-800">{punchSuccessData.empName} ({punchSuccessData.empId})</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase text-[9.5px]">{lang === 'bn' ? 'তারিখ ও সময়' : 'Date & Time'}:</span>
                  <span className="font-mono font-bold text-slate-800">{punchSuccessData.date} • {punchSuccessData.time}</span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-bold uppercase text-[9.5px]">{lang === 'bn' ? 'লোকেশন' : 'Location'}:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <MapPin size={11} className="text-emerald-600" />
                    <span>{punchSuccessData.location}</span>
                  </span>
                </div>
              </div>

              {/* Note Message */}
              {punchSuccessData.note && (
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {punchSuccessData.note}
                </p>
              )}

              {/* Done Button */}
              <button
                type="button"
                onClick={() => setPunchSuccessData(null)}
                className="w-full py-3 bg-brand-green hover:bg-brand-green-dark text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-brand-green/20 transition-all cursor-pointer border-0"
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'OK, Understood'}
              </button>
            </div>
          </div>
        )}

        {/* Custom Premium Confirmation & Alert Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          isAlertOnly={confirmModal.isAlertOnly}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel || (() => setConfirmModal(prev => ({ ...prev, isOpen: false })))}
        />

      </div>
  );
}

