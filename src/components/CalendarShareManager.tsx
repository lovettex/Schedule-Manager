import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthProvider';
import { Share2, X, UserPlus, Trash2, Mail } from 'lucide-react';
import clsx from 'clsx';

interface CalendarShare {
  id: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  sharedWithEmail: string;
  createdAt: any;
}

export default function CalendarShareManager() {
  const { user } = useAuth();
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [emailToShare, setEmailToShare] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calendar_shares'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shareData: CalendarShare[] = [];
      snapshot.forEach((doc) => {
        shareData.push({ id: doc.id, ...doc.data() } as CalendarShare);
      });
      setShares(shareData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calendar_shares');
    });

    return () => unsubscribe();
  }, [user]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user || !emailToShare.trim() || isSubmitting) return;

    const email = emailToShare.trim().toLowerCase();
    if (email === user.email?.toLowerCase()) {
      setError("You cannot share your calendar with yourself.");
      return;
    }

    if (shares.some(s => s.sharedWithEmail.toLowerCase() === email)) {
      setError("You have already shared your calendar with this email.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create the share record with a deterministic ID for security rules
      const shareId = `${user.uid}_${email}`;
      await setDoc(doc(db, 'calendar_shares', shareId), {
        ownerId: user.uid,
        ownerEmail: user.email,
        ownerName: user.displayName || user.email?.split('@')[0] || 'User',
        sharedWithEmail: email,
        createdAt: serverTimestamp()
      });

      // 2. Create a notification for the recipient
      await addDoc(collection(db, 'notifications'), {
        recipientEmail: email,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || 'User',
        type: 'calendar_share',
        message: `${user.displayName || user.email} has shared their personal calendar with you.`,
        read: false,
        createdAt: serverTimestamp()
      });

      setEmailToShare('');
      setIsModalOpen(false);
    } catch (error) {
      setError("Failed to share access. Please try again.");
      handleFirestoreError(error, OperationType.CREATE, 'calendar_shares');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      await deleteDoc(doc(db, 'calendar_shares', shareId));
      setConfirmDeleteId(null);
    } catch (error) {
      setError("Failed to remove access. Please try again.");
      handleFirestoreError(error, OperationType.DELETE, `calendar_shares/${shareId}`);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-white/20 text-[10px] sm:text-xs font-bold rounded-xl text-slate-700 bg-white/10 hover:bg-white/20 transition-all active:scale-95 uppercase tracking-wider"
      >
        <Share2 className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
        Share Calendar
      </button>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-[9999]">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-[95%] sm:max-w-md md:max-w-lg p-6 sm:p-8 md:p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-slate-100 animate-in zoom-in-95 duration-300 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 sm:mb-8 flex-shrink-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Share Calendar</h3>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Grant Read-Only Access</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 sm:p-2.5 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="overflow-y-auto no-scrollbar flex-1">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}

              <form onSubmit={handleShare} className="space-y-4 sm:space-y-5 mb-8 sm:mb-10">
                <div>
                  <label htmlFor="shareEmail" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Recipient Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="email"
                      id="shareEmail"
                      required
                      value={emailToShare}
                      onChange={(e) => setEmailToShare(e.target.value)}
                      className="block w-full rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-4 text-slate-900 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                      placeholder="Enter user's email..."
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center py-3.5 sm:py-4 px-6 border border-transparent shadow-xl text-sm font-black rounded-xl sm:rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.15em]"
                >
                  <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 mr-2.5" />
                  {isSubmitting ? 'Processing...' : 'Share Access'}
                </button>
              </form>

              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Shared With</h4>
                  <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{shares.length} Users</span>
                </div>
                <div className="space-y-2.5 max-h-48 sm:max-h-56 overflow-y-auto no-scrollbar pr-1">
                  {shares.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 sm:py-8 bg-slate-50/50 rounded-2xl sm:rounded-3xl border border-dashed border-slate-200">
                      <Share2 className="h-6 w-6 sm:h-8 sm:w-8 text-slate-200 mb-2" />
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">No active shares</p>
                    </div>
                  ) : (
                    shares.map((share) => (
                      <div key={share.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                        <div className="flex items-center min-w-0">
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-slate-700 truncate">{share.sharedWithEmail}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {confirmDeleteId === share.id ? (
                            <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-2">
                              <button
                                onClick={() => handleRemoveShare(share.id)}
                                className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all text-[10px] font-black uppercase"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all text-[10px] font-black uppercase"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(share.id)}
                              className="p-1.5 sm:p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition-all"
                              title="Remove access"
                            >
                              <Trash2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
