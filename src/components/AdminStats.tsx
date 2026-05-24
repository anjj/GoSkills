import { useState, useEffect, ReactNode } from 'react';
import { collectionGroup, getDocs, query, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Course, CourseProgress } from '../types';
import { BarChart3, Users, BookOpen, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminStats() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressData, setProgressData] = useState<CourseProgress[]>([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const coursesList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        setCourses(coursesList);

        const progressQuery = query(collectionGroup(db, 'progress'));
        const progressSnap = await getDocs(progressQuery);
        const progressList = progressSnap.docs.map(doc => doc.data() as CourseProgress);
        setProgressData(progressList);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching stats:", error);
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  const totalEnrollments = progressData.length;
  const completedCourses = progressData.filter(p => p.status === 'completed').length;
  const activeCourses = totalEnrollments - completedCourses;
  const completionRate = totalEnrollments > 0 ? Math.round((completedCourses / totalEnrollments) * 100) : 0;

  const courseStats = courses.map(course => {
    const courseProgress = progressData.filter(p => p.courseId === course.id);
    const enrollments = courseProgress.length;
    const completed = courseProgress.filter(p => p.status === 'completed').length;
    const active = enrollments - completed;
    const rate = enrollments > 0 ? Math.round((completed / enrollments) * 100) : 0;

    return {
      ...course,
      enrollments,
      completed,
      active,
      rate
    };
  }).sort((a, b) => b.enrollments - a.enrollments);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900">Estadísticas</h1>
        <p className="text-gray-500">Analiza el rendimiento y la participación en los cursos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Users className="text-blue-500" />} label="Total Inscripciones" value={totalEnrollments.toString()} />
        <StatCard icon={<BookOpen className="text-yellow-500" />} label="Cursos Activos" value={activeCourses.toString()} />
        <StatCard icon={<CheckCircle className="text-green-500" />} label="Cursos Completados" value={completedCourses.toString()} />
        <StatCard icon={<BarChart3 className="text-brand" />} label="Tasa de Finalización" value={`${completionRate}%`} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-brand" size={20} />
            Desglose por Curso
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-gray-400 font-bold uppercase tracking-wider text-xs border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Curso</th>
                <th className="px-6 py-4 text-center">Inscripciones</th>
                <th className="px-6 py-4 text-center">Activos</th>
                <th className="px-6 py-4 text-center">Completados</th>
                <th className="px-6 py-4 w-48">Tasa de Finalización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courseStats.map(stat => (
                <tr key={stat.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                         {stat.thumbnailUrl ? (
                            <img src={stat.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                         ) : (
                            <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand font-bold">
                               {stat.title.charAt(0)}
                            </div>
                         )}
                      </div>
                      <div>
                        {stat.title}
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{stat.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-gray-700">{stat.enrollments}</td>
                  <td className="px-6 py-4 text-center font-medium text-yellow-600">{stat.active}</td>
                  <td className="px-6 py-4 text-center font-medium text-green-600">{stat.completed}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.rate}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-brand rounded-full"
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-500 w-8 text-right">{stat.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {courseStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <BarChart3 size={32} className="mb-2 opacity-50" />
                      <p>No hay datos disponibles.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md"
    >
      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-100">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-display font-bold text-gray-900 leading-none">{value}</p>
      </div>
    </motion.div>
  );
}
