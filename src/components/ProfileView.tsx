import { useState, useEffect, ReactNode } from 'react';
import { collection, query, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Course, UserProgress } from '../types';
import { CheckCircle, Clock, BookOpen, Award, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileViewProps {
  userId: string;
}

export default function ProfileView({ userId }: ProfileViewProps) {
  const [completedCourses, setCompletedCourses] = useState<Course[]>([]);
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get all courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));

      // 2. Listen to user progress
      const progressQuery = collection(db, 'users', userId, 'progress');
      const unsubscribe = onSnapshot(progressQuery, (snapshot) => {
        const completedIds = snapshot.docs
          .filter(d => d.data().completed)
          .map(d => d.id);

        const completed = allCourses.filter(c => completedIds.includes(c.id));
        const pending = allCourses.filter(c => !completedIds.includes(c.id));

        setCompletedCourses(completed);
        setPendingCourses(pending);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${userId}/progress`);
      });

      return () => unsubscribe();
    };

    fetchData().catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-40 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-2 gap-6">
        <div className="h-24 bg-gray-100 rounded-lg" />
        <div className="h-24 bg-gray-100 rounded-lg" />
      </div>
    </div>;
  }

  const allCoursesCount = () => {
    return completedCourses.length + pendingCourses.length;
  };

  const completionRate = allCoursesCount() > 0 
    ? Math.round((completedCourses.length / allCoursesCount()) * 100) 
    : 0;

  return (
    <div className="space-y-10">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<BookOpen className="text-blue-500" />} 
          label="Cursos Disponibles" 
          value={allCoursesCount().toString()} 
        />
        <StatCard 
          icon={<CheckCircle className="text-green-500" />} 
          label="Cursos Completados" 
          value={completedCourses.length.toString()} 
        />
        <StatCard 
          icon={<BarChart3 className="text-brand" />} 
          label="Progreso Total" 
          value={`${completionRate}%`} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Pending Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="text-gray-400" size={20} />
            <h2 className="text-xl font-display font-bold text-gray-900">Pendientes de Terminar</h2>
          </div>
          
          <div className="space-y-3">
            {pendingCourses.length > 0 ? (
              pendingCourses.map(course => (
                <div key={course.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group">
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-brand transition-colors">{course.title}</h3>
                    <p className="text-xs text-gray-500 font-medium">{course.category} • {course.duration}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-brand" />
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic text-sm py-4">¡Enhorabuena! Has completado todos los cursos.</p>
            )}
          </div>
        </section>

        {/* Completed Section with Timeline vibe */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Award className="text-gray-400" size={20} />
            <h2 className="text-xl font-display font-bold text-gray-900">Historial de Formación</h2>
          </div>

          <div className="space-y-4 border-l-2 border-gray-100 ml-3 pl-6">
            {completedCourses.length > 0 ? (
              completedCourses.map(course => (
                <div key={course.id} className="relative">
                  <div className="absolute -left-8 top-1.5 w-4 h-4 rounded-full bg-green-500 border-4 border-gray-50" />
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900">{course.title}</h3>
                    <p className="text-xs font-bold text-green-600 uppercase tracking-widest mt-1">Finalizado</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic text-sm py-4">Aún no has finalizado ningún curso.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-6">
      <div className="w-14 h-14 bg-gray-50 rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-display font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
