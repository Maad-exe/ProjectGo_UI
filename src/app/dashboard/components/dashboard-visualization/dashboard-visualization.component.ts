import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { UserService } from '../../../services/user.service';
import { GroupService } from '../../../services/group.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { PanelService } from '../../../services/panel.service';
import { forkJoin, of } from 'rxjs';
import { delay } from 'rxjs/operators';

// Register all Chart.js components
Chart.register(...registerables);

interface DashboardMetrics {
  userCounts: {
    students: number;
    teachers: number;
    admins: number;
    total: number;
  };
  groupMetrics: {
    totalGroups: number;
    pendingGroups: number;
    approvedGroups: number;
    rejectedGroups: number;
  };
  evaluationMetrics: {
    upcomingEvents: number;
    completedEvents: number;
    totalEvents: number;
    averageScore: number;
  };
  panelMetrics: {
    totalPanels: number;
    teachersInPanels: number;
    averageTeachersPerPanel: number;
  };
  monthlySignups: {
    labels: string[];
    students: number[];
    teachers: number[];
  };
  performanceData: {
    labels: string[];
    averageScores: number[];
  };
}

@Component({
  selector: 'app-dashboard-visualization',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-visualization.component.html',
  styleUrls: ['./dashboard-visualization.component.scss']
})
export class DashboardVisualizationComponent implements OnInit, AfterViewInit {
  @ViewChild('userDistributionChart') userDistributionChartRef!: ElementRef;
  @ViewChild('monthlySignupsChart') monthlySignupsChartRef!: ElementRef;
  @ViewChild('groupStatusChart') groupStatusChartRef!: ElementRef;
  @ViewChild('evaluationPerformanceChart') evaluationPerformanceChartRef!: ElementRef;

  isLoading = true;
  metrics: DashboardMetrics = {
    userCounts: { students: 0, teachers: 0, admins: 0, total: 0 },
    groupMetrics: { totalGroups: 0, pendingGroups: 0, approvedGroups: 0, rejectedGroups: 0 },
    evaluationMetrics: { upcomingEvents: 0, completedEvents: 0, totalEvents: 0, averageScore: 0 },
    panelMetrics: { totalPanels: 0, teachersInPanels: 0, averageTeachersPerPanel: 0 },
    monthlySignups: { labels: [], students: [], teachers: [] },
    performanceData: { labels: [], averageScores: [] }
  };

  // Define chart objects
  userDistributionChart!: Chart;
  monthlySignupsChart!: Chart;
  groupStatusChart!: Chart;
  evaluationPerformanceChart!: Chart;

  constructor(
    private userService: UserService,
    private groupService: GroupService,
    private evaluationService: EvaluationService,
    private panelService: PanelService
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // We'll initialize charts after data is loaded and view is initialized
  }

  loadDashboardData(): void {
    // Load data from services in parallel
    forkJoin({
      users: this.userService.getAllUsers(),
      groups: this.groupService.getAllGroups(),
      evaluations: this.evaluationService.getAllEvaluations(),
      panels: this.panelService.getAllPanels(),
      monthlyStats: this.userService.getMonthlySignups(),
      performance: this.evaluationService.getPerformanceData()
    }).subscribe({
      next: (data) => {
        // Process user data
        this.metrics.userCounts.students = data.users.filter(u => u.role === 'Student').length;
        this.metrics.userCounts.teachers = data.users.filter(u => u.role === 'Teacher').length;
        this.metrics.userCounts.admins = data.users.filter(u => u.role === 'Admin').length;
        this.metrics.userCounts.total = data.users.length;

        // Process group data
        this.metrics.groupMetrics.totalGroups = data.groups.length;
        this.metrics.groupMetrics.pendingGroups = data.groups.filter((g: any) => g.supervisionStatus === 'Pending').length;
        this.metrics.groupMetrics.approvedGroups = data.groups.filter((g: any) => g.supervisionStatus === 'Approved').length;
        this.metrics.groupMetrics.rejectedGroups = data.groups.filter((g: any) => g.supervisionStatus === 'Rejected').length;

        // Process evaluation data
        const now = new Date();
        this.metrics.evaluationMetrics.totalEvents = data.evaluations.length;
        this.metrics.evaluationMetrics.completedEvents = data.evaluations.filter(e => new Date(e.date) < now).length;
        this.metrics.evaluationMetrics.upcomingEvents = data.evaluations.filter(e => new Date(e.date) >= now).length;
        
        const completedEvals = data.evaluations.filter((e: any) => e.isCompleted);
        if (completedEvals.length > 0) {
          const totalScore = completedEvals.reduce((sum: number, evaluation: any) => sum + evaluation.averageScore, 0);
          this.metrics.evaluationMetrics.averageScore = totalScore / completedEvals.length;
        }

        // Process panel data
        this.metrics.panelMetrics.totalPanels = data.panels.length;
        const totalTeachers = data.panels.reduce((sum, panel) => sum + panel.members.length, 0);
        this.metrics.panelMetrics.teachersInPanels = totalTeachers;
        this.metrics.panelMetrics.averageTeachersPerPanel = data.panels.length ? 
          totalTeachers / data.panels.length : 0;

        // Process monthly signups
        this.metrics.monthlySignups = data.monthlyStats;

        // Process performance data
        this.metrics.performanceData = data.performance;

        this.isLoading = false;
        
        // Initialize charts now that we have data
        setTimeout(() => {
          this.initializeCharts();
        }, 0);
      },
      error: (err) => {
        console.error('Error loading dashboard data:', err);
        this.isLoading = false;
        
        // Initialize with dummy data for demo
        this.initializeWithDummyData();
      }
    });
  }

