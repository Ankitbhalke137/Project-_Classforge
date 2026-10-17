/**
 * The shape of each tenant in the demo.
 *
 * The four schools exist to cover states the UI has to handle: a large active
 * school, a small one, a suspended one whose data is still readable, and a
 * brand-new one that is active but completely empty — which is what every
 * EmptyState was designed against.
 */

export interface SchoolProfile {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  /** Short code for admission numbers and employee numbers. */
  code: string;
  grades: string[];
  sections: string[];
  /** Per class. Zero makes a school that has been onboarded but not yet filled. */
  studentsPerClass: number;
  /** Staff to spread across the subjects on offer. */
  teacherCount: number;
  principalName: string;
  principalEmail: string;
}

export const SCHOOL_PROFILES: SchoolProfile[] = [
  {
    id: "sch_greenwood",
    name: "Greenwood High",
    slug: "greenwood",
    status: "ACTIVE",
    code: "GWH",
    grades: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
    sections: ["A", "B"],
    studentsPerClass: 9,
    teacherCount: 14,
    principalName: "Priya Rao",
    principalEmail: "principal@greenwood.edu",
  },
  {
    id: "sch_riverside",
    name: "Riverside Academy",
    slug: "riverside",
    status: "ACTIVE",
    code: "RSA",
    grades: ["Grade 9", "Grade 10"],
    sections: ["A"],
    studentsPerClass: 9,
    teacherCount: 6,
    principalName: "Daniel Osei",
    principalEmail: "principal@riverside.edu",
  },
  {
    id: "sch_northgate",
    name: "Northgate School",
    slug: "northgate",
    status: "SUSPENDED",
    code: "NGT",
    grades: ["Grade 8"],
    sections: ["A"],
    studentsPerClass: 12,
    teacherCount: 3,
    principalName: "Helen Dsouza",
    principalEmail: "principal@northgate.edu",
  },
  {
    id: "sch_lakeside",
    name: "Lakeside Prep",
    slug: "lakeside",
    status: "ACTIVE",
    code: "LKP",
    grades: ["Grade 9"],
    sections: ["A"],
    studentsPerClass: 0,
    teacherCount: 3,
    principalName: "Ruth Achebe",
    principalEmail: "principal@lakeside.edu",
  },
];