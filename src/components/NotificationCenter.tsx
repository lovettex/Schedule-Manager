import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthProvider';
import { Bell, X, Check, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

interface Notification {
  id: string;
  recipientEmail: string;
  senderId: string;
  senderName: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: any;
}

interface NotificationCenterProps {
  onNavigate?: (senderId: string) => void;
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || !user.email) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientEmail', '==', user.email.toLowerCase()),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationData: Notification[] = [];
      snapshot.forEach((doc) => {
        notificationData.push({ id: doc.id, ...doc.data() } as Notification);
      });
      setNotifications(notificationData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl glass hover:bg-white/20 text-slate-600 transition-all active:scale-95 shadow-sm relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 glass-card rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-[70] animate-in slide-in-from-top-2 duration-200 origin-top-right">
          <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-white/10">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Notifications</h3>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/20 text-slate-400 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto no-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (notification.type === 'calendar_share' && onNavigate) {
                      onNavigate(notification.senderId);
                      setIsOpen(false);
                    }
                    if (!notification.read) markAsRead(notification.id);
                  }}
                  className={clsx(
                    "px-5 py-4 border-b border-white/10 transition-colors relative group cursor-pointer",
                    !notification.read ? "bg-indigo-50/30" : "hover:bg-white/10"
                  )}
                >
                  <div className="flex gap-4">
                    <div className="mt-1">
                      <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                        <CalendarIcon className="h-4.5 w-4.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 mb-0.5 leading-tight">{notification.message}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {notification.createdAt?.toDate ? format(notification.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                      </p>
                    </div>
                  </div>

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-all"
                      title="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
