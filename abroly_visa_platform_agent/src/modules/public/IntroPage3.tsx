import { motion } from 'framer-motion';
import { Shield, Award, Star, Clock, ClipboardCheck, Briefcase, Settings, ShieldCheck, Layers, CheckCircle, ArrowRightCircle, Circle } from 'lucide-react';
import { Card, Avatar } from "@heroui/react";
import {
  Users,
  BarChart2,
  Calendar,
  Mail,
  FileText,
  Bell
} from 'lucide-react';
import {
  BarChart3,
  Globe,
  ArrowRight,
  Sparkles,
  TrendingUp,
  UserCheck,
  FileCheck,
  Zap,
  BookOpen
} from 'lucide-react';
import { Quote } from 'lucide-react';
import { Input, Button } from "@heroui/react";
import { Calculator } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Progress } from 'rsuite';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);


const TrustedPartners = () => {
  const partners = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/2560px-Google_2015_logo.svg.png',
    // Add more partner logos
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Shield className="text-blue-600" />
          <h2 className="text-2xl font-semibold text-center">Trusted by Industry Leaders</h2>
        </div>

        <motion.div
          className="flex flex-wrap justify-center items-center gap-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {partners.map((logo, index) => (
            <img
              key={index}
              src={logo}
              alt="Partner Logo"
              className="h-12 grayscale hover:grayscale-0 transition-all"
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

// const FeatureShowcase = () => {

//   const features = [
//     {
//       icon: <ClipboardCheck size={40} className="text-primary" />, // Unified Lead Management
//       title: "Unified Lead Management",
//       description: "All leads related to study, work permits, and job opportunities flow into a single portal for easy tracking and management."
//     },
//     {
//       icon: <Briefcase size={40} className="text-primary" />, // Post Updates & Job Roles
//       title: "Post Updates & Job Roles",
//       description: "Agents can post the latest updates, job role requirements, and international opportunities instantly visible to students and career aspirants."
//     },
//     {
//       icon: <Globe size={40} className="text-primary" />, // Visa Process Support
//       title: "Visa Process Support",
//       description: "Multiple agents available to handle visa processes, with easy tracking for students and consultants through the web portal."
//     },
//     {
//       icon: <Settings size={40} className="text-primary" />, // Comprehensive CRM Integration
//       title: "Comprehensive CRM Integration",
//       description: "Full CRM capabilities to track inquiries, manage profiles, set reminders, and update lead status, ensuring better engagement and conversion."
//     },
//     {
//       icon: <Users size={40} className="text-primary" />, // Team Management
//       title: "Team Management",
//       description: "Consultants can add team members, delegate tasks, and manage consultant profiles with detailed tracking of performance."
//     },
//     {
//       icon: <ShieldCheck size={40} className="text-primary" />, // Customizable Consultant Profile
//       title: "Customizable Consultant Profile",
//       description: "Build and manage a detailed consultant profile that showcases your expertise, services, and success stories to attract potential clients."
//     },
//     {
//       icon: <Layers size={40} className="text-primary" />, // Service Specialization
//       title: "Service Specialization",
//       description: "Showcase various services such as course options, job roles, work permits, and visa consultancy, each handled professionally through the platform."
//     },
//     {
//       icon: <Bell size={40} className="text-primary" />, // RealTime Notifications
//       title: "Real-Time Notifications",
//       description: "Stay updated with new leads, inquiries, and important deadlines via real-time notifications."
//     }
//   ];

//   return (
//     <section className="py-20 bg-slate-50">
//       <div className="container mx-auto px-4">
//         <motion.div
//           className="text-center mb-16"
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.5 }}
//         >
//           <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything You Need to <span className='text-primary font-semibold'> Succeed </span></h2>
//           <p className="text-slate-600 max-w-2xl mx-auto text-lg">
//             Our comprehensive CRM solution provides all the tools you need to streamline your visa consultancy business.
//           </p>
//         </motion.div>

//         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
//           {features.map((feature, index) => (
//             <motion.div
//               key={index}
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.5, delay: index * 0.1 }}
//             >
//               <Card className="p-6 shadow-md hover:shadow-xl transition border border-gray-200 rounded-2xl bg-white cursor-pointer duration-700">
//                 <div className="mb-4">{feature.icon}</div>
//                 <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
//                 <p className="text-slate-600 text-base">{feature.description}</p>
//               </Card>
//             </motion.div>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// };

