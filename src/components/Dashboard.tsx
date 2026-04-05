import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthProvider';
import { Project, Designer } from '../types';
import { Plus, MapPin, Phone, Home, Calendar as CalendarIcon, ChevronRight, FolderOpen, UserPlus, User, X, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

interface DashboardProps {
  onSelectProject: (id: string) => void;
}

export default function Dashboard({ onSelectProject }: DashboardProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingDesigner, setIsAddingDesigner] = useState(false);
  const [newDesignerName, setNewDesignerName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    address: '',
    contact: '',
    houseType: '',
    designer: '',
    startDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [sortField, setSortField] = useState<'name' | 'startDate' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectData: Project[] = [];
      snapshot.forEach((doc) => {
        projectData.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(projectData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const qDesigners = query(
      collection(db, 'designers'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeDesigners = onSnapshot(qDesigners, (snapshot) => {
      const designerData: Designer[] = [];
      snapshot.forEach((doc) => {
        designerData.push({ id: doc.id, ...doc.data() } as Designer);
      });
      setDesigners(designerData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'designers');
    });

    return () => {
      unsubscribe();
      unsubscribeDesigners();
    };
  }, [user]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'projects'), {
        ...newProject,
        startDate: new Date(newProject.startDate),
        ownerId: user.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewProject({
        name: '',
        address: '',
        contact: '',
        houseType: '',
        designer: '',
        startDate: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleAddDesigner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDesignerName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'designers'), {
        name: newDesignerName.trim(),
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewProject(prev => ({ ...prev, designer: docRef.id }));
      setIsAddingDesigner(false);
      setNewDesignerName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'designers');
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent triggering the card click
    if (!user) return;
    setProjectToDelete(projectId);
  };

  const confirmDeleteProject = async () => {
    if (!user || !projectToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete));
      // Note: In a production app, you might also want to delete associated tasks here
      // or use a Cloud Function to clean up orphaned tasks.
      setProjectToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectToDelete}`);
    }
  };

  const filteredProjects = projects
    .filter(p => (p.status || 'pending') === activeTab)
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'startDate') {
        valA = valA?.toDate ? valA.toDate().getTime() : new Date(valA || 0).getTime();
        valB = valB?.toDate ? valB.toDate().getTime() : new Date(valB || 0).getTime();
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Projects</h2>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => onSelectProject('personal')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-white/20 text-xs sm:text-sm font-bold rounded-xl shadow-lg text-slate-700 glass hover:bg-white/20 focus:outline-none transition-all active:scale-95"
          >
            <User className="-ml-1 mr-1.5 h-4 w-4 text-slate-500" />
            Personal
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs sm:text-sm font-bold rounded-xl shadow-lg text-white bg-indigo-600/80 hover:bg-indigo-700/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-95 backdrop-blur-sm"
          >
            <Plus className="-ml-1 mr-1.5 h-4 w-4" />
            New Project
          </button>
          <button
            onClick={() => setIsAddingDesigner(!isAddingDesigner)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-white/20 text-xs sm:text-sm font-bold rounded-xl shadow-lg text-slate-700 glass hover:bg-white/20 focus:outline-none transition-all active:scale-95"
          >
            <UserPlus className="-ml-1 mr-1.5 h-4 w-4 text-slate-500" />
            Designer
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="glass rounded-2xl p-1 sm:p-1.5 inline-flex w-full sm:w-auto overflow-x-auto no-scrollbar border border-white/20">
          {[
            { id: 'pending', name: 'Pending' },
            { id: 'in-progress', name: 'In Progress' },
            { id: 'completed', name: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "flex-1 sm:flex-none whitespace-nowrap py-2.5 px-5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center",
                activeTab === tab.id
                  ? 'bg-white/60 text-indigo-800 shadow-sm backdrop-blur-md'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/10'
              )}
            >
              <FolderOpen className={clsx("mr-2 h-4 w-4", activeTab === tab.id ? "text-indigo-500" : "text-slate-400")} />
              {tab.name}
              <span className={clsx(
                "ml-2 py-0.5 px-2 rounded-lg text-xs font-bold",
                activeTab === tab.id ? "bg-indigo-50/50 text-indigo-600 backdrop-blur-sm" : "bg-white/20 text-slate-600 backdrop-blur-sm"
              )}>
                {projects.filter(p => (p.status || 'pending') === tab.id).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto lg:ml-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sort by</span>
            <div className="relative">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="glass-input text-xs font-bold py-2 pl-3 pr-8 rounded-xl outline-none appearance-none cursor-pointer border border-white/20 min-w-[120px]"
              >
                <option value="name">Name</option>
                <option value="startDate">Start Date</option>
                <option value="status">Status</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight className="h-3 w-3 text-slate-400 rotate-90" />
              </div>
            </div>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="glass p-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all group"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown className={clsx("h-4 w-4 transition-transform duration-300", sortOrder === 'desc' && "rotate-180", "text-indigo-500")} />
          </button>
        </div>
      </div>

      {isAddingDesigner && (
        <div className="glass rounded-2xl overflow-hidden animate-in slide-in-from-top duration-300 border border-white/20">
          <div className="px-6 py-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Add New Designer</h3>
            <form onSubmit={handleAddDesigner} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="flex-1">
                <label htmlFor="designerName" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Designer Name</label>
                <input
                  type="text"
                  id="designerName"
                  required
                  value={newDesignerName}
                  onChange={(e) => setNewDesignerName(e.target.value)}
                  className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none"
                  placeholder="Enter name..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingDesigner(false)}
                  className="flex-1 sm:flex-none bg-white/10 py-2.5 px-6 border border-white/20 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none inline-flex justify-center py-2.5 px-6 border border-transparent shadow-lg text-sm font-semibold rounded-xl text-white bg-indigo-600/80 hover:bg-indigo-700/80 transition-all active:scale-95 backdrop-blur-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="glass rounded-2xl overflow-hidden animate-in slide-in-from-top duration-300 border border-white/20">
          <div className="px-6 py-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Add New Project</h3>
            <form onSubmit={handleAddProject} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Client/Project Name</label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="contact" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Contact Info</label>
                  <input
                    type="text"
                    id="contact"
                    required
                    value={newProject.contact}
                    onChange={(e) => setNewProject({ ...newProject, contact: e.target.value })}
                    className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Address</label>
                  <input
                    type="text"
                    id="address"
                    required
                    value={newProject.address}
                    onChange={(e) => setNewProject({ ...newProject, address: e.target.value })}
                    className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="houseType" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">House Type</label>
                  <input
                    type="text"
                    id="houseType"
                    required
                    placeholder="e.g. Single Family, Condo"
                    value={newProject.houseType}
                    onChange={(e) => setNewProject({ ...newProject, houseType: e.target.value })}
                    className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="designer" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Designer</label>
                  <select
                    id="designer"
                    value={newProject.designer}
                    onChange={(e) => setNewProject({ ...newProject, designer: e.target.value })}
                    className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none appearance-none"
                  >
                    <option value="">Select a designer...</option>
                    {designers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="startDate" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Start Date</label>
                  <input
                    type="date"
                    id="startDate"
                    required
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                    className="glass-input block w-full rounded-xl py-2.5 px-4 sm:text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="bg-white/10 py-2.5 px-6 border border-white/20 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center py-2.5 px-8 border border-transparent shadow-lg text-sm font-semibold rounded-xl text-white bg-indigo-600/80 hover:bg-indigo-700/80 transition-all active:scale-95 backdrop-blur-sm"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className="glass-card rounded-2xl overflow-hidden cursor-pointer group relative"
          >
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors pr-8">{project.name}</h3>
                <div className="bg-white/10 p-1.5 rounded-lg group-hover:bg-indigo-50/50 transition-colors backdrop-blur-sm">
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500" />
                </div>
              </div>
              <div className="space-y-3.5">
                <div className="flex items-start text-sm text-slate-500 font-medium">
                  <MapPin className="h-4 w-4 mr-2.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{project.address}</span>
                </div>
                <div className="flex items-center text-sm text-slate-500 font-medium">
                  <Phone className="h-4 w-4 mr-2.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{project.contact}</span>
                </div>
                <div className="flex items-center text-sm text-slate-500 font-medium">
                  <Home className="h-4 w-4 mr-2.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{project.houseType}</span>
                </div>
                {project.designer && (
                  <div className="flex items-center text-sm text-slate-500 font-medium">
                    <User className="h-4 w-4 mr-2.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">
                      {designers.find(d => d.id === project.designer)?.name || 'Unknown Designer'}
                    </span>
                  </div>
                )}
                <div className="flex items-center text-sm text-slate-500 font-medium">
                  <CalendarIcon className="h-4 w-4 mr-2.5 flex-shrink-0 text-slate-400" />
                  <span>Started: {project.startDate ? format(project.startDate.toDate ? project.startDate.toDate() : new Date(project.startDate), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={(e) => handleDeleteProject(e, project.id)}
              className="absolute bottom-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 backdrop-blur-sm border border-white/20 hover:border-rose-500/30 shadow-sm"
              title="Delete Project"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {filteredProjects.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-16 glass rounded-2xl border-2 border-dashed border-white/20">
            <h3 className="text-lg font-bold text-slate-900">No {activeTab.replace('-', ' ')} projects</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
              {activeTab === 'pending' ? 'Get started by creating a new project.' : `You don't have any projects in this folder.`}
            </p>
            <div className="mt-8">
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent shadow-lg text-sm font-bold rounded-xl text-white bg-indigo-600/80 hover:bg-indigo-700/80 transition-all active:scale-95 backdrop-blur-sm"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                New Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-extrabold text-slate-900 mb-4">Delete Project</h3>
            <p className="text-slate-600 font-medium mb-8">
              Are you sure you want to delete this project and its calendar? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="bg-white/10 py-2.5 px-6 border border-white/20 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                className="inline-flex justify-center py-2.5 px-6 border border-transparent shadow-lg text-sm font-semibold rounded-xl text-white bg-rose-600/80 hover:bg-rose-700/80 transition-all active:scale-95 backdrop-blur-sm"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
