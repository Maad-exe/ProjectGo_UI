import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartDataset, ChartData, RadarController, LineController, DoughnutController, CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, ArcElement, Legend, Title, Tooltip } from 'chart.js';
import { AuthService } from '../../../services/auth.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { NotificationService } from '../../../services/notifications.service';
import { EnhancedStudentEvaluationDto, CategoryScoreDetailDto, EvaluatorDto } from '../../../models/evaluation.model';

// Register required Chart.js components
Chart.register(
  RadarController, 
  LineController, 
  DoughnutController,
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  RadialLinearScale, 
  ArcElement, 
  Legend, 
  Title, 
  Tooltip
);

// Extend the interface to include the properties we need
interface ExtendedStudentEvaluationDto extends EnhancedStudentEvaluationDto {
  weightedScore?: number;
  isComplete?: boolean;
  requiredEvaluatorsCount?: number; // Add this property
}

// Interface for feedback item structure
interface FeedbackItem {
  category?: string;
  text: string;
}

// Interface for parsed feedback structure
interface ParsedFeedback {
  teacher: string;
  feedback: string;
  date?: Date;
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss']
})
export class ProgressComponent implements OnInit, AfterViewInit {
  // Add back the ViewChild references for charts
  @ViewChild('radarChart') radarChartRef?: ElementRef;
  @ViewChild('progressChart') progressChartRef?: ElementRef;
  @ViewChild('typeDistributionChart') typeDistributionChartRef?: ElementRef;
  
  isLoading: boolean = false;
  evaluations: ExtendedStudentEvaluationDto[] = [];
  upcomingEvaluations: ExtendedStudentEvaluationDto[] = [];
  completedEvaluations: ExtendedStudentEvaluationDto[] = [];
  error: string | null = null;
  finalGrade: number = 0;
  
  // Charts
  radarChart?: Chart;
  progressChart?: Chart;
  typeDistributionChart?: Chart;
  
  // Add the missing properties
  expandedCards: boolean[] = [];
  
  constructor(
    private authService: AuthService,
    private evaluationService: EvaluationService,
    private notificationService: NotificationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadEvaluations();
    // Initialize all cards as collapsed initially
    this.expandedCards = new Array(10).fill(false);
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded in loadEvaluations
  }

  // Add the missing methods
  toggleCardExpansion(index: number): void {
    this.expandedCards[index] = !this.expandedCards[index];
  }

