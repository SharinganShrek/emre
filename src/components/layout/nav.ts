import {
  LayoutDashboard,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  Target,
  GraduationCap,
  BookA,
  FlaskConical,
  Clapperboard,
  StickyNote,
  BarChart3,
  Settings,
  School,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: "Overview" | "Life" | "Growth" | "System";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, group: "Overview" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, group: "Overview" },
  { label: "Habits", href: "/habits", icon: CheckCircle2, group: "Overview" },
  { label: "Tasks", href: "/tasks", icon: ListTodo, group: "Overview" },
  { label: "Goals", href: "/goals", icon: Target, group: "Growth" },
  { label: "Study", href: "/study", icon: GraduationCap, group: "Growth" },
  { label: "SAT Vocab", href: "/sat-vocab", icon: BookA, group: "Growth" },
  { label: "Research", href: "/research", icon: FlaskConical, group: "Growth" },
  {
    label: "College Counseling",
    href: "/college-counseling",
    icon: School,
    group: "Growth",
  },
  { label: "Movies", href: "/movies", icon: Clapperboard, group: "Life" },
  { label: "Notes", href: "/notes", icon: StickyNote, group: "Life" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, group: "System" },
  { label: "Settings", href: "/settings", icon: Settings, group: "System" },
];

export const NAV_GROUPS: NavItem["group"][] = [
  "Overview",
  "Growth",
  "Life",
  "System",
];
