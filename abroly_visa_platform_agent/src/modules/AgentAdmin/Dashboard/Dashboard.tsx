import useApiCallUtils from '@/hooks/useApiCallUtils';
import { Button, Spinner } from '@heroui/react';
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query'; // React Query
import { Bar, Pie, Line } from 'react-chartjs-2'; // Chart.js components
import {
  Users,
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Globe,
  GraduationCap,
  Calendar,
  Target,
  BarChart3,
  Activity,
  XCircle,
  Ban,
  Award,
  Zap,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const Dashboard: React.FC = () => {
  const { commonGetAPICalls } = useApiCallUtils();

  // Fetch Subscription
  const { data: subscription, isLoading: isSubscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const { data, success } = await commonGetAPICalls('/subscription/agent_subscription/active');
      if (!success) throw new Error('Failed to fetch subscription');
      return data;
    },
  });

  // 1. Lead Overview Widgets
  const { data: totalLeads } = useQuery({
    queryKey: ['totalLeads'],
    queryFn: async () => (await commonGetAPICalls('/statistics/total_leads')).data,
  });

  const { data: leadStatusBreakdown } = useQuery({
    queryKey: ['leadStatusBreakdown'],
    queryFn: async () => (await commonGetAPICalls('/statistics/lead_status_breakdown')).data,
  });

  // const { data: leadTypeDistribution } = useQuery({
  //   queryKey: ['leadTypeDistribution'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/lead_type_distribution')).data,
  // });

  const { data: leadsByCountry } = useQuery({
    queryKey: ['leadsByCountry'],
    queryFn: async () => (await commonGetAPICalls('/statistics/leads_by_country')).data,
  });

  const { data: recentLeads } = useQuery({
    queryKey: ['recentLeads'],
    queryFn: async () => (await commonGetAPICalls('/statistics/recent_leads')).data,
  });

  // 2. Application Progress Widgets
  // const { data: totalRaisedApplications } = useQuery({
  //   queryKey: ['totalRaisedApplications'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/total_raised_applications')).data,
  // });

  // const { data: applicationStatusBreakdown } = useQuery({
  //   queryKey: ['applicationStatusBreakdown'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/application_status_breakdown')).data,
  // });

  const { data: topUniversitiesApplied } = useQuery({
    queryKey: ['topUniversitiesApplied'],
    queryFn: async () => (await commonGetAPICalls('/statistics/top_universities_applied')).data,
  });

  const { data: intakeYearDistribution } = useQuery({
    queryKey: ['intakeYearDistribution'],
    queryFn: async () => (await commonGetAPICalls('/statistics/intake_year_distribution')).data,
  });

  // 3. Steps and Questions Widgets
  // const { data: stepsCompletionRate } = useQuery({
  //   queryKey: ['stepsCompletionRate'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/steps_completion_rate')).data,
  // });

  // const { data: pendingQuestions } = useQuery({
  //   queryKey: ['pendingQuestions'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/pending_questions')).data,
  // });

  // const { data: questionTypeBreakdown } = useQuery({
  //   queryKey: ['questionTypeBreakdown'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/question_type_breakdown')).data,
  // });

  // 4. Student Engagement Widgets
  // const { data: activeStudents } = useQuery({
  //   queryKey: ['activeStudents'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/active_students')).data,
  // });

  const { data: lastFollowUpActivity } = useQuery({
    queryKey: ['lastFollowUpActivity'],
    queryFn: async () => (await commonGetAPICalls('/statistics/last_follow_up_activity')).data,
  });

  // const { data: studentsByLeadStatus } = useQuery({
  //   queryKey: ['studentsByLeadStatus'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/students_by_lead_status')).data,
  // });

  // 5. Calendar and Time-Based Widgets
  const { data: upcomingFollowUps } = useQuery({
    queryKey: ['upcomingFollowUps'],
    queryFn: async () => (await commonGetAPICalls('/statistics/upcoming_follow_ups')).data,
  });

  // const { data: leadsCreatedOverTime } = useQuery({
  //   queryKey: ['leadsCreatedOverTime'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/leads_created_over_time')).data,
  // });

  // 6. Performance Metrics Widgets
  const { data: visaSuccessRate } = useQuery({
    queryKey: ['visaSuccessRate'],
    queryFn: async () => (await commonGetAPICalls('/statistics/visa_success_rate')).data,
  });

  // const { data: averageTimeToVisaCompletion } = useQuery({
  //   queryKey: ['averageTimeToVisaCompletion'],
  //   queryFn: async () => (await commonGetAPICalls('/statistics/average_time_to_visa_completion')).data,
  // });

  const { data: visaInProgressLeads } = useQuery({
    queryKey: ['visaInProgressLeads'],
    queryFn: async () => (await commonGetAPICalls('/statistics/visa_in_progress_leads')).data,
  });

  // 7. Miscellaneous Widgets
  const { data: withdrawnLeads } = useQuery({
    queryKey: ['withdrawnLeads'],
    queryFn: async () => (await commonGetAPICalls('/statistics/withdrawn_leads')).data,
  });

  const { data: rejectedApplications } = useQuery({
    queryKey: ['rejectedApplications'],
    queryFn: async () => (await commonGetAPICalls('/statistics/rejected_applications')).data,
  });

  // Chart Data Preparation - Modern Color Palette
  const leadStatusChartData = {
    labels: leadStatusBreakdown?.map((item: any) => item.status) || [],
    datasets: [{
      data: leadStatusBreakdown?.map((item: any) => item.count) || [],
      backgroundColor: [
        '#450920', // Dark maroon
        '#a53860', // Deep pink
        '#da627d', // Medium pink
        '#ffa5ab', // Light pink
        '#f9dbbd', // Very light pink/peach
      ],
    }],
  };

  // const leadTypeChartData = {
  //   labels: leadTypeDistribution?.map((item: any) => item.lead_type) || [],
  //   datasets: [{
  //     data: leadTypeDistribution?.map((item: any) => item.count) || [],
  //     backgroundColor: ['#3b82f6', '#10b981'],
  //   }],
  // };

  const leadsByCountryChartData = {
    labels: leadsByCountry?.map((item: any) => item.selected_country) || [],
    datasets: [{
      label: 'Leads',
      data: leadsByCountry?.map((item: any) => item.count) || [],
      backgroundColor: '#a53860', // Deep pink
    }],
  };

  // const applicationStatusChartData = {
  //   labels: applicationStatusBreakdown?.map((item: any) => item.status) || [],
  //   datasets: [{
  //     data: applicationStatusBreakdown?.map((item: any) => item.count) || [],
  //     backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444'],
  //   }],
  // };

  const topUniversitiesChartData = {
    labels: topUniversitiesApplied?.map((item: any) => item.university) || [],
    datasets: [{
      label: 'Applications',
      data: topUniversitiesApplied?.map((item: any) => item.count) || [],
      backgroundColor: '#da627d', // Medium pink
    }],
  };

  const intakeYearChartData = {
    labels: intakeYearDistribution?.map((item: any) => item.selected_intake_year) || [],
    datasets: [{
      label: 'Leads',
      data: intakeYearDistribution?.map((item: any) => item.count) || [],
      backgroundColor: '#ffa5ab', // Light pink
    }],
  };

  // const questionTypeChartData = {
  //   labels: questionTypeBreakdown?.map((item: any) => item.question_type) || [],
  //   datasets: [{
  //     data: questionTypeBreakdown?.map((item: any) => item.count) || [],
  //     backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#ef4444'],
  //   }],
  // };

  // const studentsByLeadStatusChartData = {
  //   labels: studentsByLeadStatus?.map((item: any) => item.status) || [],
  //   datasets: [{
  //     label: 'Students',
  //     data: studentsByLeadStatus?.map((item: any) => item.count) || [],
  //     backgroundColor: '#3b82f6',
  //   }],
  // };

  // const leadsOverTimeChartData = {
  //   labels: leadsCreatedOverTime?.map((item: any) => item.month) || [],
  //   datasets: [{
  //     label: 'Leads Created',
  //     data: leadsCreatedOverTime?.map((item: any) => item.count) || [],
  //     borderColor: '#10b981',
  //     backgroundColor: 'rgba(16, 185, 129, 0.1)',
  //     fill: true,
  //     tension: 0.4,
  //     pointRadius: 4,
  //     pointHoverRadius: 6,
  //   }],
  // };

  // Premium Stat Card Component with animations
  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color,
    gradient,
    delay = 0
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    color: string;
    gradient?: string;
    delay?: number;
  }) => (
    <div 
      className="group relative bg-white border border-gray-200/60 rounded-xl p-4 sm:p-5 
                 shadow-sm hover:shadow-xl transition-all duration-300 ease-out
                 hover:-translate-y-1 hover:border-transparent
                 overflow-hidden cursor-pointer"
      style={{
        animation: `fadeInUp 0.6s ease-out ${delay}ms both`
      }}
    >
      {/* Gradient overlay on hover */}
      {gradient && (
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient}`} />
      )}
      
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-gray-50/50 
                      group-hover:from-white group-hover:via-gray-50 group-hover:to-white 
                      transition-all duration-500" />
      
      <div className="relative flex items-center justify-between z-10">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 
                       group-hover:text-gray-700 transition-colors duration-300">
            {title}
          </p>
          <p className={`text-2xl sm:text-3xl font-bold ${color} 
                       group-hover:scale-105 transition-transform duration-300 inline-block`}>
            {value}
          </p>
        </div>
        <div className={`ml-3 p-2.5 rounded-lg bg-gradient-to-br ${gradient || 'from-gray-100 to-gray-200'} 
                        group-hover:scale-110 group-hover:rotate-3 transition-all duration-300
                        shadow-sm group-hover:shadow-md`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${color} 
                           group-hover:opacity-100 opacity-80 transition-opacity duration-300`} />
        </div>
      </div>
      
      {/* Shine effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
                      transition-transform duration-1000 ease-in-out
                      bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );

  // Modern chart options with premium styling
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: true,
      duration: 1000,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: { 
        position: 'bottom' as const,
        labels: {
          padding: 12,
          font: { 
            size: 11,
            weight: 'normal' as const,
            family: 'Quicksand, sans-serif'
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        cornerRadius: 8,
        displayColors: true,
      }
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as const,
    },
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { 
          color: 'rgba(0, 0, 0, 0.04)', 
          drawBorder: false,
          lineWidth: 1
        },
        ticks: { 
          font: { size: 11, family: 'Quicksand, sans-serif' },
          color: '#6b7280',
          padding: 8
        }
      },
      x: {
        grid: { display: false },
        ticks: { 
          font: { size: 11, family: 'Quicksand, sans-serif' },
          color: '#6b7280',
          padding: 8
        }
      }
    }
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1200,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 11 },
        cornerRadius: 8,
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { 
          color: 'rgba(0, 0, 0, 0.04)', 
          drawBorder: false,
          lineWidth: 1
        },
        ticks: { 
          font: { size: 11, family: 'Quicksand, sans-serif' },
          color: '#6b7280',
          padding: 8
        }
      },
      x: {
        grid: { 
          display: false,
          drawBorder: false
        },
        ticks: { 
          font: { size: 11, family: 'Quicksand, sans-serif' },
          color: '#6b7280',
          padding: 8
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br ">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
      
      <div className="w-full max-w-[1920px] mx-auto space-y-4 sm:space-y-6">
        {/* Key Metrics - Top Row with proper full-width responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Total Leads"
            value={totalLeads?.total || 0}
            icon={Users}
            color="text-blue-600"
            gradient="from-blue-50 to-blue-100"
            delay={0}
          />
          {/* <StatCard
            title="Applications"
            value={totalRaisedApplications?.total || 0}
            icon={FileText}
            color="text-green-600"
            gradient="from-green-50 to-green-100"
            delay={50}
          /> */}
          {/* <StatCard
            title="Active Students"
            value={activeStudents?.total || 0}
            icon={Activity}
            color="text-purple-600"
            gradient="from-purple-50 to-purple-100"
            delay={100}
          /> */}
          <StatCard
            title="Visa Success"
            value={`${visaSuccessRate?.rate?.toFixed(1) || 0}%`}
            icon={Award}
            color="text-indigo-600"
            gradient="from-indigo-50 to-indigo-100"
            delay={150}
          />
          {/* <StatCard
            title="Avg. Visa Time"
            value={`${averageTimeToVisaCompletion?.avgDays?.toFixed(0) || 0}d`}
            icon={Clock}
            color="text-orange-600"
            gradient="from-orange-50 to-orange-100"
            delay={200}
          /> */}
          <StatCard
            title="Visa In Progress"
            value={`${visaInProgressLeads?.inProgressVisaLeads || 0}`}
            icon={Clock}
            color="text-pink-600"
            gradient="from-pink-50 to-pink-100"
            delay={250}
          />
          <StatCard
            title="Withdrawn"
            value={withdrawnLeads?.total || 0}
            icon={Ban}
            color="text-red-600"
            gradient="from-red-50 to-red-100"
            delay={300}
          />
          <StatCard
            title="Rejected Visa"
            value={rejectedApplications?.total || 0}
            icon={XCircle}
            color="text-gray-600"
            gradient="from-gray-50 to-gray-100"
            delay={350}
          />
        </div>

        {/* Charts Grid - Optimized for full width with modern styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-4">
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 400ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Lead Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Pie data={leadStatusChartData} options={pieChartOptions} />
              </div>
            </CardContent>
          </Card>
          
          {/* <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 450ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Lead Type
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Pie data={leadTypeChartData} options={pieChartOptions} />
              </div>
            </CardContent>
          </Card> */}
          
          {/* <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 500ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Application Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Pie data={applicationStatusChartData} options={pieChartOptions} />
              </div>
            </CardContent>
          </Card>
           */}
          {/* <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 550ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Question Types
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Pie data={questionTypeChartData} options={pieChartOptions} />
              </div>
            </CardContent>
          </Card> */}
          
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 600ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Leads by Country
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Bar data={leadsByCountryChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 650ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Top Universities
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Bar data={topUniversitiesChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 700ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Intake Year
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Bar data={intakeYearChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card>
          
          {/* <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 750ms both' }}
          >
            <CardHeader className="pb-2 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                Students by Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="h-64">
                <Bar data={studentsByLeadStatusChartData} options={barChartOptions} />
              </div>
            </CardContent>
          </Card> */}
        </div>
        
        {/* Large Charts and Activity - Side by Side */}
        {/* <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
          <Card 
            className="xl:col-span-2 group border border-gray-200/60 rounded-xl shadow-sm 
                       hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1 
                       bg-white overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 800ms both' }}
          >
            <CardHeader className="pb-3 px-5 pt-5 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-base font-semibold text-gray-800 group-hover:text-gray-900 transition-colors flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Leads Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 px-5 pb-5">
              <div className="h-80">
                <Line data={leadsOverTimeChartData} options={lineChartOptions} />
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {/* <StatCard
              title="Steps Completion"
              value={`${stepsCompletionRate?.rate?.toFixed(1) || 0}%`}
              icon={Target}
              color="text-purple-600"
              gradient="from-purple-50 to-purple-100"
              delay={850}
            /> 
            <StatCard
              title="Pending Questions"
              value={pendingQuestions?.total || 0}
              icon={MessageSquare}
              color="text-red-600"
              gradient="from-red-50 to-red-100"
              delay={900}
            /> 
          </div>
        </div> */}

        {/* Activity Lists - Full Width Grid with modern styling */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 950ms both' }}
          >
            <CardHeader className="pb-3 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Recent Leads
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {recentLeads?.map((lead: any, index: number) => (
                  <div 
                    key={lead.id} 
                    className="flex items-center justify-between p-3 text-xs border border-gray-100 
                               last:border-0 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent 
                               rounded-lg transition-all duration-200 hover:shadow-sm hover:border-blue-200/50
                               cursor-pointer group/item"
                    style={{ animation: `slideInRight 0.4s ease-out ${1000 + index * 50}ms both` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm group-hover/item:text-blue-700 transition-colors">
                        {lead.user_of?.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{lead.status}</p>
                    </div>
                    <span className="text-xs text-gray-400 ml-3 whitespace-nowrap group-hover/item:text-gray-600 transition-colors">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 1000ms both' }}
          >
            <CardHeader className="pb-3 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-600" />
                Upcoming Follow-Ups
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {upcomingFollowUps?.map((followUp: any, index: number) => (
                  <div
                    key={followUp?.id || index}
                    className="flex items-start gap-3 p-3 border border-gray-100 last:border-0 
                               hover:bg-gradient-to-r hover:from-green-50/50 hover:to-transparent 
                               rounded-lg transition-all duration-200 hover:shadow-sm hover:border-green-200/50
                               cursor-pointer group/item"
                    style={{ animation: `slideInRight 0.4s ease-out ${1050 + index * 50}ms both` }}
                  >
                    <div className="p-1.5 rounded-lg bg-green-100/50 group-hover/item:bg-green-200/50 transition-colors">
                      <Calendar className="w-4 h-4 text-green-600 flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-900 truncate group-hover/item:text-green-700 transition-colors">
                          {followUp.student?.username || 'Unknown'}
                        </p>
                        <span className="text-xs text-gray-400 ml-2 whitespace-nowrap group-hover/item:text-gray-600 transition-colors">
                          {new Date(followUp?.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate leading-relaxed">{followUp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="group border border-gray-200/60 rounded-xl shadow-sm hover:shadow-xl 
                       transition-all duration-300 ease-out hover:-translate-y-1 bg-white
                       overflow-hidden"
            style={{ animation: 'fadeInUp 0.6s ease-out 1050ms both' }}
          >
            <CardHeader className="pb-3 px-4 pt-4 border-b border-gray-100/50 bg-gradient-to-r from-white to-gray-50/30">
              <CardTitle className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                Recent Follow-Up Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {lastFollowUpActivity?.map((activity: any, index: number) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 border border-gray-100 last:border-0 
                               hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent 
                               rounded-lg transition-all duration-200 hover:shadow-sm hover:border-purple-200/50
                               cursor-pointer group/item"
                    style={{ animation: `slideInRight 0.4s ease-out ${1100 + index * 50}ms both` }}
                  >
                    <div className="p-1.5 rounded-lg bg-purple-100/50 group-hover/item:bg-purple-200/50 transition-colors">
                      <MessageSquare className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-900 truncate leading-relaxed group-hover/item:text-purple-700 transition-colors mb-1">
                        {activity.last_follow_up_remark || 'No remark'}
                      </p>
                      <span className="text-xs text-gray-500 group-hover/item:text-gray-600 transition-colors">
                        {new Date(activity.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;