  getInitials(name: string | undefined): string {
    if (!name || name === 'Feedback') return 'FB';
    
    return name.split(' ')
      .map(part => part.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  // Fix the findMatchingEvaluator method to handle undefined evaluators array
  findMatchingEvaluator(feedback: string, evaluators?: EvaluatorDto[]): EvaluatorDto | null {
    if (!evaluators || !feedback) return null;
    
    // Try to find by score mention in feedback
    const scoreMatch = feedback.match(/(\d+)\s+FROM/i);
    if (scoreMatch && scoreMatch[1]) {
      const score = parseInt(scoreMatch[1]);
      const matchingEvaluator = evaluators.find(e => e.score === score);
      if (matchingEvaluator) return matchingEvaluator;
    }
    
    // Try to find by name mention in feedback
    for (const evaluator of evaluators) {
      if (evaluator.name && feedback.toLowerCase().includes(evaluator.name.toLowerCase())) {
        return evaluator;
      }
    }
    
    return null;
  }

  loadEvaluations(): void {
    this.isLoading = true;
    this.error = null;
    
    console.log('Loading student evaluations...');
    
    this.evaluationService.getEnhancedStudentEvaluations().subscribe({
      next: (data) => {
        console.log('Evaluations received:', data);
        
        // Handle potentially empty response
        if (!data || (Array.isArray(data) && data.length === 0)) {
          this.evaluations = [];
          this.completedEvaluations = [];
          this.upcomingEvaluations = [];
          this.isLoading = false;
          return;
        }
        
        this.evaluations = data as unknown as ExtendedStudentEvaluationDto[];
        
        this.evaluations = this.evaluations.map(evaluation => {
          // Calculate weighted score
          const weightedScore = evaluation.weightedScore || 
            (evaluation.obtainedMarks / (evaluation.totalMarks || 100)) * 100;
          
          const hasScoreData = 
            (evaluation.obtainedMarks !== undefined && evaluation.obtainedMarks !== null) || 
            (weightedScore !== undefined && weightedScore > 0);
          
          const hasCategoryScores = !!evaluation.categoryScores && evaluation.categoryScores.length > 0 && 
            evaluation.categoryScores.some(cs => cs.score > 0);
          
          const isComplete: boolean = hasScoreData || !!hasCategoryScores || false;
          
          // Create a Map to ensure we have unique evaluators
          const uniqueEvaluators = new Map<number, EvaluatorDto>();
          
          // First add any evaluators directly from the backend
          (evaluation.evaluators || []).forEach(evaluator => {
            if (evaluator && evaluator.id) {
              uniqueEvaluators.set(evaluator.id, {
                ...evaluator,
                // Ensure hasEvaluated is a boolean and score is correctly set
                hasEvaluated: !!evaluator.hasEvaluated,
                score: evaluator.score || 0
              });
            }
          });
          
          // For rubric-based evaluations, extract additional evaluator data
          if (evaluation.categoryScores && evaluation.categoryScores.length > 0) {
            evaluation.categoryScores.forEach(category => {
              if (category.evaluatorDetails?.length > 0) {
                category.evaluatorDetails.forEach(evalDetail => {
                  if (evalDetail.evaluatorId && !uniqueEvaluators.has(evalDetail.evaluatorId)) {
                    uniqueEvaluators.set(evalDetail.evaluatorId, {
                      id: evalDetail.evaluatorId,
                      name: evalDetail.evaluatorName || `Evaluator ${evalDetail.evaluatorId}`,
                      hasEvaluated: true,
                      score: evalDetail.score
                    });
                  }
                });
              }
            });
          }
          
          // Extract the unique evaluators into an array
          const processedEvaluators = Array.from(uniqueEvaluators.values());
          
          // Process feedback to remove duplicate teacher names
          let processedFeedback = evaluation.feedback;
          if (processedFeedback) {
            // Split by "Feedback from" sections
            const feedbackSections = processedFeedback.split(/Feedback from\s+/i).filter(Boolean);
            
            if (feedbackSections.length > 1) {
              // Handle multi-evaluator feedback
              processedFeedback = feedbackSections.map((section, index) => {
                if (index === 0 && !section.includes(':')) {
                  return section.trim();  // This is not a section header
                }
                
                // For proper sections, keep the "Feedback from" prefix
                return index === 0 ? section.trim() : `Feedback from ${section.trim()}`;
              }).join('\n\n');
            }
          }
          
          // Process category scores
          const processedCategoryScores = evaluation.categoryScores?.map(category => {
            let feedback = category.feedback || '';
            
            if (feedback.includes('FROM') || feedback.includes('from')) {
              const parts = feedback.split(/FROM|from/);
              if (parts.length > 1) {
                const scoreWithEvaluator = parts.map(part => part.trim()).filter(p => p);
                feedback = scoreWithEvaluator.join(' | ');
              }
            }
            
            return {
              ...category,
              categoryName: category.categoryName || 'Unnamed Category',
              categoryWeight: category.categoryWeight || 0,
              score: category.score || 0,
              maxScore: category.maxScore || 100,
              feedback: feedback,
              evaluatorDetails: category.evaluatorDetails?.map(detail => ({
                ...detail,
                evaluatorName: detail.evaluatorName || 
                              (category.feedback && category.feedback.includes(detail.evaluatorId.toString()) ? 
                               category.feedback.split(detail.evaluatorId.toString())[1]?.trim() : 
                               '')
              })) || []
            };
          }) || [];

          // Calculate obtained marks based on category scores if marks are 0 but categories have scores
          let calculatedMarks = evaluation.obtainedMarks;
          if ((!calculatedMarks || calculatedMarks === 0) && evaluation.categoryScores && evaluation.categoryScores.length > 0) {
            // Calculate weighted average if we have category weights
            const totalWeight = evaluation.categoryScores.reduce((sum, cat) => sum + (cat.categoryWeight || 0), 0);
            if (totalWeight > 0) {
              // Use weighted calculation
              const weightedTotal = evaluation.categoryScores.reduce(
                (sum, cat) => sum + (cat.score / (cat.maxScore || 100)) * (cat.categoryWeight || 0), 
                0
              );
              calculatedMarks = Math.round((weightedTotal / totalWeight) * (evaluation.totalMarks || 100));
            } else if (evaluation.categoryScores.length > 0) {
              // Use simple average
              const avgScore = evaluation.categoryScores.reduce(
                (sum, cat) => sum + (cat.score / (cat.maxScore || 100)), 
                0
              ) / evaluation.categoryScores.length;
              calculatedMarks = Math.round(avgScore * (evaluation.totalMarks || 100));
            }
          }

          // Format event weight to ensure it's a proper percentage
          const eventWeight = typeof evaluation.eventWeight === 'number' ? evaluation.eventWeight : 0;
          
          return {
            ...evaluation,
            isComplete: isComplete,
            obtainedMarks: calculatedMarks || evaluation.obtainedMarks || 0,
            totalMarks: evaluation.totalMarks || 100,
            weightedScore: weightedScore,
            evaluators: processedEvaluators,
            categoryScores: processedCategoryScores,
            eventWeight: eventWeight,
            requiredEvaluatorsCount: evaluation.requiredEvaluatorsCount ?? processedEvaluators.length,
            feedback: processedFeedback
          };
        });
        
        console.log('Processed evaluations:', this.evaluations);
        
        // Ensure the expandedCards array is long enough for all evaluations
        if (this.evaluations.length > this.expandedCards.length) {
          this.expandedCards = [...this.expandedCards, ...new Array(this.evaluations.length - this.expandedCards.length).fill(false)];
        }
        
        this.completedEvaluations = this.evaluations.filter(e => e.isComplete);
        this.upcomingEvaluations = this.evaluations.filter(e => !e.isComplete);
        
        this.loadFinalGrade();
        this.isLoading = false;
        
        // Initialize charts after data is loaded
        setTimeout(() => {
          this.initializeCharts();
        }, 0);
      },
      error: (err: any) => {
        console.error('Failed to load evaluations:', err);
        this.error = 'Failed to load evaluations. Please try again later.';
        this.isLoading = false;
        this.evaluations = [];
        this.completedEvaluations = [];
        this.upcomingEvaluations = [];
        this.notificationService.showError('Failed to load your evaluations. You may not have any evaluations yet.');
      }
    });
  }
  
  loadFinalGrade(): void {
    this.evaluationService.getFinalGrade().subscribe({
      next: (grade: number) => {
        console.log('Final grade received:', grade);
        this.finalGrade = grade;
      },
      error: (err: any) => {
        console.error('Failed to load final grade:', err);
      }
    });
  }
  
  // Add back the chart initialization methods
  initializeCharts(): void {
    console.log('Initializing charts...');
    console.log('Radar chart ref:', this.radarChartRef);
    console.log('Progress chart ref:', this.progressChartRef);
    console.log('Distribution chart ref:', this.typeDistributionChartRef);
    
    this.ngZone.runOutsideAngular(() => {
      // Add small delay to ensure DOM is ready
      setTimeout(() => {
        this.renderRadarChart();
        this.renderProgressChart();
        this.renderTypeDistributionChart();
        
        // Force Angular to detect changes
        this.ngZone.run(() => {
          console.log('Charts initialized');
        });
      }, 100);
    });
  }
  
  renderRadarChart(): void {
    console.log('Rendering radar chart...');
    if (!this.radarChartRef) {
      console.error('Radar chart reference is undefined');
      return;
    }
    if (this.completedEvaluations.length === 0) {
      console.warn('No completed evaluations for radar chart');
      return;
    }
    
    // Get all unique categories across evaluations
    const allCategories = new Set<string>();
    const categoryScores: {[key: string]: {total: number, count: number}} = {};
    
    this.completedEvaluations.forEach(evaluation => {
      if (evaluation.categoryScores) {
        evaluation.categoryScores.forEach(category => {
          allCategories.add(category.categoryName);
          
          if (!categoryScores[category.categoryName]) {
            categoryScores[category.categoryName] = { total: 0, count: 0 };
          }
          
          const percentageScore = (category.score / category.maxScore) * 100;
          categoryScores[category.categoryName].total += percentageScore;
          categoryScores[category.categoryName].count += 1;
        });
      }
    });
    
    const labels = Array.from(allCategories);
    const data = labels.map(category => 
      categoryScores[category].count > 0 
        ? categoryScores[category].total / categoryScores[category].count 
        : 0
    );
    
    // Create radar chart
    if (this.radarChart) {
      this.radarChart.destroy();
    }
    
    this.radarChart = new Chart(this.radarChartRef.nativeElement, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Average Performance by Category (%)',
          data: data,
          backgroundColor: 'rgba(33, 150, 243, 0.2)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(33, 150, 243, 1)',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            pointLabels: {
              font: {
                size: 12
              }
            },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: {
              stepSize: 20
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Performance by Category',
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.formattedValue}%`;
              }
            }
          }
        }
      }
    });
  }
  
  renderProgressChart(): void {
    console.log('Rendering progress chart...');
    if (!this.progressChartRef) {
      console.error('Progress chart reference is undefined');
      return;
    }
    if (this.completedEvaluations.length === 0) {
      console.warn('No completed evaluations for progress chart');
      return;
    }
    
    // Sort evaluations by date
    const sortedEvaluations = [...this.completedEvaluations]
      .sort((a, b) => {
        const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
        const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
        return dateA - dateB;
      });
    
    // Prepare data for chart
    const labels = sortedEvaluations.map(e => {
      const date = e.eventDate ? new Date(e.eventDate) : new Date();
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const data = sortedEvaluations.map(e => 
      (e.obtainedMarks / (e.totalMarks || 100)) * 100
    );
    
    // Calculate rolling average (if we have enough data points)
    let rollingAvgData: number[] = [];
    if (data.length >= 3) {
      const windowSize = 3;
      for (let i = 0; i <= data.length - windowSize; i++) {
        const windowData = data.slice(i, i + windowSize);
        const avg = windowData.reduce((sum, value) => sum + value, 0) / windowSize;
        rollingAvgData.push(avg);
      }
      
      // Pad beginning with nulls for proper alignment
      rollingAvgData = Array(windowSize - 1).fill(null).concat(rollingAvgData);
    }
    
    // Create progress chart
    if (this.progressChart) {
      this.progressChart.destroy();
    }
    
    const datasets: ChartDataset<'line'>[] = [
      {
        label: 'Score (%)',
        data: data,
        borderColor: 'rgba(33, 150, 243, 1)',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(33, 150, 243, 1)'
      }
    ];
    
    if (rollingAvgData.length > 0) {
      datasets.push({
        label: '3-Evaluation Rolling Average',
        data: rollingAvgData,
        borderColor: 'rgba(76, 175, 80, 1)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3,
        pointRadius: 0
      });
    }
    
    this.progressChart = new Chart(this.progressChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Score (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Evaluation Date'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Performance Progress Over Time',
            font: {
              size: 16
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.formattedValue}%`;
              }
            }
          }
        }
      }
    });
  }
  
  renderTypeDistributionChart(): void {
    console.log('Rendering distribution chart...');
    if (!this.typeDistributionChartRef) {
      console.error('Type distribution chart reference is undefined');
      return;
    }
    if (this.evaluations.length === 0) {
      console.warn('No evaluations for type distribution chart');
      return;
    }
    
    // Count occurrences of each event type
    const eventTypes = new Map<string, number>();
    this.evaluations.forEach(evaluation => {
      const type = evaluation.eventType || 'Standard';
      eventTypes.set(type, (eventTypes.get(type) || 0) + 1);
    });
    
    // Prepare data for chart
    const labels = Array.from(eventTypes.keys());
    const data = Array.from(eventTypes.values());
    
    // Custom colors for the chart
    const backgroundColors = [
      'rgba(33, 150, 243, 0.8)',
      'rgba(76, 175, 80, 0.8)',
      'rgba(255, 152, 0, 0.8)',
      'rgba(244, 67, 54, 0.8)',
      'rgba(156, 39, 176, 0.8)',
      'rgba(0, 188, 212, 0.8)'
    ];
    
    // Create doughnut chart
    if (this.typeDistributionChart) {
      this.typeDistributionChart.destroy();
    }
    
    this.typeDistributionChart = new Chart(this.typeDistributionChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Evaluation Types',
          data: data,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Distribution by Evaluation Type',
            font: {
              size: 16
            }
          },
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.formattedValue;
                const data = context.chart.data.datasets[0].data;
                
                // Fix the reduce function with proper typing
                const total = data.reduce((sum: number, val: any) => {
                  // Handle non-number values
                  return sum + (typeof val === 'number' ? val : 0);
                }, 0);
                
                // Handle potentially null values
                const percentage = total ? Math.round((context.parsed / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  getGradeColor(score: number): string {
    if (!score && score !== 0) return 'average';
    
    const percentage = typeof score === 'number' ? score : 0;
    
    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 55) return 'average';
    return 'needs-improvement';
  }
  
  getProgressBarWidth(percentage: number): string {
    return `${Math.min(Math.max(percentage, 0), 100)}%`;
  }
  
  calculatePercentage(score: number, total: number): number {
    if (!total) return 0;
    return (score / total) * 100;
  }
  
  hasEvaluationDetails(evaluation: ExtendedStudentEvaluationDto): boolean {
    const hasMarks: boolean = !!evaluation.obtainedMarks && evaluation.obtainedMarks > 0;
    const hasCategories: boolean = !!evaluation.categoryScores && evaluation.categoryScores.length > 0;
    const hasFeedback: boolean = !!evaluation.feedback && evaluation.feedback.trim() !== '';
    
    return hasMarks || hasCategories || hasFeedback;
  }
  
  getEvaluatorStatus(evaluator: EvaluatorDto): string {
    return evaluator?.hasEvaluated ? 'Completed' : 'Pending';
  }
  
  getPanelCompletionPercentage(evaluation: ExtendedStudentEvaluationDto): number {
    if (!evaluation.evaluators || evaluation.evaluators.length === 0) return 0;
    
    // Get the required evaluator count (or use the actual count if not specified)
    const requiredCount = evaluation.requiredEvaluatorsCount ?? evaluation.evaluators.length;
    const completedCount = evaluation.evaluators.filter(e => e?.hasEvaluated).length;

    // Calculate percentage based on completed vs required
    return (completedCount / requiredCount) * 100;
  }

  areAllEvaluationsCompleted(evaluation: ExtendedStudentEvaluationDto): boolean {
    if (!evaluation.evaluators || evaluation.evaluators.length === 0) return false;
    
    // Get the required evaluator count (or use the actual count if not specified)
    const requiredCount = evaluation.requiredEvaluatorsCount ?? evaluation.evaluators.length;
    const completedCount = evaluation.evaluators.filter(e => e?.hasEvaluated).length;
    
    return completedCount >= requiredCount;
  }

  getCategoryAverageScore(): number {
    if (this.completedEvaluations.length === 0) return 0;
    
    let totalCategoryScore = 0;
    let totalCategories = 0;
    
    this.completedEvaluations.forEach(evaluation => {
      if (evaluation.categoryScores && evaluation.categoryScores.length > 0) {
        evaluation.categoryScores.forEach(category => {
          totalCategoryScore += (category.score / category.maxScore) * 100;
          totalCategories++;
        });
      }
    });
    
    return totalCategories > 0 ? totalCategoryScore / totalCategories : 0;
  }

  getTopPerformingCategory(): {name: string, score: number} {
    if (this.completedEvaluations.length === 0) {
      return {name: 'N/A', score: 0};
    }
    
    const categoryScores: {[key: string]: {total: number, count: number}} = {};
    
    this.completedEvaluations.forEach(evaluation => {
      if (evaluation.categoryScores) {
        evaluation.categoryScores.forEach(category => {
          if (!categoryScores[category.categoryName]) {
            categoryScores[category.categoryName] = { total: 0, count: 0 };
          }
          
          const percentageScore = (category.score / category.maxScore) * 100;
          categoryScores[category.categoryName].total += percentageScore;
          categoryScores[category.categoryName].count += 1;
        });
      }
    });
    
    let topCategory = {name: 'N/A', score: 0};
    
    Object.entries(categoryScores).forEach(([name, data]) => {
      const avgScore = data.count > 0 ? data.total / data.count : 0;
      if (avgScore > topCategory.score) {
        topCategory = {name, score: avgScore};
      }
    });
    
    return topCategory;
  }

  // Updated parseFeedback method 
  parseFeedback(feedbackString: string): ParsedFeedback[] {
    if (!feedbackString) return [];
    
    // Split by "Feedback from" but keep the prefix
    const sections = feedbackString.split(/(?=Feedback from)/i).filter(Boolean);
    const results: ParsedFeedback[] = [];

    // Keep track of matched evaluators to handle potential duplicates
    const processedTeachers = new Set<string>();
    
    for (const section of sections) {
      // Try to match "Feedback from X:" pattern
      const match = section.match(/Feedback from\s+([^:]+):(.*)/is);
      
      if (match) {
        const teacherName = match[1].trim();
        const feedbackText = match[2].trim();
        
        // Skip duplicates (sometimes feedback gets compiled with duplicates)
        if (!processedTeachers.has(teacherName.toLowerCase())) {
          processedTeachers.add(teacherName.toLowerCase());
          results.push({
            teacher: teacherName,
            feedback: feedbackText
          });
        }
      } else {
        // Try to extract teacher name from the feedback content
        const fromMatch = section.match(/[-\s]+(FROM|from|From)\s+([A-Za-z\s\.]+)/);
        
        if (fromMatch && fromMatch[2]) {
          const extractedName = fromMatch[2].trim();
          const cleanedFeedback = section.replace(/[-\s]+(FROM|from|From)\s+[A-Za-z\s\.]+/, '').trim();
          
          if (!processedTeachers.has(extractedName.toLowerCase())) {
            processedTeachers.add(extractedName.toLowerCase());
            results.push({
              teacher: extractedName,
              feedback: cleanedFeedback
            });
          }
        } else {
          // If no clear teacher name can be found, check if we can find a name in the evaluators list
          if (this.evaluations && this.evaluations.length > 0) {
            let foundTeacher = false;
            
            for (const evaluation of this.evaluations) {
              if (evaluation.evaluators && evaluation.evaluators.length > 0) {
                for (const evaluator of evaluation.evaluators) {
                  if (evaluator && evaluator.name && 
                      section.toLowerCase().includes(evaluator.name.toLowerCase())) {
                    if (!processedTeachers.has(evaluator.name.toLowerCase())) {
                      processedTeachers.add(evaluator.name.toLowerCase());
                      results.push({
                        teacher: evaluator.name,
                        feedback: section
                      });
                      foundTeacher = true;
                      break;
                    }
                  }
                }
                if (foundTeacher) break;
              }
            }
            
            // If we still couldn't identify the teacher, use the general label
            if (!foundTeacher) {
              results.push({
                teacher: 'Feedback',
                feedback: section.trim()
              });
            }
          } else {
            // Fallback if no evaluations data is available
            results.push({
              teacher: 'Feedback',
              feedback: section.trim()
            });
          }
        }
      }
    }
    
    return results;
  }
}
