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
      projects: 'পণ্য ও শোরুম',
      about: 'আমাদের সম্পর্কে',
      contact: 'যোগাযোগ',
      services: 'ব্যবসায়িক সেবা',
      corporate: 'কর্পোরেট',
      privacy: 'প্রাইভেসি পলিসি',
      customerLogin: 'লগইন',
    },
    hero: {
      title: 'স্মার্ট ট্রেডিং এ আপনাকে স্বাগতম',
      subtitle: 'স্মার্ট ট্রেডিং - আস্থার প্রতীক। আধুনিক ব্যবসায়িক সেবা, পাইকারি ও খুচরা পণ্যের গুণগত মানের সমন্বয়ে আপনার নির্ভরযোগ্য প্রতিষ্ঠান।',
      cta: 'আমাদের শপ দেখুন',
      stats: {
        projects: 'সফল ডেলিভারি',
        clients: 'সন্তুষ্ট গ্রাহক',
        experience: 'বছরের অভিজ্ঞতা',
      },
    },
    projects: {
      title: 'আমাদের পণ্য ও শোরুম',
      ongoing: 'চলমান অর্ডার',
      completed: 'সম্পন্ন সরবরাহ',
      viewDetails: 'বিস্তারিত দেখুন',
    },
    services: {
      title: 'আমাদের সেবাসমূহ',
      architectural: 'পাইকারি ও ডিস্ট্রিবিউশন',
      construction: 'রিটেল ও শোরুম সেলস',
      interior: 'কাস্টমার সাপোর্ট ও সাপ্লাই',
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
      projects: 'Products & Showroom',
      about: 'About Us',
      contact: 'Contact',
      services: 'Services',
      corporate: 'Corporate',
      privacy: 'Privacy Policy',
      customerLogin: 'Login',
    },
    hero: {
      title: 'Welcome to Smart Trading',
      subtitle: 'Smart Trading - Symbol of Trust. Reliable business solutions, retail, wholesale and showroom excellence.',
      cta: 'Explore Showroom',
      stats: {
        projects: 'Successful Deliveries',
        clients: 'Happy Clients',
        experience: 'Years Experience',
      },
    },
    projects: {
      title: 'Our Products & Showrooms',
      ongoing: 'Active Orders',
      completed: 'Completed Deliveries',
      viewDetails: 'View Details',
    },
    services: {
      title: 'Our Services',
      architectural: 'Wholesale & Distribution',
      construction: 'Retail & Showroom Sales',
      interior: 'Customer Support & Supply',
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