  initializeWithDummyData(): void {
    // Dummy data for demonstration
    this.metrics = {
      userCounts: { students: 450, teachers: 32, admins: 8, total: 490 },
      groupMetrics: { totalGroups: 85, pendingGroups: 15, approvedGroups: 65, rejectedGroups: 5 },
      evaluationMetrics: { upcomingEvents: 3, completedEvents: 5, totalEvents: 8, averageScore: 82.5 },
      panelMetrics: { totalPanels: 10, teachersInPanels: 28, averageTeachersPerPanel: 2.8 },
      monthlySignups: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        students: [30, 45, 55, 60, 75, 65],
        teachers: [5, 3, 6, 4, 8, 6]
      },
      performanceData: {
        labels: ['Proposal', 'Design', 'Implementation', 'Testing', 'Presentation'],
        averageScores: [78, 82, 75, 89, 91]
      }
    };

    setTimeout(() => {
      this.initializeCharts();
    }, 0);
  }

  initializeCharts(): void {
    this.createUserDistributionChart();
    this.createMonthlySignupsChart();
    this.createGroupStatusChart();
    this.createEvaluationPerformanceChart();
  }

  createUserDistributionChart(): void {
    if (this.userDistributionChart) {
      this.userDistributionChart.destroy();
    }

    const ctx = this.userDistributionChartRef.nativeElement.getContext('2d');
    this.userDistributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Students', 'Teachers', 'Admins'],
        datasets: [{
          data: [
            this.metrics.userCounts.students,
            this.metrics.userCounts.teachers,
            this.metrics.userCounts.admins
          ],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)', // iOS blue
            'rgba(52, 199, 89, 0.8)',  // iOS green
            'rgba(255, 149, 0, 0.8)'   // iOS orange
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(52, 199, 89, 1)',
            'rgba(255, 149, 0, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            }
          },
          title: {
            display: false
          }
        },
        cutout: '70%',
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });
  }

  createMonthlySignupsChart(): void {
    if (this.monthlySignupsChart) {
      this.monthlySignupsChart.destroy();
    }

    const ctx = this.monthlySignupsChartRef.nativeElement.getContext('2d');
    this.monthlySignupsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.metrics.monthlySignups.labels,
        datasets: [
          {
            label: 'Students',
            data: this.metrics.monthlySignups.students,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Teachers',
            data: this.metrics.monthlySignups.teachers,
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            borderColor: 'rgba(52, 199, 89, 1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: 'rgba(52, 199, 89, 1)',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#1f2937',
            bodyColor: '#4b5563',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              labelPointStyle: function(context: any) {
                return {
                  pointStyle: 'circle',
                  rotation: 0
                };
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            }
          }
        }
      }
    });
  }

  createGroupStatusChart(): void {
    if (this.groupStatusChart) {
      this.groupStatusChart.destroy();
    }

    const ctx = this.groupStatusChartRef.nativeElement.getContext('2d');
    this.groupStatusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Pending', 'Approved', 'Rejected'],
        datasets: [{
          label: 'Groups by Status',
          data: [
            this.metrics.groupMetrics.pendingGroups,
            this.metrics.groupMetrics.approvedGroups,
            this.metrics.groupMetrics.rejectedGroups
          ],
          backgroundColor: [
            'rgba(255, 204, 0, 0.8)',  // iOS yellow
            'rgba(52, 199, 89, 0.8)',   // iOS green
            'rgba(255, 69, 58, 0.8)'    // iOS red
          ],
          borderColor: [
            'rgba(255, 204, 0, 1)',
            'rgba(52, 199, 89, 1)',
            'rgba(255, 69, 58, 1)'
          ],
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#1f2937',
            bodyColor: '#4b5563',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            usePointStyle: true
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              precision: 0,
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            }
          }
        }
      }
    });
  }

  createEvaluationPerformanceChart(): void {
    if (this.evaluationPerformanceChart) {
      this.evaluationPerformanceChart.destroy();
    }

    const ctx = this.evaluationPerformanceChartRef.nativeElement.getContext('2d');
    this.evaluationPerformanceChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: this.metrics.performanceData.labels,
        datasets: [{
          label: 'Average Scores',
          data: this.metrics.performanceData.averageScores,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 10
              }
            },
            pointLabels: {
              font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            angleLines: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#1f2937',
            bodyColor: '#4b5563',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context: any) {
                return `Score: ${context.raw}/100`;
              }
            }
          }
        }
      }
    });
  }
}
