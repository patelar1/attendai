import crypto from 'crypto';
import {
  StaffUser,
  Course,
  Branch,
  Student,
  AttendanceRecord,
  AbsentFollowup,
  AuditLogEntry,
  SchedulerConfig,
  PastDateApprovalRequest,
} from '../src/types.ts';

const PASSWORD_SALT = 'attend_ai_secure_salt_v1';

export function hashPassword(plain: string): string {
  return crypto.scryptSync(plain, PASSWORD_SALT, 64).toString('hex');
}

export function verifyPassword(plain: string, hashed: string): boolean {
  const candidate = hashPassword(plain);
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hashed, 'hex'));
}

export interface ServerUserRecord extends StaffUser {
  passwordHash: string;
}

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course-btech',
    code: 'B.Tech',
    name: 'Bachelor of Technology',
    durationYears: 4,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'course-bca',
    code: 'BCA',
    name: 'Bachelor of Computer Applications',
    durationYears: 3,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'course-mca',
    code: 'MCA',
    name: 'Master of Computer Applications',
    durationYears: 2,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'course-mba',
    code: 'MBA',
    name: 'Master of Business Administration',
    durationYears: 2,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'course-bcom',
    code: 'B.Com',
    name: 'Bachelor of Commerce (Hons)',
    durationYears: 3,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
];

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch-cse',
    courseId: 'course-btech',
    code: 'CSE',
    name: 'Computer Science & Engineering',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-csd',
    courseId: 'course-btech',
    code: 'CSD',
    name: 'Computer Science & Design',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-it',
    courseId: 'course-btech',
    code: 'IT',
    name: 'Information Technology',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-ec',
    courseId: 'course-btech',
    code: 'EC',
    name: 'Electronics & Communication',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-me',
    courseId: 'course-btech',
    code: 'ME',
    name: 'Mechanical Engineering',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-bca-ds',
    courseId: 'course-bca',
    code: 'BCA-DS',
    name: 'BCA Data Science & AI',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-mca-se',
    courseId: 'course-mca',
    code: 'MCA-SE',
    name: 'MCA Software Systems',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-mba-fin',
    courseId: 'course-mba',
    code: 'MBA-FIN',
    name: 'MBA Finance & Strategy',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'branch-bcom-h',
    courseId: 'course-bcom',
    code: 'BCOM-H',
    name: 'B.Com Corporate Accounting',
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
];

