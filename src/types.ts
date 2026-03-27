export interface Project {
  id: string;
  name: string;
  address: string;
  contact: string;
  houseType: string;
  designer?: string;
  startDate: string | any; // ISO string or Timestamp
  ownerId: string;
  status?: 'pending' | 'in-progress' | 'completed';
  isShared?: boolean;
  createdAt: string | any; // ISO string or Timestamp
  updatedAt: string | any; // ISO string or Timestamp
}

export interface Designer {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string | any;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  dueTime?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  startDate: string | any; // ISO string or Timestamp
  startTime?: string;
  endDate: string | any; // ISO string or Timestamp
  endTime?: string;
  status: 'pending' | 'in-progress' | 'completed';
  subtasks?: Subtask[];
  color?: string;
  createdAt: string | any; // ISO string or Timestamp
  updatedAt: string | any; // ISO string or Timestamp
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string; // ISO string
}
