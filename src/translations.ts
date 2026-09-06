export type Language = 'bn' | 'en';

export interface Translation {
  nav: {
    home: string;
    projects: string;
    about: string;
    contact: string;
    services: string;
    corporate: string;
    privacy: string;
    customerLogin: string;
  };
  hero: {
    title: string;
    subtitle: string;
    cta: string;
    stats: {
      projects: string;
      clients: string;
      experience: string;
    };
  };
  projects: {
    title: string;
    ongoing: string;
    completed: string;
    viewDetails: string;
  };
  services: {
    title: string;
    architectural: string;
    construction: string;
    interior: string;
  };
  contact: {
    title: string;
    name: string;
    email: string;
    message: string;
    send: string;
  };
}

export const translations: Record<Language, Translation> = {
  bn: {
    nav: {
      home: 'হোম',
      projects: 'প্রকল্পসমূহ',
      about: 'আমাদের সম্পর্কে',
      contact: 'যোগাযোগ',
      services: 'সেবাসমূহ',
      corporate: 'কর্পোরেট',
      privacy: 'প্রাইভেসি পলিসি',
      customerLogin: 'লগইন',
    },
    hero: {
      title: 'আপনার স্বপ্নের ঠিকানা গড়ুন আমাদের সাথে',
      subtitle: 'স্মার্ট ট্রেডিং - আস্থার প্রতীক। আধুনিক ব্যবসায়িক সেবা এবং গুণগত মানের সমন্বয়ে আপনার নির্ভরযোগ্য প্রতিষ্ঠান।',
      cta: 'প্রকল্প দেখুন',
      stats: {
        projects: 'সফল প্রকল্প',
        clients: 'সন্তুষ্ট গ্রাহক',
        experience: 'বছরের অভিজ্ঞতা',
      },
    },
    projects: {
      title: 'আমাদের প্রকল্পসমূহ',
      ongoing: 'চলমান',
      completed: 'সম্পন্ন',
      viewDetails: 'বিস্তারিত দেখুন',
    },
    services: {
      title: 'আমাদের সেবাসমূহ',
      architectural: 'স্থাপত্য নকশা',
      construction: 'নির্মাণ কাজ',
      interior: 'ইন্টেরিয়র ডিজাইন',
    },
    contact: {
      title: 'আমাদের সাথে যোগাযোগ করুন',
      name: 'আপনার নাম',
      email: 'ইমেইল',
      message: 'বার্তা',
      send: 'বার্তা পাঠান',
    },
  },
  en: {
    nav: {
      home: 'Home',
      projects: 'Projects',
      about: 'About Us',
      contact: 'Contact',
      services: 'Services',
      corporate: 'Corporate',
      privacy: 'Privacy Policy',
      customerLogin: 'Login',
    },
    hero: {
      title: 'Build Your Dream Home With Us',
      subtitle: 'Smart Trading - Symbol of Trust. Reliable business solutions with quality and modern excellence.',
      cta: 'View Projects',
      stats: {
        projects: 'Successful Projects',
        clients: 'Happy Clients',
        experience: 'Years Experience',
      },
    },
    projects: {
      title: 'Our Projects',
      ongoing: 'Ongoing',
      completed: 'Completed',
      viewDetails: 'View Details',
    },
    services: {
      title: 'Our Services',
      architectural: 'Architectural Design',
      construction: 'Construction',
      interior: 'Interior Design',
    },
    contact: {
      title: 'Contact Us',
      name: 'Your Name',
      email: 'Email',
      message: 'Message',
      send: 'Send Message',
    },
  },
};
