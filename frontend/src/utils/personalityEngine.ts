export interface DayPerformance {
  completedCount: number;
  totalCount: number;
  isAheadOfSchedule: boolean;
  averageDaily: number;
  challengingDay: boolean;
}

export interface WorkProgress {
  completedToday: number;
  totalToday: number;
  timeRemaining: number; // hours
  isOnTrack: boolean;
}

export type WorkSituation =
  | 'allCarsCompleted'
  | 'multipleOilChanges'
  | 'complexRepairDone'
  | 'fastDay'
  | 'quietDay';

export interface CompletionMessage {
  message: string;
  tone:
    | 'positive'
    | 'energetic'
    | 'confident'
    | 'accomplished'
    | 'skilled'
    | 'amazed'
    | 'proud'
    | 'triumphant';
  customerNote?: string;
  shouldShowConfetti: boolean;
  soundEffect?: string;
}

export class PersonalityEngine {
  static getGreeting(timeOfHour: number, name: string, performance: DayPerformance): string {
    const greetings = {
      morning: [
        `Good morning, ${name}! Ready to tackle another day?`,
        `Morning, ${name}! Your workshop awaits 🔧`,
        `Rise and shine, ${name}! Time to work some magic`,
      ],
      afternoon: [
        `Afternoon, ${name}! Hope your day's going smoothly`,
        `Hey ${name}, how's the day treating you?`,
        `Good afternoon, ${name}! Still going strong?`,
      ],
      evening: [
        `Evening, ${name}! Winding down for the day?`,
        `Hey ${name}, almost time to wrap up!`,
        `Good evening, ${name}! Final stretch time`,
      ],
    } as const;

    const timeKey = timeOfHour < 12 ? 'morning' : timeOfHour < 17 ? 'afternoon' : 'evening';
    const baseList = greetings[timeKey];
    const baseGreeting = baseList[Math.floor(Math.random() * baseList.length)];

    if (performance.isAheadOfSchedule) {
      return `${baseGreeting} You're ahead of schedule today! 🚀`;
    } else if (performance.completedCount >= performance.averageDaily) {
      return `${baseGreeting} You're having a solid day! 💪`;
    } else if (performance.challengingDay) {
      return `${baseGreeting} Tough day, but you've got this! 🎯`;
    }

    return baseGreeting;
  }

  static getCompletionCelebration(
    jobType: string,
    customerName: string,
    difficulty: 'simple' | 'moderate' | 'complex'
  ): CompletionMessage {
    const celebrations = {
      simple: [
        { message: 'Nice work! Another satisfied customer 😊', tone: 'positive' },
        { message: 'Smooth job! Keep the momentum going 🔄', tone: 'energetic' },
        { message: 'Well done! That looked effortless 👌', tone: 'confident' },
      ],
      moderate: [
        { message: 'Solid work on that one! 💪', tone: 'accomplished' },
        { message: 'Great job handling the complexity! 🎯', tone: 'skilled' },
        { message: "Another successful repair! You're on fire 🔥", tone: 'energetic' },
      ],
      complex: [
        { message: 'Wow! That was impressive work 🌟', tone: 'amazed' },
        { message: 'Master craftsman at work! Excellent job 🏆', tone: 'proud' },
        { message: 'That was challenging - you nailed it! 🎯', tone: 'triumphant' },
      ],
    } as const;

    const list = celebrations[difficulty] || celebrations.moderate;
    const celebration = list[Math.floor(Math.random() * list.length)];

    return {
      ...celebration,
      customerNote: this.getCustomerSpecificNote(customerName, jobType),
      shouldShowConfetti: difficulty === 'complex',
      soundEffect: this.getSoundEffect(difficulty),
    };
  }

  static getProgressEncouragement(progress: WorkProgress): string {
    const { completedToday, totalToday, timeRemaining, isOnTrack } = progress;

    if (completedToday === 0 && timeRemaining > 6) {
      return "Fresh start! Let's make today count 🌅";
    }

    if (isOnTrack && completedToday >= totalToday * 0.7) {
      return "You're crushing it today! Almost there 🏁";
    }

    if (!isOnTrack && timeRemaining > 2) {
      return 'Focus time - you can still turn this day around! 💪';
    }

    if (completedToday === totalToday && totalToday > 0) {
      return 'Perfect day! All jobs completed 🎉';
    }

    const remaining = totalToday - completedToday;
    if (remaining === 1) {
      return 'One more to go! Finish strong 🎯';
    }

    return `${Math.max(remaining, 0)} jobs left - you've got momentum! 🔄`;
  }

  static getContextualHumor(situation: WorkSituation): string | null {
    const humorMap: Record<WorkSituation, string> = {
      allCarsCompleted: 'All done! Time to put your feet up... just kidding, more cars tomorrow! 😄',
      multipleOilChanges: "Oil change day! You're like a pit crew champion 🏎️",
      complexRepairDone: 'That fix was trickier than a stuck lug nut, but you got it! 🔧',
      fastDay: 'Speedy Gonzales has nothing on you today! 💨',
      quietDay: 'Peaceful day at the shop - perfect for catching up and planning 🧘',
    };

    return humorMap[situation] || null;
  }

  private static getCustomerSpecificNote(customerName: string, jobType: string): string | undefined {
    if (!customerName && !jobType) return undefined;
    if (customerName && jobType) return `${customerName} will be thrilled about the ${jobType.toLowerCase()}.`;
    if (customerName) return `${customerName} will appreciate the quick turnaround.`;
    return undefined;
  }

  private static getSoundEffect(
    difficulty: 'simple' | 'moderate' | 'complex'
  ): string {
    switch (difficulty) {
      case 'simple':
        return 'success_gentle';
      case 'complex':
        return 'success_epic';
      default:
        return 'success_moderate';
    }
  }
}