const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CEO, Global Visa Services",
      image: "https://images.pexels.com/photos/1987301/pexels-photo-1987301.jpeg",
      quote: "TechX CRM has transformed how we manage our visa applications. The efficiency gains are remarkable."
    },
    // Add more testimonials
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-4">What Our Clients Say</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what successful agencies have achieved with TechX CRM.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-6">
                <Quote className="text-blue-600 mb-4" size={24} />
                <p className="text-slate-600 mb-6">{testimonial.quote}</p>
                <div className="flex items-center gap-4">
                  <Avatar src={testimonial.image} size="lg" />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-slate-600">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};


const HeroSection = () => {
  // Background floating icons animation
  const floatingIconsVariants = {
    animate: {
      x: [0, -10, 0],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const navigate = useNavigate();

  // Dashboard chart data
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Leads',
        data: [45, 52, 48, 61, 55, 68],
        borderColor: '#f66b47',
        backgroundColor: 'rgba(246, 107, 71, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#f66b47',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
        },
      },
    },
  };

  return (
    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Floating background icons */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial="initial"
        animate="animate"
      >
        <motion.div
          variants={floatingIconsVariants}
          className="absolute top-20 right-20 text-blue-200"
        >
          <Globe size={40} />
        </motion.div>
        {/* Add more floating icons as needed */}
      </motion.div>

      <div className="container mx-auto px-4 py-20 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Content */}
        <motion.div
          className="lg:w-1/2 space-y-8"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl lg:text-6xl font-bold text-slate-800 leading-tight">
            Run Your Entire Visa <br />
            Consultancy From One <br />
            <span className="text-primary">Dashboard.</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-xl leading-relaxed">
            Automate student management with visa tracking, language training, CRM, and job posting — all in one powerful platform.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              className="bg-primary text-white px-8 hover:opacity-90 transition-opacity"
              endContent={<ArrowRight size={20} />}
            >
              Start Free Demo
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="border-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-8"
              onPress={() => {
                navigate("/contact_us")
              }}
            >
              Contact Us
            </Button>
          </div>

          {/* Trust Stat Line */}
          <div className="pt-4">
            <p className="text-base text-slate-600 font-medium">
              Trusted by <span className="font-bold text-slate-800">100+ consultancies</span> across India.
            </p>
          </div>
        </motion.div>

        {/* Right Content - Dashboard Preview */}
        <motion.div
          className="lg:w-1/2 mt-12 lg:mt-0 w-full"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 relative border border-slate-200">
            {/* Dashboard Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Dashboard Overview</h3>
                <p className="text-sm text-slate-500">Last 30 days</p>
              </div>
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Live</span>
              </div>
            </div>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <motion.div
                className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Users className="text-blue-600" size={24} />
                  <TrendingUp className="text-green-600" size={16} />
                </div>
                <p className="text-2xl font-bold text-slate-800">2,891</p>
                <p className="text-xs text-slate-600 mt-1">Total Leads</p>
              </motion.div>

              <motion.div
                className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <UserCheck className="text-green-600" size={24} />
                  <TrendingUp className="text-green-600" size={16} />
                </div>
                <p className="text-2xl font-bold text-slate-800">1,245</p>
                <p className="text-xs text-slate-600 mt-1">Active Students</p>
              </motion.div>

              <motion.div
                className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileCheck className="text-orange-600" size={24} />
                  <Clock className="text-orange-600" size={16} />
                </div>
                <p className="text-2xl font-bold text-slate-800">342</p>
                <p className="text-xs text-slate-600 mt-1">Pending Visas</p>
              </motion.div>

              <motion.div
                className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="text-purple-600" size={24} />
                  <TrendingUp className="text-green-600" size={16} />
                </div>
                <p className="text-2xl font-bold text-slate-800">98%</p>
                <p className="text-xs text-slate-600 mt-1">Success Rate</p>
              </motion.div>
            </div>

            {/* Chart Section */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-slate-700">Leads Growth</h4>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-xs text-slate-600">Monthly Leads</span>
                </div>
              </div>
              <div className="h-48">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Floating Stats Badge */}
            <motion.div
              className="absolute -right-4 -top-4 bg-white p-3 rounded-xl shadow-lg border border-slate-200"
              whileHover={{ scale: 1.05, rotate: 2 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Award className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-600">This Month</p>
                  <p className="text-sm font-bold text-slate-800">+24%</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const BenefitsSection = () => {
  const benefits = [
    {
      icon: <Users className="text-primary" size={32} />,
      title: "Smart CRM",
      description: "Manage every student inquiry, track progress, and never miss a lead."
    },
    {
      icon: <Zap className="text-primary" size={32} />,
      title: "Automated Workflow",
      description: "Simplify visa processing — organize stages, documents, and deadlines easily."
    },
    {
      icon: <BarChart3 className="text-primary" size={32} />,
      title: "Insight Dashboard",
      description: "See your agency's performance, leads, and growth in one clear view."
    },
    {
      icon: <BookOpen className="text-primary" size={32} />,
      title: "Language Training",
      description: "Run and manage IELTS, PTE, or TOEFL batches — everything in one place."
    },
    {
      icon: <Briefcase className="text-primary" size={32} />,
      title: "Job & Career Module",
      description: "Post jobs and help your students find global work opportunities."
    },
    {
      icon: <Sparkles className="text-primary" size={32} />,
      title: "White-Label Branding",
      description: "Launch under your own logo, domain, and identity — powered by TechX Universe."
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Why <span className='text-primary font-semibold'>100+ Visa Agencies</span> Love TechX Universe
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <Card className="p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 rounded-2xl bg-white h-full flex flex-col">
                <div className="mb-4 flex items-center justify-center w-16 h-16 bg-primary/10 rounded-xl">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SocialProofSection = () => {
  const testimonials = [
    {
      name: "Rajesh Kumar",
      agency: "Global Path Visa",
      city: "Ahmedabad",
      photo: "https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
      quote: "Earlier, we used Excel to track 200+ students — now it's all automated! TechX Universe made our process 3x faster.",
      rating: 5
    },
    {
      name: "Priya Sharma",
      agency: "EduConnect International",
      city: "Mumbai",
      photo: "https://images.pexels.com/photos/3184405/pexels-photo-3184405.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
      quote: "The dashboard gives us complete visibility into our operations. Managing leads and tracking visa status has never been easier.",
      rating: 5
    },
    {
      name: "Amit Patel",
      agency: "Study Abroad Solutions",
      city: "Delhi",
      photo: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop",
      quote: "TechX Universe transformed our consultancy. We've increased our student intake by 40% since implementing the platform.",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            From Manual to <span className="text-primary">Magical</span> — See What Agencies Are Saying
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 rounded-2xl bg-white h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="text-yellow-400 fill-yellow-400" size={18} />
                  ))}
                </div>
                <Quote className="text-primary mb-3" size={24} />
                <p className="text-slate-700 mb-6 leading-relaxed flex-grow">{testimonial.quote}</p>
                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                  <Avatar 
                    src={testimonial.photo} 
                    size="lg"
                    className="border-2 border-primary/20"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-600">{testimonial.agency}</p>
                    <p className="text-xs text-slate-500">{testimonial.city}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Mini Counter */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-6 md:gap-12 bg-white px-8 py-6 rounded-2xl shadow-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-2xl font-bold text-gray-900">10,000+</p>
                <p className="text-sm text-slate-600">students managed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-2xl font-bold text-gray-900">500+</p>
                <p className="text-sm text-slate-600">active leads</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-2xl font-bold text-gray-900">30+</p>
                <p className="text-sm text-slate-600">cities served</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
const HowItWorksSection = () => {
  const steps = [
    { step: "Agent Registration", description: "Sign up on TechX CRM as a consultant by filling out your professional details." },
    { step: "Post Opportunities", description: "List courses, job roles, visa services, and offerings to attract leads." },
    { step: "Manage Leads", description: "Use CRM features to monitor, manage, and communicate with leads." },
    { step: "Team Collaboration", description: "Add team members and delegate tasks for efficient consultancy." },
    { step: "Regular Updates", description: "Post updates on jobs, courses, and visa processes to keep your audience informed." }
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How TechX CRM  <span className='text-primary font-semibold'>Works</span></h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Get started in just a few simple steps and watch your consultancy thrive.
          </p>
        </motion.div>

        <div className="relative max-w-3xl mx-auto space-y-12">
          {/* Vertical Timeline Line - Hidden on mobile */}
          <div className="hidden md:block absolute left-8 top-0 h-full w-1 bg-gray-200 rounded-full transform -translate-x-1/2"></div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative flex flex-col md:flex-row items-center md:items-start"
            >
              {/* Step Number Circle - Adjusted for mobile */}
              <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 relative z-10 mb-4 md:mb-0">
                <motion.div
                  className="absolute w-12 h-12 md:w-16 md:h-16 bg-primary text-white rounded-full flex items-center justify-center text-lg md:text-xl font-bold shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {index + 1}
                </motion.div>
                <Circle className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-200 w-16 h-16 md:w-20 md:h-20 hidden md:block" />
              </div>

              {/* Card Content - Full width on mobile */}
              <Card className="w-full md:ml-8 p-6 flex-1 shadow-md hover:shadow-xl transition border border-gray-200 rounded-2xl bg-white transform hover:-translate-y-1 duration-300">
                <div className="flex items-center">
                  <ArrowRightCircle className="text-primary mr-4 flex-shrink-0" size={28} />
                  <div>
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">{step.step}</h3>
                    <p className="text-slate-600 text-sm md:text-base">{step.description}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
const CallToActionSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-to-br ">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold mb-4">Ready to Elevate Your Consultancy?</h2>
          <p className="text-lg max-w-2xl mx-auto mb-8">
            Join TechX CRM today and unlock a world of possibilities for your consultancy business. Register now and start managing all your leads and services with ease!
          </p>
          {/* <Button
            size="lg"
            className="bg-white text-primary px-8 font-semibold"
            endContent={<ArrowRight />}
            // onPress={() => navigate("/signup")} // Adjust route as needed
          >
            Get Started Now
          </Button> */}
        </motion.div>
      </div>
    </section>
  );
};

const ConclusionSection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Revolutionize Your  <span className='text-primary font-semibold'>Consultancy</span> with TechX CRM</h2>
          <p className="text-slate-600 max-w-3xl mx-auto text-lg">
            TechX CRM is transforming the consultancy experience for agents and students alike. With a centralized platform, advanced CRM tools, team management features, and a vast network of opportunities, we help agents achieve greater success while empowering students and career aspirants to make informed decisions. Let us help you grow your consultancy with ease and efficiency.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

const WhyChooseUsSection = () => {
  const reasons = [
    { title: "Comprehensive Platform", description: "A one-stop solution for managing courses, jobs, and visa processes." },
    { title: "Advanced CRM Tools", description: "Boost efficiency and lead conversion with seamless tracking and management." },
    { title: "Real-Time Updates", description: "Stay informed and connected with your clients at all times." },
    { title: "Global Opportunities", description: "Access a wide range of international education and career options." },
    { title: "Trustworthy Support", description: "Backed by a team of experts committed to your success." }
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4"> <span className='text-primary font-semibold'>Why Choose</span> TechX CRM?</h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Here’s what sets us apart and makes TechX CRM the ultimate choice for your consultancy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-6 shadow-md hover:shadow-xl transition border border-gray-200 rounded-2xl bg-white">
                <div className="flex items-center mb-4">
                  <Star className="text-primary mr-3" size={24} />
                  <h3 className="text-xl font-semibold text-gray-900">{reason.title}</h3>
                </div>
                <p className="text-slate-600">{reason.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTAFinal = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Ready to <span className="text-primary">Digitize</span> Your Visa Consultancy?
          </h2>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            Get access to the future of visa operations — today.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-primary text-white px-8 py-6 text-lg hover:opacity-90 transition-opacity"
              endContent={<ArrowRight size={20} />}
            >
              Start Free Demo
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="border-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-8 py-6 text-lg"
              onPress={() => {
                navigate("/login")
              }}
            >
              Login to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
const IntroPage3 = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <main>
      <HeroSection />
      {/* <TrustedPartners /> */}
      {/* <FeatureShowcase /> */}
      {/* <TestimonialsSection /> */}
      <BenefitsSection />
      <SocialProofSection />
      <CTAFinal/>
      {/* <HowItWorksSection /> */}
      {/* <WhyChooseUsSection /> */}
      {/* <ConclusionSection /> */}
      {/* <CallToActionSection /> */}

    </main>
  );
}

export default IntroPage3