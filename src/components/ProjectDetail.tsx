import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Project, Task, Subtask } from '../types';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Clock, CheckCircle, Circle, Trash2, Edit2, X, Bell, FolderOpen, Share2, Copy, ChevronRight, MapPin, Home, User, CheckCircle2, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isAfter } from 'date-fns';
import clsx from 'clsx';

import { useAuth } from './AuthProvider';

const TASK_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#71717a', '#000000'
];

interface ProjectDetailProps {
  projectId: string;
  onBack?: () => void;
  readOnly?: boolean;
  isPersonal?: boolean;
}

export default function ProjectDetail({ projectId, onBack, readOnly = false, isPersonal = false }: ProjectDetailProps) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [designerName, setDesignerName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Task form state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as 'pending' | 'in-progress' | 'completed',
    subtasks: [] as Subtask[],
    color: ''
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');

  // Drag to resize state
  const [dragState, setDragState] = useState<{
    taskId: string;
    edge: 'start' | 'end';
    tempDate: Date;
  } | null>(null);
  
  const dragStateRef = useRef(dragState);
  const tasksRef = useRef(tasks);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (isPersonal && user) {
      setProject({
        id: projectId,
        name: 'Personal Calendar',
        address: '',
        contact: '',
        houseType: '',
        ownerId: user.uid,
        startDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setLoading(false);
    } else {
      const fetchProject = async () => {
        try {
          const docRef = doc(db, 'projects', projectId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const projectData = { id: docSnap.id, ...docSnap.data() } as Project;
            setProject(projectData);
            
            if (projectData.designer) {
              try {
                const designerDoc = await getDoc(doc(db, 'designers', projectData.designer));
                if (designerDoc.exists()) {
                  setDesignerName(designerDoc.data().name);
                }
              } catch (e) {
                console.error("Error fetching designer:", e);
              }
            }
          } else {
            setError('Project not found or you do not have permission to view it.');
          }
        } catch (err) {
          setError('Project not found or you do not have permission to view it.');
          try {
            handleFirestoreError(err, OperationType.GET, `projects/${projectId}`);
          } catch (e) {
            // Ignore thrown error from handleFirestoreError
          }
        }
      };

      fetchProject();
    }

    const q = query(
      collection(db, 'tasks'),
      where('projectId', '==', projectId),
      orderBy('startDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData: Task[] = [];
      snapshot.forEach((doc) => {
        taskData.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(taskData);
      setLoading(false);
    }, (err) => {
      setError('Could not load tasks. You may not have permission.');
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'tasks');
      } catch (e) {
        // Ignore thrown error
      }
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    try {
      // Ensure subtasks don't have undefined values which Firestore rejects
      const cleanSubtasks = taskForm.subtasks.map(st => {
        const cleanSt = { ...st };
        if (cleanSt.dueDate === undefined) {
          delete cleanSt.dueDate;
        }
        return cleanSt;
      });

      const taskDataToSave = {
        ...taskForm,
        subtasks: cleanSubtasks,
        startDate: new Date(taskForm.startDate + 'T00:00:00'),
        endDate: new Date(taskForm.endDate + 'T00:00:00'),
      };

      if (editingTask) {
        const taskRef = doc(db, 'tasks', editingTask.id);
        await updateDoc(taskRef, {
          ...taskDataToSave,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskDataToSave,
          projectId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      closeTaskForm();
    } catch (error) {
      handleFirestoreError(error, editingTask ? OperationType.UPDATE : OperationType.CREATE, 'tasks');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (readOnly) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
      }
    }
  };

  const [showShareToast, setShowShareToast] = useState(false);

  const handleShare = async () => {
    if (readOnly || !project) return;
    
    try {
      if (!project.isShared) {
        await updateDoc(doc(db, 'projects', projectId), {
          isShared: true,
          updatedAt: serverTimestamp()
        });
        setProject(prev => prev ? { ...prev, isShared: true } : null);
      }
      
      const shareUrl = `${window.location.origin}/shared/${projectId}`;
      await navigator.clipboard.writeText(shareUrl);
      
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: 'pending' | 'in-progress' | 'completed') => {
    if (readOnly) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleProjectStatusChange = async (newStatus: 'pending' | 'in-progress' | 'completed') => {
    if (readOnly) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setProject(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    
    const newSubtask: Subtask = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9), 
      title: newSubtaskTitle.trim(), 
      completed: false
    };
    
    if (newSubtaskDueDate) {
      newSubtask.dueDate = newSubtaskDueDate;
    }

    setTaskForm(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), newSubtask]
    }));
    setNewSubtaskTitle('');
    setNewSubtaskDueDate('');
  };

  const handleToggleSubtask = (subtaskId: string) => {
    setTaskForm(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st)
    }));
  };

  const handleRemoveSubtask = (subtaskId: string) => {
    setTaskForm(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(st => st.id !== subtaskId)
    }));
  };

  const handleToggleSubtaskDirectly = async (task: Task, subtaskId: string) => {
    if (readOnly) return;
    const updatedSubtasks = (task.subtasks || []).map(st => {
      const cleanSt = st.id === subtaskId ? { ...st, completed: !st.completed } : { ...st };
      if (cleanSt.dueDate === undefined) {
        delete cleanSt.dueDate;
      }
      return cleanSt;
    });
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        subtasks: updatedSubtasks,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      startDate: format(task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate), 'yyyy-MM-dd'),
      endDate: format(task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate), 'yyyy-MM-dd'),
      status: task.status,
      subtasks: task.subtasks || [],
      color: task.color || ''
    });
    setIsAddingTask(true);
  };

  const closeTaskForm = () => {
    setIsAddingTask(false);
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'pending',
      subtasks: [],
      color: ''
    });
    setNewSubtaskTitle('');
    setNewSubtaskDueDate('');
  };

  const handleMouseDownResize = (e: React.MouseEvent, taskId: string, edge: 'start' | 'end') => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const dateToUse = edge === 'start' 
      ? (task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate))
      : (task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate));
      
    setDragState({
      taskId,
      edge,
      tempDate: dateToUse
    });
  };

  const handleTouchStartResize = (e: React.TouchEvent, taskId: string, edge: 'start' | 'end') => {
    if (readOnly) return;
    e.stopPropagation();
    // Don't preventDefault here to allow scrolling if needed, 
    // but we'll prevent it in touchmove if dragging
    isDraggingRef.current = true;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const dateToUse = edge === 'start' 
      ? (task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate))
      : (task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate));
      
    setDragState({
      taskId,
      edge,
      tempDate: dateToUse
    });
  };

  const handleMouseEnterDay = (day: Date) => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState) return;
    const task = tasksRef.current.find(t => t.id === currentDragState.taskId);
    if (!task) return;

    const originalStart = task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate);
    const originalEnd = task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate);

    let newTempDate = day;
    
    // Prevent dragging start past end, or end before start
    if (currentDragState.edge === 'start' && isAfter(newTempDate, originalEnd)) {
      newTempDate = originalEnd;
    }
    if (currentDragState.edge === 'end' && isBefore(newTempDate, originalStart)) {
      newTempDate = originalStart;
    }

    setDragState(prev => prev ? { ...prev, tempDate: newTempDate } : null);
  };

  const handleMouseUp = async () => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState) {
      isDraggingRef.current = false;
      return;
    }
    
    const { taskId, edge, tempDate } = currentDragState;
    setDragState(null); // Clear immediately for snappy UI

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);

    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;

    const originalDate = edge === 'start' 
      ? (task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate))
      : (task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate));

    if (isSameDay(originalDate, tempDate)) return;

    try {
      const taskRef = doc(db, 'tasks', taskId);
      const updateData = edge === 'start'
        ? { startDate: tempDate }
        : { endDate: tempDate };
      await updateDoc(taskRef, updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  useEffect(() => {
    const onMouseUp = () => handleMouseUp();
    const onTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current) return;
      e.preventDefault(); // Prevent scrolling while dragging
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const dayCell = el.closest('[data-day]');
        if (dayCell) {
          const dayStr = dayCell.getAttribute('data-day');
          if (dayStr) {
            handleMouseEnterDay(new Date(dayStr));
          }
        }
      }
    };
    const onTouchEnd = () => handleMouseUp();

    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const handleTaskClick = (task: Task) => {
    if (isDraggingRef.current) return;
    openEditForm(task);
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = addDays(startOfWeek(monthEnd), 6);
    
    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="rounded-3xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10 bg-white/5 backdrop-blur-sm gap-3">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="hidden lg:flex items-center space-x-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
              <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 shadow-sm shadow-amber-200"></span>Pending</div>
              <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2 shadow-sm shadow-blue-200"></span>In Progress</div>
              <div className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-sm shadow-emerald-200"></span>Completed</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, -30))} 
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-slate-600 transition-all active:scale-90 bg-white/5 backdrop-blur-sm border border-white/10"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())} 
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl hover:bg-white/10 text-slate-700 font-black text-[10px] uppercase tracking-widest transition-all active:scale-90 bg-white/5 backdrop-blur-sm border border-white/10"
            >
              Today
            </button>
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, 30))} 
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-slate-600 transition-all active:scale-90 bg-white/5 backdrop-blur-sm border border-white/10"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-white/10 bg-white/5 backdrop-blur-sm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-white/5 backdrop-blur-sm">
          {daysInterval.map((day, i) => {
            const dayTasks = tasks.filter(t => {
              let start = t.startDate.toDate ? t.startDate.toDate() : new Date(t.startDate);
              let end = t.endDate.toDate ? t.endDate.toDate() : new Date(t.endDate);
              
              if (dragState && dragState.taskId === t.id) {
                if (dragState.edge === 'start') start = dragState.tempDate;
                else end = dragState.tempDate;
              }
              
              const startDay = new Date(start.setHours(0,0,0,0));
              const endDay = new Date(end.setHours(23,59,59,999));
              
              return day >= startDay && day <= endDay;
            }).sort((a, b) => {
              let startA = a.startDate.toDate ? a.startDate.toDate() : new Date(a.startDate);
              let endA = a.endDate.toDate ? a.endDate.toDate() : new Date(a.endDate);
              if (dragState && dragState.taskId === a.id) {
                if (dragState.edge === 'start') startA = dragState.tempDate;
                else endA = dragState.tempDate;
              }
              
              let startB = b.startDate.toDate ? b.startDate.toDate() : new Date(b.startDate);
              let endB = b.endDate.toDate ? b.endDate.toDate() : new Date(b.endDate);
              if (dragState && dragState.taskId === b.id) {
                if (dragState.edge === 'start') startB = dragState.tempDate;
                else endB = dragState.tempDate;
              }
              
              if (startA.getTime() !== startB.getTime()) return startA.getTime() - startB.getTime();
              return endB.getTime() - endA.getTime();
            });

            const daySubtasks = tasks.flatMap(t => 
              (t.subtasks || []).filter(st => {
                if (!st.dueDate) return false;
                const [year, month, d] = st.dueDate.split('-').map(Number);
                const localDueDate = new Date(year, month - 1, d);
                return isSameDay(day, localDueDate);
              }).map(st => ({ ...st, parentTask: t }))
            );

            return (
              <div 
                key={day.toString()} 
                data-day={day.toISOString()}
                style={{ zIndex: 100 - i }}
                className={clsx(
                  "min-h-[100px] sm:min-h-[140px] border-b border-r border-white/10 relative flex flex-col transition-all duration-300",
                  !isSameDay(day, monthStart) && day.getMonth() !== monthStart.getMonth() ? "bg-white/5 opacity-40" : "hover:bg-white/10"
                )}
                onMouseEnter={() => handleMouseEnterDay(day)}
              >
                <div className={clsx(
                  "text-right text-[10px] p-2 pb-1 font-black tracking-tighter text-slate-400"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="flex-1 space-y-1 pb-2 px-1">
                  {dayTasks.map(task => {
                    let start = task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate);
                    let end = task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate);
                    
                    if (dragState && dragState.taskId === task.id) {
                      if (dragState.edge === 'start') start = dragState.tempDate;
                      else end = dragState.tempDate;
                    }
                    
                    const isActualStart = isSameDay(day, start);
                    const isActualEnd = isSameDay(day, end);
                    const isSunday = day.getDay() === 0;
                    const showTitle = isActualStart || isSunday || day.getDate() === 1;

                    let spanDays = 1;
                    if (showTitle) {
                      const daysToSaturday = 6 - day.getDay();
                      const startDayStart = new Date(day).setHours(0,0,0,0);
                      const endDayStart = new Date(end).setHours(0,0,0,0);
                      const diffCalendarDays = Math.round((endDayStart - startDayStart) / (1000 * 60 * 60 * 24));
                      spanDays = Math.min(diffCalendarDays + 1, daysToSaturday + 1);
                    }

                    const statusColorHex = task.status === 'completed' ? '#10b981' : task.status === 'in-progress' ? '#3b82f6' : '#fbbf24';
                    const isDraggingThis = dragState?.taskId === task.id;

                    return (
                      <div 
                        key={task.id} 
                        onClick={() => handleTaskClick(task)}
                        className={clsx(
                          "text-[9px] sm:text-[10px] cursor-pointer relative z-10 transition-all hover:brightness-110 active:scale-[0.98] block group",
                          isActualStart ? "rounded-l-md ml-1" : "rounded-l-none ml-0",
                          isActualEnd ? "rounded-r-md mr-1" : "rounded-r-none mr-0",
                          "py-0.5 my-1 shadow-sm",
                          isDraggingThis ? "opacity-75 ring-2 ring-indigo-400 scale-105 z-50" : ""
                        )}
                        style={{ backgroundColor: task.color || statusColorHex }}
                        title={task.title}
                      >
                        {isActualStart && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 hover:bg-black/10 rounded-l-md"
                            onMouseDown={(e) => handleMouseDownResize(e, task.id, 'start')}
                            onTouchStart={(e) => handleTouchStartResize(e, task.id, 'start')}
                          />
                        )}
                        {isActualEnd && (
                          <div 
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 hover:bg-black/10 rounded-r-md"
                            onMouseDown={(e) => handleMouseDownResize(e, task.id, 'end')}
                            onTouchStart={(e) => handleTouchStartResize(e, task.id, 'end')}
                          />
                        )}
                        <div 
                          className={clsx(
                            "h-full flex items-center min-h-[16px] font-black",
                            task.color ? "px-1" : (isActualStart ? "pl-1.5" : "pl-2"),
                            !task.color && (isActualEnd ? "pr-1.5" : "pr-2"),
                          )}
                          style={{ color: task.color ? 'white' : (task.status === 'pending' ? '#451a03' : 'white'), textShadow: task.color ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}
                        >
                          {showTitle && (
                            <div 
                              className="flex items-center absolute left-1.5 right-auto z-30 pointer-events-none overflow-hidden" 
                              style={{ 
                                width: 'max-content',
                                maxWidth: `calc(${spanDays * 100}% + ${(spanDays - 1) * 1}px - 12px)`
                              }}
                            >
                              <span className="block truncate drop-shadow-sm">{task.title}</span>
                            </div>
                          )}
                          &nbsp;
                        </div>
                      </div>
                    );
                  })}
                  {daySubtasks.map(st => (
                    <div 
                      key={st.id}
                      onClick={(e) => { e.stopPropagation(); openEditForm(st.parentTask); }}
                      className="text-[9px] sm:text-[10px] py-0.5 px-2 mx-1.5 mt-0.5 rounded-lg bg-white/40 text-slate-600 border border-white/40 truncate cursor-pointer hover:bg-white/60 flex items-center transition-colors"
                      title={`${st.parentTask.title} - ${st.title}`}
                    >
                      <CheckCircle className={clsx("w-2.5 h-2.5 mr-1.5 flex-shrink-0", st.completed ? "text-emerald-500" : "text-slate-400")} />
                      <span className={clsx("truncate font-medium", st.completed && "line-through text-slate-400")}>{st.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-red-500 mb-4">
          <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">{error}</h3>
        {onBack && (
          <button 
            onClick={onBack}
            className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2.5 rounded-xl glass hover:bg-white/20 text-slate-600 transition-all active:scale-95 shadow-sm"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{project.name}</h2>
            {!isPersonal && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm font-bold text-slate-500/80">
                <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1.5" /> {project.address}</span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center"><Home className="w-3.5 h-3.5 mr-1.5" /> {project.houseType}</span>
                {designerName && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center text-indigo-600/80"><User className="w-3.5 h-3.5 mr-1.5" /> {designerName}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {!isPersonal && (
          <div className="flex flex-wrap items-center justify-center w-full sm:w-auto gap-1.5 glass p-1 rounded-2xl shadow-lg border border-white/20">
            {!readOnly && (
              <div className="flex flex-wrap items-center justify-center gap-1 flex-1 sm:flex-none w-full sm:w-auto">
                {[
                  { id: 'pending', name: 'Pending', active: 'bg-amber-500/80 text-white shadow-md ring-1 ring-amber-500/20', inactive: 'text-amber-700 hover:bg-amber-50/20' },
                  { id: 'in-progress', name: 'In Progress', active: 'bg-blue-500/80 text-white shadow-md ring-1 ring-blue-500/20', inactive: 'text-blue-700 hover:bg-blue-50/20' },
                  { id: 'completed', name: 'Completed', active: 'bg-emerald-500/80 text-white shadow-md ring-1 ring-emerald-500/20', inactive: 'text-emerald-700 hover:bg-emerald-50/20' },
                ].map((status) => {
                  const isActive = (project.status || 'pending') === status.id;
                  return (
                    <button
                      key={status.id}
                      onClick={() => handleProjectStatusChange(status.id as any)}
                      className={clsx(
                        "flex-1 sm:flex-none px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all duration-300 uppercase tracking-wider text-center",
                        isActive ? status.active : status.inactive
                      )}
                    >
                      {status.name}
                    </button>
                  );
                })}
                <div className="hidden sm:block w-px h-5 bg-white/20 mx-1"></div>
              </div>
            )}
            {!readOnly && (
              <button
                onClick={handleShare}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-white/20 text-[10px] sm:text-xs font-bold rounded-xl text-slate-700 bg-white/10 hover:bg-white/20 transition-all active:scale-95 uppercase tracking-wider"
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                Share
              </button>
            )}
            {readOnly && (
              <span className="flex-1 sm:flex-none justify-center px-3 py-1.5 text-[10px] sm:text-xs font-bold text-slate-500 flex items-center uppercase tracking-wider">
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                Shared View
              </span>
            )}
          </div>
        )}
      </div>

      {showShareToast && (
        <div className="fixed bottom-8 right-8 glass-dark text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <div className="bg-emerald-500 p-1.5 rounded-lg">
            <Copy className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm">Share link copied to clipboard!</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 glass p-1.5 rounded-2xl shadow-lg border border-white/20">
        <div className="flex p-1 bg-white/10 rounded-xl">
          <button
            onClick={() => setView('calendar')}
            className={clsx(
              "flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 uppercase tracking-wider",
              view === 'calendar' ? "bg-white/60 text-indigo-800 shadow-sm backdrop-blur-md" : "text-slate-500 hover:text-slate-700 hover:bg-white/10"
            )}
          >
            Calendar
          </button>
          <button
            onClick={() => setView('list')}
            className={clsx(
              "flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 uppercase tracking-wider",
              view === 'list' ? "bg-white/60 text-indigo-800 shadow-sm backdrop-blur-md" : "text-slate-500 hover:text-slate-700 hover:bg-white/10"
            )}
          >
            List
          </button>
        </div>
        {!readOnly && (
          <button
            onClick={() => setIsAddingTask(true)}
            className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-xs sm:text-sm font-bold rounded-xl shadow-lg text-white bg-indigo-600/80 hover:bg-indigo-700/80 transition-all active:scale-95 backdrop-blur-sm"
          >
            <Plus className="-ml-1 mr-1.5 h-4 w-4" />
            Add Task
          </button>
        )}
      </div>

      {isAddingTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6 animate-in fade-in duration-300">
          <div className="glass rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col border border-white/20 overflow-hidden">
            <div className="flex justify-between items-center px-4 sm:px-8 py-3 sm:py-6 border-b border-white/10 bg-white/5 backdrop-blur-md">
              <h3 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {readOnly ? 'View Task' : editingTask ? 'Edit Task' : 'Add New Task'}
              </h3>
              <button onClick={closeTaskForm} className="p-1.5 sm:p-2 rounded-xl hover:bg-white/20 text-slate-400 hover:text-slate-600 transition-all">
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
            
            <div className="p-5 sm:p-8 overflow-y-auto flex-1 no-scrollbar">
              <form id="task-form" onSubmit={handleSaveTask} className="space-y-5 sm:space-y-6">
                <fieldset disabled={readOnly} className="space-y-5 sm:space-y-6">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">Task Title</label>
                    <input
                      type="text"
                      required
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      className="glass-input block w-full rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-base sm:text-sm outline-none"
                      placeholder="What needs to be done?"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">Description</label>
                    <textarea
                      rows={2}
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      className="glass-input block w-full rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-base sm:text-sm outline-none resize-none"
                      placeholder="Add more details..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">Start Date</label>
                      <input
                        type="date"
                        required
                        value={taskForm.startDate}
                        onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                        className="glass-input block w-full rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-base sm:text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">End Date</label>
                      <input
                        type="date"
                        required
                        value={taskForm.endDate}
                        onChange={(e) => setTaskForm({ ...taskForm, endDate: e.target.value })}
                        className="glass-input block w-full rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-base sm:text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as any })}
                      className="glass-input block w-full rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-base sm:text-sm outline-none appearance-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 sm:mb-2 ml-1">Task Color</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setTaskForm({...taskForm, color: ''})}
                        className={clsx("w-6 h-6 rounded-full border-2 transition-transform flex items-center justify-center text-[10px]", taskForm.color === '' ? "border-slate-900 scale-110" : "border-slate-300 hover:scale-110 bg-slate-100")}
                        title="Default Status Color"
                      >
                        /
                      </button>
                      {TASK_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTaskForm({...taskForm, color: c})}
                          className={clsx("w-6 h-6 rounded-full border-2 transition-transform", taskForm.color === c ? "border-slate-900 scale-110" : "border-transparent hover:scale-110")}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Subtasks Section */}
                  <div className="pt-4 border-t border-white/20">
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Subtasks</label>
                    <div className="space-y-2 mb-3 max-h-40 overflow-y-auto no-scrollbar">
                      {taskForm.subtasks.map(subtask => (
                        <div key={subtask.id} className="flex items-center justify-between bg-white/20 p-2.5 rounded-xl border border-white/30">
                          <div className="flex items-center flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={subtask.completed}
                              onChange={() => handleToggleSubtask(subtask.id)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-white/40 rounded bg-white/30"
                            />
                            <span className={clsx("ml-3 text-xs font-bold truncate", subtask.completed ? "line-through text-slate-400" : "text-slate-700")}>
                              {subtask.title}
                            </span>
                            {subtask.dueDate && (
                              <span className="ml-2 text-[10px] font-black text-slate-400 bg-white/30 px-1.5 py-0.5 rounded-lg">
                                {subtask.dueDate}
                              </span>
                            )}
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtask(subtask.id)}
                              className="ml-2 text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!readOnly && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                          placeholder="Add a subtask..."
                          className="flex-1 glass-input rounded-xl py-2.5 px-3.5 sm:px-3 text-base sm:text-sm outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={newSubtaskDueDate}
                            onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                            className="flex-1 sm:w-32 glass-input rounded-xl py-2.5 px-3.5 sm:px-3 text-base sm:text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddSubtask}
                            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-slate-600 hover:bg-slate-700 transition-all active:scale-95"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </fieldset>
              </form>
            </div>
            
            <div className="px-5 sm:px-8 py-4 sm:py-6 border-t border-white/10 bg-white/5 backdrop-blur-md flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeTaskForm}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-white/20 transition-all active:scale-95"
              >
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  form="task-form"
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600/80 hover:bg-indigo-700/80 shadow-lg shadow-indigo-200/50 transition-all active:scale-95 backdrop-blur-sm"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'calendar' ? (
        <div className="animate-in fade-in duration-500">
          {renderCalendar()}
        </div>
      ) : (
        <div className="space-y-6">
          {tasks.length === 0 ? (
            <div className="glass p-16 text-center rounded-3xl border border-white/20">
              <div className="bg-indigo-50/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                <Plus className="h-10 w-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No tasks yet</h3>
              <p className="text-slate-500 max-w-xs mx-auto">Get started by adding your first task to this project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tasks.map((task) => (
                <div key={task.id} className="glass-card p-6 rounded-2xl group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-extrabold text-slate-900">{task.title}</h3>
                        <span className={clsx(
                          "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                          task.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                          task.status === 'in-progress' ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{task.description}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400">
                        <span className="flex items-center"><CalendarIcon className="w-3.5 h-3.5 mr-1.5" /> {format(task.startDate.toDate ? task.startDate.toDate() : new Date(task.startDate), 'MMM d')} - {format(task.endDate.toDate ? task.endDate.toDate() : new Date(task.endDate), 'MMM d, yyyy')}</span>
                        <span className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {task.subtasks?.length || 0} Subtasks</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:self-start">
                      {!readOnly && (
                        <>
                          <button
                            onClick={() => openEditForm(task)}
                            className="p-2.5 rounded-xl glass hover:bg-white/20 text-slate-400 hover:text-indigo-600 transition-all shadow-sm"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2.5 rounded-xl glass hover:bg-white/20 text-slate-400 hover:text-rose-600 transition-all shadow-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleTaskExpand(task.id)}
                        className="p-2.5 rounded-xl glass hover:bg-white/20 text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                      >
                        {expandedTasks.has(task.id) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {expandedTasks.has(task.id) && (
                    <div className="mt-8 pt-8 border-t border-white/20 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Subtasks & Progress</h4>
                      </div>
                      
                      <div className="space-y-3">
                        {(task.subtasks || []).map((subtask) => (
                          <div key={subtask.id} className="flex items-center justify-between p-4 rounded-xl bg-white/30 border border-white/40 group/sub">
                            <div className="flex items-center space-x-4">
                              <button
                                disabled={readOnly}
                                onClick={() => handleToggleSubtaskDirectly(task, subtask.id)}
                                className={clsx(
                                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                  subtask.completed 
                                    ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200" 
                                    : "border-slate-300 bg-white hover:border-indigo-400"
                                )}
                              >
                                {subtask.completed && <Check className="h-4 w-4" />}
                              </button>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <span className={clsx(
                                  "text-sm font-bold transition-all",
                                  subtask.completed ? "text-slate-400 line-through" : "text-slate-700"
                                )}>
                                  {subtask.title}
                                </span>
                                {subtask.dueDate && (
                                  <span className="inline-flex items-center text-[10px] font-black text-slate-500 bg-white/40 px-2 py-0.5 rounded-lg uppercase tracking-wider w-fit">
                                    <CalendarIcon className="w-3 h-3 mr-1.5 opacity-70" />
                                    {subtask.dueDate}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {(task.subtasks || []).length === 0 && (
                          <p className="text-center py-6 text-xs font-bold text-slate-400 italic">No subtasks added yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