export const INITIAL_USERS: ServerUserRecord[] = [
  // 1. ADMIN
  {
    id: 'usr-admin-1',
    userId: 'ADM-001',
    role: 'admin',
    allowedRoles: ['admin'],
    name: 'Dr. Rajeshwar Sharma',
    email: 'admin@attendai.edu.in',
    mobile: '+91 98110 11220',
    active: true,
    mustChangePassword: false,
    departments: ['CSE', 'CSD', 'IT', 'EC', 'ME', 'BCA-DS', 'MCA-SE', 'MBA-FIN', 'BCOM-H'],
    assignedCourses: ['course-btech', 'course-bca', 'course-mca', 'course-mba', 'course-bcom'],
    assignments: [],
    passwordHash: hashPassword('Admin@123'),
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
  },
  // 2. HOD 1 - CSE, CSD, IT, BCA, MCA
  {
    id: 'usr-hod-1',
    userId: 'HOD-CSE-01',
    role: 'hod',
    allowedRoles: ['hod', 'teacher'],
    name: 'Dr. Vikramaditya Verma',
    email: 'vikram.hod@attendai.edu.in',
    mobile: '+91 98220 33441',
    active: true,
    mustChangePassword: false,
    departments: ['CSE', 'CSD', 'IT', 'BCA-DS', 'MCA-SE'],
    assignedCourses: ['course-btech', 'course-bca', 'course-mca'],
    assignments: [
      { courseId: 'course-btech', branchId: 'branch-cse', year: 1 },
      { courseId: 'course-btech', branchId: 'branch-cse', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-cse', year: 3 },
      { courseId: 'course-btech', branchId: 'branch-cse', year: 4 },
      { courseId: 'course-btech', branchId: 'branch-csd', year: 1 },
      { courseId: 'course-btech', branchId: 'branch-csd', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-csd', year: 3 },
      { courseId: 'course-btech', branchId: 'branch-it', year: 1 },
      { courseId: 'course-btech', branchId: 'branch-it', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-it', year: 3 },
      { courseId: 'course-bca', branchId: 'branch-bca-ds', year: 1 },
      { courseId: 'course-bca', branchId: 'branch-bca-ds', year: 2 },
      { courseId: 'course-mca', branchId: 'branch-mca-se', year: 1 },
    ],
    passwordHash: hashPassword('Hod@123'),
    createdAt: '2026-07-02T09:00:00.000Z',
    updatedAt: '2026-07-02T09:00:00.000Z',
  },
  // 3. HOD 2 - EC, ME, MBA, B.Com
  {
    id: 'usr-hod-2',
    userId: 'HOD-CORE-02',
    role: 'hod',
    allowedRoles: ['hod'],
    name: 'Dr. Meenakshi Nair',
    email: 'meenakshi.hod@attendai.edu.in',
    mobile: '+91 98230 44552',
    active: true,
    mustChangePassword: false,
    departments: ['EC', 'ME', 'MBA-FIN', 'BCOM-H'],
    assignedCourses: ['course-btech', 'course-mba', 'course-bcom'],
    assignments: [
      { courseId: 'course-btech', branchId: 'branch-ec', year: 1 },
      { courseId: 'course-btech', branchId: 'branch-ec', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-ec', year: 3 },
      { courseId: 'course-btech', branchId: 'branch-me', year: 1 },
      { courseId: 'course-btech', branchId: 'branch-me', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-me', year: 3 },
      { courseId: 'course-mba', branchId: 'branch-mba-fin', year: 1 },
      { courseId: 'course-bcom', branchId: 'branch-bcom-h', year: 1 },
    ],
    passwordHash: hashPassword('Hod@123'),
    createdAt: '2026-07-02T10:00:00.000Z',
    updatedAt: '2026-07-02T10:00:00.000Z',
  },
  // 4. TEACHER 1 - CSE (Yr 2, 3) & CSD (Yr 2)
  {
    id: 'usr-tch-1',
    userId: 'TCH-CSE-01',
    role: 'teacher',
    allowedRoles: ['teacher'],
    name: 'Prof. Ananya Deshmukh',
    email: 'ananya.t@attendai.edu.in',
    mobile: '+91 98450 66771',
    active: true,
    mustChangePassword: false,
    departments: ['CSE', 'CSD'],
    assignedCourses: ['course-btech'],
    assignments: [
      { courseId: 'course-btech', branchId: 'branch-cse', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-cse', year: 3 },
      { courseId: 'course-btech', branchId: 'branch-csd', year: 2 },
    ],
    passwordHash: hashPassword('Teacher@123'),
    createdAt: '2026-07-05T09:00:00.000Z',
    updatedAt: '2026-07-05T09:00:00.000Z',
  },
  // 5. TEACHER 2 - IT (Yr 2) & BCA-DS (Yr 1) & MCA-SE (Yr 1)
  {
    id: 'usr-tch-2',
    userId: 'TCH-IT-02',
    role: 'teacher',
    allowedRoles: ['teacher'],
    name: 'Prof. Saurabh Kulkarni',
    email: 'saurabh.t@attendai.edu.in',
    mobile: '+91 98451 77882',
    active: true,
    mustChangePassword: false,
    departments: ['IT', 'BCA-DS', 'MCA-SE'],
    assignedCourses: ['course-btech', 'course-bca', 'course-mca'],
    assignments: [
      { courseId: 'course-btech', branchId: 'branch-it', year: 2 },
      { courseId: 'course-bca', branchId: 'branch-bca-ds', year: 1 },
      { courseId: 'course-mca', branchId: 'branch-mca-se', year: 1 },
    ],
    passwordHash: hashPassword('Teacher@123'),
    createdAt: '2026-07-05T10:00:00.000Z',
    updatedAt: '2026-07-05T10:00:00.000Z',
  },
  // 6. TEACHER 3 - EC (Yr 2) & ME (Yr 2)
  {
    id: 'usr-tch-3',
    userId: 'TCH-EC-03',
    role: 'teacher',
    allowedRoles: ['teacher'],
    name: 'Prof. Priya Raghavan',
    email: 'priya.t@attendai.edu.in',
    mobile: '+91 98452 88993',
    active: true,
    mustChangePassword: false,
    departments: ['EC', 'ME'],
    assignedCourses: ['course-btech'],
    assignments: [
      { courseId: 'course-btech', branchId: 'branch-ec', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-me', year: 2 },
    ],
    passwordHash: hashPassword('Teacher@123'),
    createdAt: '2026-07-05T11:00:00.000Z',
    updatedAt: '2026-07-05T11:00:00.000Z',
  },
  // 7. Google Account registered by Admin for live Google Sign-in testing
  {
    id: 'usr-google-owner',
    userId: 'HOD-GOOGLE-01',
    role: 'hod',
    allowedRoles: ['hod', 'teacher'],
    name: 'Prof. Chandra Prakash Chauhan',
    email: 'chandraprakashchauhan157@gmail.com',
    mobile: '+91 98111 22334',
    active: true,
    mustChangePassword: false,
    departments: ['CSE', 'CSD', 'IT', 'EC', 'ME'],
    assignedCourses: ['course-btech', 'course-bca', 'course-mca'],
    assignments: [
      { courseId: 'course-btech', branchId: 'branch-cse', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-cse', year: 3 },
      { courseId: 'course-btech', branchId: 'branch-csd', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-it', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-ec', year: 2 },
      { courseId: 'course-btech', branchId: 'branch-me', year: 2 },
      { courseId: 'course-bca', branchId: 'branch-bca-ds', year: 1 },
      { courseId: 'course-mca', branchId: 'branch-mca-se', year: 1 },
    ],
    passwordHash: hashPassword('Hod@123'),
    createdAt: '2026-07-06T09:00:00.000Z',
    updatedAt: '2026-07-06T09:00:00.000Z',
  },
];

// Generate 64 realistic Indian college students across branches
interface RawStudentSeed {
  courseId: string;
  branchId: string;
  year: number;
  rollPrefix: string;
  names: string[];
}

const STUDENT_GROUPS: RawStudentSeed[] = [
  {
    courseId: 'course-btech',
    branchId: 'branch-cse',
    year: 2,
    rollPrefix: '0187CS2410',
    names: [
      'Aarav Sharma',
      'Vivaan Patel',
      'Aditya Verma',
      'Vihaan Gupta',
      'Arjun Nair',
      'Sai Krishna',
      'Reyansh Joshi',
      'Ayaan Khan',
      'Krishna Iyer',
      'Ishaan Malhotra',
      'Ananya Reddy',
      'Diya Chatterjee',
      'Saanvi Kulkarni',
      'Myra Deshmukh',
      'Aadhya मिश्रा (Mishra)',
      'Kavya Tiwari',
      'Riya Chauhan',
      'Neha Rathore',
    ],
  },
  {
    courseId: 'course-btech',
    branchId: 'branch-cse',
    year: 3,
    rollPrefix: '0187CS2310',
    names: [
      'Rohan Bhatia',
      'Karthik Subramanian',
      'Pranav Saxena',
      'Harshvardhan Singh',
      'Siddharth Menon',
      'Pooja Agarwal',
      'Shruti Pandey',
      'Tanvi Bhardwaj',
      'Meera Sengupta',
      'Nisha Dubey',
    ],
  },
  {
    courseId: 'course-btech',
    branchId: 'branch-csd',
    year: 2,
    rollPrefix: '0187CD2410',
    names: [
      'Devansh Tripathi',
      'Atharv Oak',
      'Kabir Bansal',
      'Yashwardhan Chauhan',
      'AryanShekhar Joshi',
      'Tanya Kapoor',
      'Simran Kaur',
      'Sneha Gokhale',
      'Avani Chawla',
      'Prachi Srivastava',
    ],
  },
  {
    courseId: 'course-btech',
    branchId: 'branch-it',
    year: 2,
    rollPrefix: '0187IT2410',
    names: [
      'Nikhil Raj',
      'Abhishek Yadav',
      'Manish Choudhary',
      'Gaurav Thakur',
      'Deepak Dwivedi',
      'Kritika Jain',
      'Swati Shrivastava',
      'Anjali Kashyap',
      'Pallavi Nambiar',
      'Divya Hegde',
    ],
  },
  {
    courseId: 'course-btech',
    branchId: 'branch-ec',
    year: 2,
    rollPrefix: '0187EC2410',
    names: [
      'Surya Prakash',
      'Varun Dhawan',
      'Kunal Grover',
      'Tushar Parekh',
      'Bhavya Soni',
      'Radhika Venkatesh',
      'Aparna Bose',
      'Madhuri Kulkarni',
    ],
  },
  {
    courseId: 'course-btech',
    branchId: 'branch-me',
    year: 2,
    rollPrefix: '0187ME2410',
    names: [
      'Rajat Solanki',
      'VikrantGill Singh',
      'Mayank Rawat',
      'Sandeep Tomar',
      'Ashutosh Upadhyay',
      'Piyush Dixit',
      'Hemant Sisodia',
      'Chetan Purohit',
    ],
  },
];

export const INITIAL_STUDENTS: Student[] = [];

let studentCounter = 1;
for (const group of STUDENT_GROUPS) {
  group.names.forEach((fullName, idx) => {
    const numStr = String(idx + 1).padStart(2, '0');
    const rollNo = `${group.rollPrefix}${numStr}`;
    const cleanSlug = fullName
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .slice(0, 12);
    const mobileSuffix = String(71000 + studentCounter * 37).padStart(5, '0');
    const guardianSuffix = String(81000 + studentCounter * 53).padStart(5, '0');

    INITIAL_STUDENTS.push({
      id: `stu-${studentCounter}`,
      courseId: group.courseId,
      branchId: group.branchId,
      year: group.year,
      rollNo,
      name: fullName,
      mobile: `+91 98260 ${mobileSuffix}`,
      guardianMobile: `+91 94250 ${guardianSuffix}`,
      email: `${cleanSlug}.${rollNo.slice(-4).toLowerCase()}@attendai.edu.in`,
      status: 'active',
      createdAt: '2026-07-15T09:00:00.000Z',
      updatedAt: '2026-07-15T09:00:00.000Z',
    });
    studentCounter++;
  });
}

// Dates for the past 7 working days up to today (2026-10-26)
export const SEED_DATES = [
  '2026-10-19',
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24',
  '2026-10-26', // Today
];

export const TODAY_DATE = '2026-10-26';

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_FOLLOWUPS: AbsentFollowup[] = [];

// Deterministic attendance generation so some students are >=75% and some are <75%, and today has clear absentees
INITIAL_STUDENTS.forEach((stu, sIdx) => {
  SEED_DATES.forEach((date, dIdx) => {
    let status: 'present' | 'absent' | 'leave' = 'present';

    if (date === TODAY_DATE) {
      // On today's date, mark specific students absent or on leave in each class
      if (sIdx % 6 === 2 || sIdx % 7 === 4) {
        status = 'absent';
      } else if (sIdx % 11 === 5) {
        status = 'leave';
      } else {
        status = 'present';
      }
    } else {
      // Past dates: create realistic attendance distribution (some chronic absentees < 75%)
      if (sIdx % 5 === 3 && dIdx < 4) {
        status = 'absent';
      } else if ((sIdx + dIdx) % 9 === 0) {
        status = 'absent';
      } else if ((sIdx + dIdx) % 14 === 0) {
        status = 'leave';
      } else {
        status = 'present';
      }
    }

    const attId = `att-${stu.id}-${date}`;
    INITIAL_ATTENDANCE.push({
      id: attId,
      studentId: stu.id,
      courseId: stu.courseId,
      branchId: stu.branchId,
      year: stu.year,
      date,
      status,
      markedBy: 'usr-tch-1',
      markedByName: 'Prof. Ananya Deshmukh',
      markedAt: `${date}T09:30:00.000Z`,
      updatedAt: `${date}T09:30:00.000Z`,
    });

    // For today's absent students, create AbsentFollowup records
    if (date === TODAY_DATE && status === 'absent') {
      const followupIdx = INITIAL_FOLLOWUPS.length;
      const fId = `fol-${stu.id}-${date}`;

      // Give a realistic variety of initial states on today's absentees:
      // Most are 'pending' ("Not Called") as required by Phase 1, and a few in CSE Yr 2 show Phase 2 AI Call results!
      if (followupIdx === 0) {
        INITIAL_FOLLOWUPS.push({
          id: fId,
          attendanceId: attId,
          studentId: stu.id,
          courseId: stu.courseId,
          branchId: stu.branchId,
          year: stu.year,
          date,
          phoneToCall: stu.guardianMobile,
          contactTarget: 'guardian',
          callStatus: 'answered',
          attempts: 1,
          maxAttempts: 3,
          lastAttemptAt: '2026-10-26T12:02:14.000Z',
          nextRetryAt: null,
          reasonText: 'High viral fever since last night; visiting family clinic today.',
          reasonCategory: 'medical',
          transcript:
            'AI Agent (ATTEND AI): नमस्ते, यह कॉलेज उपस्थिति विभाग से एक स्वचालित कॉल है। यह कॉल गुणवत्ता और उपस्थिति रिकॉर्ड के लिए दर्ज की जा रही है। आज छात्र आदित्य वर्मा (Roll: 0187CS241003) कक्षा में अनुपस्थित दर्ज किए गए हैं। कृपया अनुपस्थिति का कारण बताएं।\nGuardian: नमस्ते जी, आदित्य को कल रात से तेज बुखार है। हम आज डॉक्टर के पास दिखाने ले जा रहे हैं, कल या परसों से कॉलेज आ जाएगा।\nAI Agent (ATTEND AI): धन्यवाद। मैंने दर्ज कर लिया है कि आदित्य वर्मा तेज बुखार और डॉक्टर के परामर्श के कारण आज अनुपस्थित हैं। हम उनके शीघ्र स्वस्थ होने की कामना करते हैं। नमस्ते।',
          summary: 'Guardian confirmed student has high fever since last night and is visiting the doctor today.',
          language: 'hi-IN',
          overriddenByTeacher: false,
          consentRecorded: true,
          updatedAt: '2026-10-26T12:03:05.000Z',
        });
      } else if (followupIdx === 1) {
        INITIAL_FOLLOWUPS.push({
          id: fId,
          attendanceId: attId,
          studentId: stu.id,
          courseId: stu.courseId,
          branchId: stu.branchId,
          year: stu.year,
          date,
          phoneToCall: stu.mobile,
          contactTarget: 'student',
          callStatus: 'answered',
          attempts: 1,
          maxAttempts: 3,
          lastAttemptAt: '2026-10-26T12:04:40.000Z',
          nextRetryAt: null,
          reasonText: 'College bus breakdown on NH-46 route; missed morning lecture slot.',
          reasonCategory: 'transport',
          transcript:
            'AI Agent (ATTEND AI): Hello, this is an automated attendance verification call from the college. This call is recorded for academic attendance records. Student Arjun Nair (Roll: 0187CS241005) was marked absent today. Could you please share the reason for the absence?\nStudent: Hello ma\'am, the route 4 bus broke down near the bypass this morning and there was heavy traffic, so I missed the first half.\nAI Agent (ATTEND AI): Thank you. I have recorded that you were absent due to a route 4 bus breakdown and traffic delay. Have a good day.',
          summary: 'Student missed classes due to route 4 bus breakdown and traffic delay on the highway.',
          language: 'en-IN',
          overriddenByTeacher: false,
          consentRecorded: true,
          updatedAt: '2026-10-26T12:05:22.000Z',
        });
      } else if (followupIdx === 2) {
        INITIAL_FOLLOWUPS.push({
          id: fId,
          attendanceId: attId,
          studentId: stu.id,
          courseId: stu.courseId,
          branchId: stu.branchId,
          year: stu.year,
          date,
          phoneToCall: stu.guardianMobile,
          contactTarget: 'guardian',
          callStatus: 'unanswered',
          attempts: 3,
          maxAttempts: 3,
          lastAttemptAt: '2026-10-26T13:15:00.000Z',
          nextRetryAt: null,
          reasonText: '',
          reasonCategory: 'none',
          transcript: 'Attempt 1 (12:00 PM): Ringing - No Answer.\nAttempt 2 (12:35 PM): Ringing - No Answer.\nAttempt 3 (01:15 PM): Subscriber did not pick up. Marked Unanswered after 3 attempts.',
          summary: 'Unanswered after 3 automated call attempts (initial + 2 retries).',
          language: 'hi-IN',
          overriddenByTeacher: false,
          consentRecorded: false,
          updatedAt: '2026-10-26T13:15:00.000Z',
        });
      } else {
        // Default pending ("Not Called")
        INITIAL_FOLLOWUPS.push({
          id: fId,
          attendanceId: attId,
          studentId: stu.id,
          courseId: stu.courseId,
          branchId: stu.branchId,
          year: stu.year,
          date,
          phoneToCall: stu.guardianMobile,
          contactTarget: 'guardian',
          callStatus: 'pending',
          attempts: 0,
          maxAttempts: 3,
          lastAttemptAt: null,
          nextRetryAt: '2026-10-26T12:00:00.000Z',
          reasonText: '',
          reasonCategory: 'none',
          transcript: '',
          summary: '',
          language: 'hi-IN',
          overriddenByTeacher: false,
          consentRecorded: false,
          updatedAt: `${date}T09:30:00.000Z`,
        });
      }
    }
  });
});

export const INITIAL_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: true,
  firstPassTime: '12:00',
  secondPassTime: '13:00',
  allowedStartHour: 9,
  allowedEndHour: 18,
  defaultLanguage: 'hi-IN',
  defaultContactTarget: 'guardian',
  maxRetries: 2,
  retryGapMinutes: 45,
  providerMode: 'test_mock',
  lastRunAt: '2026-10-26T12:05:30.000Z',
};

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1001',
    actorId: 'usr-admin-1',
    actorName: 'Dr. Rajeshwar Sharma',
    actorRole: 'admin',
    action: 'CREATE_USER',
    entity: 'users',
    entityId: 'usr-hod-1',
    before: null,
    after: { userId: 'HOD-CSE-01', role: 'hod', departments: ['CSE', 'CSD', 'IT', 'BCA-DS', 'MCA-SE'] },
    summary: 'Created HOD account HOD-CSE-01 (Dr. Vikramaditya Verma) for CSE, CSD, IT, BCA, MCA',
    timestamp: '2026-07-02T09:00:00.000Z',
  },
  {
    id: 'log-1002',
    actorId: 'usr-admin-1',
    actorName: 'Dr. Rajeshwar Sharma',
    actorRole: 'admin',
    action: 'CREATE_USER',
    entity: 'users',
    entityId: 'usr-tch-1',
    before: null,
    after: { userId: 'TCH-CSE-01', role: 'teacher', departments: ['CSE', 'CSD'] },
    summary: 'Created Teacher account TCH-CSE-01 (Prof. Ananya Deshmukh) assigned to B.Tech CSE & CSD',
    timestamp: '2026-07-05T09:00:00.000Z',
  },
  {
    id: 'log-1003',
    actorId: 'usr-hod-1',
    actorName: 'Dr. Vikramaditya Verma',
    actorRole: 'hod',
    action: 'CSV_BULK_IMPORT',
    entity: 'students',
    entityId: 'branch-cse',
    before: { count: 0 },
    after: { count: 28 },
    summary: 'Bulk imported 28 students into B.Tech CSE (Year 2 & Year 3) via validated CSV',
    timestamp: '2026-07-15T09:10:00.000Z',
  },
  {
    id: 'log-1004',
    actorId: 'usr-tch-1',
    actorName: 'Prof. Ananya Deshmukh',
    actorRole: 'teacher',
    action: 'SAVE_ATTENDANCE',
    entity: 'attendance',
    entityId: 'branch-cse-2026-10-26',
    before: null,
    after: { date: '2026-10-26', branch: 'CSE', year: 2, total: 18, present: 12, absent: 5, leave: 1 },
    summary: 'Saved daily attendance for B.Tech CSE Year 2 (2026-10-26) and queued 5 absent follow-up calls',
    timestamp: '2026-10-26T09:30:00.000Z',
  },
  {
    id: 'log-1005',
    actorId: 'usr-hod-1',
    actorName: 'AI Calling Scheduler (Gemini 3.8)',
    actorRole: 'hod',
    action: 'AI_CALL_COMPLETED',
    entity: 'absentFollowups',
    entityId: 'fol-stu-3-2026-10-26',
    before: { callStatus: 'pending' },
    after: { callStatus: 'answered', reasonCategory: 'medical', language: 'hi-IN' },
    summary: 'Automated Hindi AI Call answered for Aditya Verma (0187CS241003): Medical reason recorded',
    timestamp: '2026-10-26T12:03:05.000Z',
  },
];

export const INITIAL_APPROVAL_REQUESTS: PastDateApprovalRequest[] = [];
